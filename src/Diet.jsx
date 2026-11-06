import { useEffect, useMemo, useRef, useState } from 'react'
import { FOODS, MEALS, CATS } from './data/foods'
import { addDays, dayTotals, macros, todayStr, uid, num, parseDate } from './store'
import { Bar, Modal, Ring } from './ui'
import Icon from './icons'
import { analyzeFood, analyzeLabel } from './ai'
import { rateFood } from './rating'

const r0 = (n) => Math.round(n)
const r1 = (n) => Math.round(n * 10) / 10
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function dateLabel(s) {
  const t = todayStr()
  if (s === t) return 'Hoy'
  if (s === addDays(t, -1)) return 'Ayer'
  if (s === addDays(t, 1)) return 'Mañana'
  return parseDate(s).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}


// Cámara compartida: en las apps de pantalla de inicio de iOS el permiso no se recuerda,
// así que mantenemos la cámara abierta un rato para no volver a pedirlo en cada escaneo.
const cam = { stream: null, timer: null }
async function getCam() {
  clearTimeout(cam.timer)
  if (cam.stream && cam.stream.getVideoTracks().some((t) => t.readyState === 'live')) return cam.stream
  cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  return cam.stream
}
function releaseCamSoon() {
  clearTimeout(cam.timer)
  cam.timer = setTimeout(() => {
    cam.stream?.getTracks().forEach((t) => t.stop())
    cam.stream = null
  }, 3 * 60 * 1000)
}

async function makeReader() {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E])
  hints.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(hints)
}

// Lee el código de barras de una foto (cámara normal del iPhone, sin pedir permiso)
export async function decodeBarcodeFile(file) {
  const reader = await makeReader()
  const url = URL.createObjectURL(file)
  try {
    const r = await reader.decodeFromImageUrl(url)
    return r.getText()
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function Scanner({ onCode }) {
  const videoRef = useRef(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let controls = null
    let stopped = false
    const v = videoRef.current
    ;(async () => {
      try {
        const reader = await makeReader()
        const stream = await getCam()
        if (stopped) return
        v.srcObject = stream
        v.setAttribute('playsinline', 'true')
        v.muted = true
        await v.play().catch(() => {})
        controls = reader.scan(v, (result) => {
          if (result && !stopped) {
            stopped = true
            controls?.stop()
            onCode(result.getText())
          }
        })
        if (stopped) controls.stop()
      } catch {
        setErr('No se pudo abrir la cámara. Usa "Foto al código" o escribe el número debajo.')
      }
    })()
    return () => {
      stopped = true
      controls?.stop()
      if (v) v.srcObject = null
      releaseCamSoon()
    }
  }, [])
  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted />
      <div className="scan-line" />
      {err && <p className="muted">{err}</p>}
    </div>
  )
}

export function RateDot({ food }) {
  const r = rateFood(food)
  if (!r) return null
  return <span className={'rdot ' + r.level} title={r.label} />
}

function RateCard({ food }) {
  const r = rateFood(food)
  if (!r) return null
  return (
    <div className={'ratecard ' + r.level}>
      <div className="light">
        <span className="l red" />
        <span className="l yellow" />
        <span className="l green" />
      </div>
      <div className="grow">
        <b>{r.label}</b>
        {r.why.length > 0 && <div className="small">{r.why.join(' · ')}</div>}
        {r.ns && <div className="small muted">Nutri-Score {r.ns.toUpperCase()}</div>}
      </div>
    </div>
  )
}

function FoodLine({ f, onClick }) {
  return (
    <button className="row" onClick={onClick}>
      <RateDot food={f} />
      <div className="grow">
        <div>{f.name}</div>
        <div className="muted small">
          {r0(f.kcal)} kcal · {r1(f.p)} g prot · por 100 g
        </div>
      </div>
      <span className="plus"><Icon name="plus" size={18} /></span>
    </button>
  )
}

function AddFood({ data, setData, date, meal, onClose }) {
  const [step, setStep] = useState('search') // search | qty | manual
  const [q, setQ] = useState('')
  const [online, setOnline] = useState({ loading: false, items: [], err: '' })
  const [food, setFood] = useState(null)
  const [amount, setAmount] = useState('100')
  const [mode, setMode] = useState('g')
  const [quick, setQuick] = useState({ name: '', kcal: '', p: '' })
  const [cat, setCat] = useState(meal === 'Picoteo / gym' ? 'calle' : null)
  const [nf, setNf] = useState({ name: '', kcal: '', p: '', c: '', f: '', s: '', sf: '' })
  const [code, setCode] = useState('')
  const [scan, setScan] = useState({ loading: false, msg: '' })
  const fileRef = useRef(null)
  const labelRef = useRef(null)
  const [nc, setNc] = useState(null) // producto nuevo por código: {code, name, kcal, p, c, f, s, sf, unitG}
  const [lbl, setLbl] = useState({ loading: false, err: '' })
  const codePhotoRef = useRef(null)
  const emptyNc = (code = '', name = '', found = false) => ({ code, name, kcal: '', p: '', c: '', f: '', s: '', sf: '', unitG: '', found })
  const onLabel = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStep('newcode')
    setNc((x) => x || emptyNc())
    setLbl({ loading: true, err: '' })
    try {
      const v = await analyzeLabel(file)
      setNc((x) => ({ ...(x || emptyNc()), ...Object.fromEntries(Object.entries(v).filter(([, val]) => val !== '')) }))
      setLbl({ loading: false, err: '', ok: true })
    } catch (err) {
      setLbl({ loading: false, err: err.message === 'NO_KEY' ? 'Para leer la tabla con la cámara necesitas la clave de Groq (Ajustes). Puedes escribir los datos a mano.' : err.message })
    }
  }
  const onCodePhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setScan({ loading: true, msg: '' })
    const c = await decodeBarcodeFile(file)
    if (c) lookupCode(c)
    else setScan({ loading: false, msg: 'No he encontrado un código de barras en la foto. Prueba más cerca, recto y con luz, o escribe el número.' })
  }
  const labelInput = <input type="file" accept="image/*" capture="environment" ref={labelRef} onChange={onLabel} hidden />
  const [photo, setPhoto] = useState({ loading: false, err: '' })
  const [rv, setRv] = useState({ name: '', kcal: '', p: '', c: '', f: '', conf: '' })

  const recents = useMemo(() => {
    const seen = new Set()
    const out = []
    const dates = Object.keys(data.food).sort().reverse()
    for (const d of dates) {
      for (const e of [...data.food[d]].reverse()) {
        if (e.quick || seen.has(e.name)) continue
        seen.add(e.name)
        out.push({ id: 'r-' + e.id, name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f, unitG: e.unitG, unitName: e.unitName, s: e.s, sf: e.sf, ns: e.ns, natural: e.natural, alcohol: e.alcohol, fastfood: e.fastfood })
        if (out.length >= 8) return out
      }
    }
    return out
  }, [data.food])

  const local = useMemo(() => {
    const all = [...(data.myFoods || []), ...FOODS]
    if (!q.trim()) return []
    const nq = norm(q)
    return all.filter((f) => norm(f.name).includes(nq))
  }, [q, data.myFoods])

  const searchOnline = async () => {
    setOnline({ loading: true, items: [], err: '' })
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        q
      )}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,nutriments,nutriscore_grade&lc=es&cc=es`
      const res = await fetch(url)
      const j = await res.json()
      const items = (j.products || [])
        .filter((p) => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] != null)
        .map((p) => ({
          id: 'off-' + uid(),
          name: p.product_name + (p.brands ? ` (${p.brands.split(',')[0].trim()})` : ''),
          kcal: Number(p.nutriments['energy-kcal_100g']) || 0,
          p: Number(p.nutriments.proteins_100g) || 0,
          c: Number(p.nutriments.carbohydrates_100g) || 0,
          f: Number(p.nutriments.fat_100g) || 0,
          s: p.nutriments.sugars_100g != null ? Number(p.nutriments.sugars_100g) : undefined,
          sf: p.nutriments['saturated-fat_100g'] != null ? Number(p.nutriments['saturated-fat_100g']) : undefined,
          ns: p.nutriscore_grade,
        }))
      setOnline({ loading: false, items, err: items.length ? '' : 'Sin resultados en Open Food Facts' })
    } catch {
      setOnline({ loading: false, items: [], err: 'No se pudo buscar (¿sin conexión?)' })
    }
  }

  const pick = (f) => {
    setFood(f)
    setMode('g')
    setAmount(f.unitG ? '1' : '100')
    if (f.unitG) setMode('u')
    setStep('qty')
  }


  const lookupCode = async (raw) => {
    const c = String(raw).replace(/\D/g, '')
    if (c.length < 8 || c.length > 14) {
      setScan({ loading: false, msg: 'Eso no parece un código de barras de producto (los QR no sirven).' })
      return setStep('scan')
    }
    setCode(c)
    const mine = (data.myFoods || []).find((x) => x.barcode === c)
    if (mine) return pick(mine)
    setScan({ loading: true, msg: '' })
    setStep('scan')
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,brands,nutriments,serving_quantity,nutriscore_grade`
      )
      const j = await res.json()
      const n = j.product?.nutriments
      if (j.status !== 1 || !n || n['energy-kcal_100g'] == null) {
        const nm = j.product?.product_name ? j.product.product_name + (j.product.brands ? ` (${j.product.brands.split(',')[0].trim()})` : '') : ''
        setScan({ loading: false, msg: '' })
        setNc(emptyNc(c, nm, !!nm))
        return setStep('newcode')
      }
      const sq = Number(j.product.serving_quantity)
      const f = {
        id: 'bc-' + c,
        name: (j.product.product_name || 'Producto') + (j.product.brands ? ` (${j.product.brands.split(',')[0].trim()})` : ''),
        kcal: Number(n['energy-kcal_100g']) || 0,
        p: Number(n.proteins_100g) || 0,
        c: Number(n.carbohydrates_100g) || 0,
        f: Number(n.fat_100g) || 0,
        s: n.sugars_100g != null ? Number(n.sugars_100g) : undefined,
        sf: n['saturated-fat_100g'] != null ? Number(n['saturated-fat_100g']) : undefined,
        ns: j.product.nutriscore_grade,
        ...(sq > 0 ? { unitG: sq, unitName: 'ración' } : {}),
      }
      setScan({ loading: false, msg: '' })
      pick(f)
    } catch {
      setScan({ loading: false, msg: 'No se pudo consultar el producto (¿sin conexión?).' })
    }
  }


  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhoto({ loading: true, err: '' })
    setStep('photo')
    try {
      const r = await analyzeFood(file)
      setRv({ name: r.name, kcal: String(r0(r.kcal)), p: String(r1(r.p)), c: String(r1(r.c)), f: String(r1(r.f)), conf: r.conf })
      setPhoto({ loading: false, err: '' })
      setStep('review')
    } catch (err) {
      setPhoto({ loading: false, err: err.message })
    }
  }

  const grams = food ? (mode === 'u' ? num(amount) * (food.unitG || 0) : num(amount)) : 0
  const prev = food ? macros({ ...food, grams }) : { kcal: 0, p: 0, c: 0, f: 0 }

  const addEntry = (entry) => {
    setData((d) => ({ ...d, food: { ...d.food, [date]: [...(d.food[date] || []), { id: uid(), meal, ...entry }] } }))
    onClose()
  }

  if (step === 'qty' && food) {
    return (
      <Modal title={food.name} onClose={onClose}>
        <RateCard food={food} />
        <p className="muted">
          Por 100 g: {r0(food.kcal)} kcal · {r1(food.p)} P · {r1(food.c)} H · {r1(food.f)} G
        </p>
        <label className="lbl">Cantidad</label>
        <div className="qty">
          <input className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          {food.unitG ? (
            <select className="inp" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="u">{food.unitName}(s)</option>
              <option value="g">gramos</option>
            </select>
          ) : (
            <span className="x">gramos</span>
          )}
        </div>
        <div className="sum">
          <b>{r0(prev.kcal)} kcal</b> · {r1(prev.p)} g proteína · {r1(prev.c)} g hidratos · {r1(prev.f)} g grasa
        </div>
        <button
          className="btn primary full"
          disabled={grams <= 0}
          onClick={() =>
            addEntry({
              name: food.name,
              grams,
              kcal: food.kcal,
              p: food.p,
              c: food.c,
              f: food.f,
              unitG: food.unitG,
              unitName: food.unitName,
              s: food.s,
              sf: food.sf,
              ns: food.ns,
              natural: food.natural,
              alcohol: food.alcohol,
              fastfood: food.fastfood,
              label: mode === 'u' ? `${num(amount)} ${food.unitName}` : undefined,
            })
          }
        >
          Añadir a {meal.toLowerCase()}
        </button>
        <button className="link" onClick={() => setStep('search')}>
          <Icon name="left" size={18} /> Elegir otro
        </button>
      </Modal>
    )
  }

  const fileInput = <input type="file" accept="image/*" capture="environment" ref={fileRef} onChange={onPhoto} hidden />

  if (step === 'photo') {
    return (
      <Modal title="Foto del alimento" onClose={onClose}>
        {fileInput}
        {photo.loading ? (
          <p className="muted">Analizando la foto…</p>
        ) : photo.err === 'NO_KEY' ? (
          <>
            <p>
              Para reconocer alimentos por foto necesitas una clave de Groq. Es gratis: la consigues en
              console.groq.com y la pegas en <b>Ajustes → IA para fotos</b>.
            </p>
            <button className="link" onClick={() => setStep('search')}>
              <Icon name="left" size={18} /> Volver
            </button>
          </>
        ) : (
          <>
            <p className="toast warn">{photo.err}</p>
            <button className="btn full" onClick={() => fileRef.current?.click()}>
              Probar con otra foto
            </button>
            <button className="link" onClick={() => setStep('search')}>
              <Icon name="left" size={18} /> Volver
            </button>
          </>
        )}
      </Modal>
    )
  }

  if (step === 'review') {
    return (
      <Modal title="Revisa lo que ha detectado" onClose={onClose}>
        <p className="muted">
          Estimado por IA (confianza {rv.conf}). Los valores son por 100 g: corrígelos si no te cuadran y en el
          siguiente paso pones los gramos.
        </p>
        <label className="lbl">Alimento</label>
        <input className="inp" value={rv.name} onChange={(e) => setRv({ ...rv, name: e.target.value })} />
        <div className="two">
          <input className="inp" inputMode="decimal" placeholder="kcal" value={rv.kcal} onChange={(e) => setRv({ ...rv, kcal: e.target.value })} />
          <input className="inp" inputMode="decimal" placeholder="proteína" value={rv.p} onChange={(e) => setRv({ ...rv, p: e.target.value })} />
          <input className="inp" inputMode="decimal" placeholder="hidratos" value={rv.c} onChange={(e) => setRv({ ...rv, c: e.target.value })} />
          <input className="inp" inputMode="decimal" placeholder="grasa" value={rv.f} onChange={(e) => setRv({ ...rv, f: e.target.value })} />
        </div>
        <button
          className="btn primary full"
          disabled={!rv.name.trim() || num(rv.kcal) <= 0}
          onClick={() => pick({ id: 'ai-' + uid(), name: rv.name.trim(), kcal: num(rv.kcal), p: num(rv.p), c: num(rv.c), f: num(rv.f) })}
        >
          Continuar: poner gramos
        </button>
        <button className="btn full" onClick={() => {
          const f = { id: 'm-' + uid(), name: rv.name.trim(), kcal: num(rv.kcal), p: num(rv.p), c: num(rv.c), f: num(rv.f) }
          setData((d) => ({ ...d, myFoods: [...(d.myFoods || []), f] }))
          pick(f)
        }} disabled={!rv.name.trim() || num(rv.kcal) <= 0}>
          Guardar en mis alimentos y continuar
        </button>
        <button className="link" onClick={() => setStep('search')}>
          <Icon name="left" size={18} /> Descartar
        </button>
      </Modal>
    )
  }

  if (step === 'newcode' && nc) {
    const set = (k) => (e) => setNc({ ...nc, [k]: e.target.value })
    const ok = nc.name.trim() && nc.kcal !== '' && num(nc.kcal) >= 0
    const save = () => {
      const code = nc.code || (nc.code2 && nc.code2.length >= 8 ? nc.code2 : '')
      nc.code = code
      const f = {
        id: nc.code ? 'bc-' + nc.code : 'm-' + uid(),
        ...(nc.code ? { barcode: nc.code } : {}),
        name: nc.name.trim(),
        kcal: num(nc.kcal),
        p: num(nc.p),
        c: num(nc.c),
        f: num(nc.f),
        ...(nc.s !== '' ? { s: num(nc.s) } : {}),
        ...(nc.sf !== '' ? { sf: num(nc.sf) } : {}),
        ...(num(nc.unitG) > 0 ? { unitG: num(nc.unitG), unitName: 'ración' } : {}),
      }
      setData((d) => ({ ...d, myFoods: [...(d.myFoods || []).filter((x) => !nc.code || x.barcode !== nc.code), f] }))
      pick(f)
    }
    return (
      <Modal title={nc.code ? 'Producto nuevo' : 'Crear producto'} onClose={onClose}>
        {labelInput}
        {nc.code ? (
          <div className="advice yellow sm" style={{ marginTop: 0 }}>
            {nc.found ? `El código ${nc.code} existe pero no tiene datos nutricionales.` : `No conozco el código ${nc.code}.`}{' '}
            Créalo una vez y la próxima vez que lo escanees te saldrá directamente.
          </div>
        ) : (
          <p className="muted small" style={{ marginTop: 0 }}>
            Haz una foto a la tabla nutricional del envase y relleno los datos, o escríbelos tú.
          </p>
        )}
        <button className="btn primary full" disabled={lbl.loading} onClick={() => labelRef.current?.click()}>
          <Icon name="camera" size={18} /> {lbl.loading ? 'Leyendo la tabla…' : 'Foto de la tabla nutricional (IA)'}
        </button>
        {lbl.err && <p className="toast warn small">{lbl.err}</p>}
        {lbl.ok && <p className="toast small">Datos leídos. Revísalos antes de guardar.</p>}
        <label className="lbl">Nombre del producto</label>
        <input className="inp" placeholder="Ej: Batido de chocolate Marca X" value={nc.name} onChange={set('name')} />
        <label className="lbl">Valores por 100 g / 100 ml (los de la tabla)</label>
        <div className="two labeled">
          <label>Calorías (kcal)<input className="inp" inputMode="decimal" value={nc.kcal} onChange={set('kcal')} /></label>
          <label>Proteínas (g)<input className="inp" inputMode="decimal" value={nc.p} onChange={set('p')} /></label>
          <label>Hidratos (g)<input className="inp" inputMode="decimal" value={nc.c} onChange={set('c')} /></label>
          <label>de los cuales azúcares (g)<input className="inp" inputMode="decimal" value={nc.s} onChange={set('s')} /></label>
          <label>Grasas (g)<input className="inp" inputMode="decimal" value={nc.f} onChange={set('f')} /></label>
          <label>de las cuales saturadas (g)<input className="inp" inputMode="decimal" value={nc.sf} onChange={set('sf')} /></label>
          <label>Ración (g, opcional)<input className="inp" inputMode="decimal" value={nc.unitG} onChange={set('unitG')} /></label>
        </div>
        <button className="btn primary full" disabled={!ok} onClick={save}>
          <Icon name="check" size={18} /> Guardar producto y poner cantidad
        </button>
        {!nc.code && (
          <>
            <label className="lbl">Código de barras (opcional, para escanearlo luego)</label>
            <input className="inp" inputMode="numeric" value={nc.code2 || ''} onChange={(e) => setNc({ ...nc, code2: e.target.value.replace(/\D/g, '') })} />
          </>
        )}
        <button className="link" onClick={() => setStep(nc.code ? 'scan' : 'search')}>
          <Icon name="left" size={18} /> Volver
        </button>
      </Modal>
    )
  }

  if (step === 'scan') {
    return (
      <Modal title="Escanear código de barras" onClose={onClose}>
        {scan.loading ? (
          <p className="muted">Buscando producto {code}…</p>
        ) : (
          <>
            <Scanner key={code + scan.msg} onCode={lookupCode} />
            {scan.msg && <p className="toast warn">{scan.msg}</p>}
          </>
        )}
        <input type="file" accept="image/*" capture="environment" ref={codePhotoRef} onChange={onCodePhoto} hidden />
        <button className="btn full" onClick={() => codePhotoRef.current?.click()}>
          <Icon name="camera" size={18} /> Foto al código (sin permisos)
        </button>
        <label className="lbl">O escribe el número del código</label>
        <div className="qty">
          <input className="inp" inputMode="numeric" placeholder="8410000000000" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn qty-btn" disabled={code.length < 8} onClick={() => lookupCode(code)}>
            Buscar
          </button>
        </div>
        <button className="link" onClick={() => setStep('search')}>
          <Icon name="left" size={18} /> Volver
        </button>
      </Modal>
    )
  }

  if (step === 'manual') {
    return (
      <Modal title="Crear o añadir rápido" onClose={onClose}>
        {labelInput}
        <h4 style={{ marginTop: 0 }}>Crear un producto</h4>
        <div className="quick-actions two-col">
          <button className="qa primary" onClick={() => { setNc(emptyNc()); setLbl({ loading: false, err: '' }); labelRef.current?.click() }}>
            <Icon name="camera" size={24} />
            <span>Foto de la tabla nutricional</span>
          </button>
          <button className="qa" onClick={() => { setNc(emptyNc()); setLbl({ loading: false, err: '' }); setStep('newcode') }}>
            <Icon name="edit" size={22} />
            <span>Escribir los datos</span>
          </button>
        </div>
        <h4>Añadir rápido (solo calorías)</h4>
        <input className="inp" placeholder="Nombre (opcional)" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
        <div className="two">
          <input className="inp" inputMode="decimal" placeholder="kcal" value={quick.kcal} onChange={(e) => setQuick({ ...quick, kcal: e.target.value })} />
          <input className="inp" inputMode="decimal" placeholder="proteína g" value={quick.p} onChange={(e) => setQuick({ ...quick, p: e.target.value })} />
        </div>
        <button
          className="btn full"
          disabled={num(quick.kcal) <= 0}
          onClick={() =>
            addEntry({
              name: quick.name.trim() || 'Comida rápida',
              grams: 100,
              kcal: num(quick.kcal),
              p: num(quick.p),
              c: 0,
              f: 0,
              quick: true,
            })
          }
        >
          Añadir
        </button>
        <button className="link" onClick={() => setStep('search')}>
          <Icon name="left" size={18} /> Volver
        </button>
      </Modal>
    )
  }

  return (
    <Modal title={`Añadir a ${meal.toLowerCase()}`} onClose={onClose}>
      {fileInput}
      <div className="quick-actions">
        <button
          className="qa primary"
          onClick={() => {
            setScan({ loading: false, msg: '' })
            setCode('')
            setStep('scan')
          }}
        >
          <Icon name="barcode" size={26} />
          <span>Escanear código</span>
        </button>
        <button className="qa" onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={26} />
          <span>Foto (IA)</span>
        </button>
        <button className="qa" onClick={() => setStep('manual')}>
          <Icon name="edit" size={24} />
          <span>Crear / rápido</span>
        </button>
      </div>
      <input className="inp" placeholder="Buscar alimento…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q.trim() && (
        <div className="chips">
          {CATS.map((c) => (
            <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(cat === c.id ? null : c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {!q.trim() && cat && (
        <div className="list">
          {[...(data.myFoods || []), ...FOODS].filter((f) => f.cat === cat).map((f) => (
            <FoodLine key={f.id} f={f} onClick={() => pick(f)} />
          ))}
        </div>
      )}
      {!q.trim() && !cat && recents.length > 0 && (
        <>
          <h4>Recientes</h4>
          <div className="list">
            {recents.map((f) => (
              <FoodLine key={f.id} f={f} onClick={() => pick(f)} />
            ))}
          </div>
        </>
      )}
      {q.trim() && (
        <div className="list">
          {local.map((f) => (
            <FoodLine key={f.id} f={f} onClick={() => pick(f)} />
          ))}
          {local.length === 0 && <p className="muted">No está en tu lista.</p>}
        </div>
      )}
      {q.trim().length >= 3 && (
        <>
          <button className="btn full" onClick={searchOnline} disabled={online.loading}>
            {online.loading ? 'Buscando…' : 'Buscar productos de súper (Open Food Facts)'}
          </button>
          {online.err && <p className="muted">{online.err}</p>}
          <div className="list">
            {online.items.map((f) => (
              <FoodLine key={f.id} f={f} onClick={() => pick(f)} />
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

export default function Diet({ data, setData }) {
  const [date, setDate] = useState(todayStr())
  const [adding, setAdding] = useState(null)
  const entries = data.food[date] || []
  const t = dayTotals(entries)
  const g = data.goals
  const left = g.kcal - t.kcal

  const remove = (id) =>
    setData((d) => ({ ...d, food: { ...d.food, [date]: (d.food[date] || []).filter((e) => e.id !== id) } }))

  return (
    <div className="page">
      <div className="datenav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="left" size={18} />
        </button>
        <h2>{dateLabel(date)}</h2>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))}>
          <Icon name="right" size={18} />
        </button>
      </div>

      <div className="card summary">
        <Ring value={t.kcal} max={g.kcal} size={128}>
          <b className="ring-num">{r0(Math.abs(left))}</b>
          <span className="ring-lbl">{left >= 0 ? 'kcal restantes' : 'kcal de más'}</span>
        </Ring>
        <div className="grow macros">
          <div className="macro">
            <div className="macro-top">
              <span>Consumidas</span>
              <b>
                {r0(t.kcal)} <span className="muted">/ {g.kcal}</span>
              </b>
            </div>
            <Bar value={t.kcal} max={g.kcal} />
          </div>
          <div className="macro">
            <div className="macro-top">
              <span>Proteína</span>
              <b>
                {r0(t.p)} <span className="muted">/ {g.protein} g</span>
              </b>
            </div>
            <Bar value={t.p} max={g.protein} color="var(--blue)" />
          </div>
          <div className="macro-mini">
            <span><i className="dotc" style={{ background: 'var(--amber)' }} />Hidratos {r0(t.c)} g</span>
            <span><i className="dotc" style={{ background: 'var(--pink)' }} />Grasa {r0(t.f)} g</span>
          </div>
        </div>
      </div>

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m)
        const mk = list.reduce((s, e) => s + macros(e).kcal, 0)
        return (
          <div className="card" key={m}>
            <div className="row nob meal-head">
              <b className="grow">{m}</b>
              <span className="kcal-chip">{r0(mk)} kcal</span>
              <button className="icon-btn" onClick={() => setAdding(m)} aria-label={`Añadir a ${m}`}>
                <Icon name="plus" size={18} />
              </button>
            </div>
            {list.map((e) => {
              const mm = macros(e)
              return (
                <div className="row nob food" key={e.id}>
                  <RateDot food={e} />
                  <div className="grow">
                    <div>{e.name}</div>
                    <div className="muted small">
                      {e.quick ? 'Rápido' : e.label || `${r0(e.grams)} g`} · {r0(mm.kcal)} kcal · {r1(mm.p)} g prot
                    </div>
                  </div>
                  <button className="icon-btn" onClick={() => remove(e.id)} aria-label="Quitar">
                    <Icon name="x" size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
      {adding && <AddFood data={data} setData={setData} date={date} meal={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}
