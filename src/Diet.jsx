import { useEffect, useMemo, useRef, useState } from 'react'
import { FOODS, MEALS, CATS } from './data/foods'
import { ProteinTip } from './Extras'
import DayPlanModal, { AutoGoal } from './DayPlan'
import { addDays, dayTotals, macros, todayStr, uid, num, parseDate } from './store'
import { Bar, Modal, Ring } from './ui'
import Icon from './icons'
import { analyzeFood, analyzeLabel } from './ai'
import { polarExercisesOn } from './polar'
import { rateFood } from './rating'
import { energy, targetFor, aimOf, aimLabel, kcalGoal, kgWeek } from './energy'

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
  const emptyNc = (code = '', name = '', found = false) => ({ code, name, kcal: '', p: '', c: '', f: '', s: '', sf: '', unitG: '', pkgG: '', found })
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
  // foto con IA: primero se pregunta cuánto te has comido y luego se revisan los alimentos detectados
  const [shot, setShot] = useState(null) // { file, url }
  const [portion, setPortion] = useState('')
  const [rvItems, setRvItems] = useState(null) // { items: [...], assumptions, conf }
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
    // cada palabra por separado y en cualquier orden ("danone limon" encuentra "Yogur Danone sabor limón")
    const words = norm(q).split(/\s+/).filter(Boolean)
    return all.filter((f) => {
      const n = norm(f.name)
      return words.every((w) => n.includes(w))
    })
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

  const [pkgIn, setPkgIn] = useState('')
  const pick = (f) => {
    setFood(f)
    setPkgIn('')
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
        `https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,brands,nutriments,serving_quantity,product_quantity,nutriscore_grade`
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
      const pq = Number(j.product.product_quantity)
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
        ...(pq > 0 && pq < 10000 ? { pkgG: pq } : {}),
      }
      setScan({ loading: false, msg: '' })
      pick(f)
    } catch {
      setScan({ loading: false, msg: 'No se pudo consultar el producto (¿sin conexión?).' })
    }
  }


  const onPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (shot?.url) URL.revokeObjectURL(shot.url)
    setShot({ file, url: URL.createObjectURL(file) })
    setPortion('')
    setPhoto({ loading: false, err: '' })
    setStep('portion')
  }
  const runPhoto = async () => {
    if (!shot) return
    setPhoto({ loading: true, err: '' })
    setStep('photo')
    try {
      const r = await analyzeFood(shot.file, portion)
      setRvItems({ ...r, items: r.items.map((x) => ({ ...x, on: true, g: String(Math.round(x.g || x.total)) , base: x })) })
      setPhoto({ loading: false, err: '' })
      setStep('review2')
    } catch (err) {
      setPhoto({ loading: false, err: err.message })
    }
  }
  // macros de un alimento detectado reescalados a los gramos que pongas
  const scaled = (x) => {
    const g0 = x.base.g || x.base.total || 1
    const k = num(x.g) / g0
    return { kcal: x.base.kcal * k, p: x.base.p * k, c: x.base.c * k, f: x.base.f * k }
  }
  const addDetected = () => {
    const list = rvItems.items.filter((x) => x.on && num(x.g) > 0)
    if (!list.length) return
    const add = list.map((x) => {
      const m = scaled(x)
      const g = num(x.g)
      return { id: uid(), meal, name: x.name.trim() || 'Alimento', grams: g, kcal: (m.kcal / g) * 100, p: (m.p / g) * 100, c: (m.c / g) * 100, f: (m.f / g) * 100, ai: true }
    })
    setData((d) => ({ ...d, food: { ...d.food, [date]: [...(d.food[date] || []), ...add] } }))
    onClose()
  }

  const grams = food ? (mode === 'u' ? num(amount) * (food.unitG || 0) : num(amount)) : 0
  const prev = food ? macros({ ...food, grams }) : { kcal: 0, p: 0, c: 0, f: 0 }

  const addEntry = (entry) => {
    setData((d) => ({ ...d, food: { ...d.food, [date]: [...(d.food[date] || []), { id: uid(), meal, ...entry }] } }))
    onClose()
  }

  if (step === 'qty' && food) {
    const pkgG = num(pkgIn) || food.pkgG || 0
    const isCode = String(food.id || '').startsWith('bc-') || food.barcode
    const FR = [['Entero', 1], ['¾', 0.75], ['La mitad', 0.5], ['⅓', 1 / 3], ['¼', 0.25]]
    const setFrac = (k) => {
      setMode('g')
      setAmount(String(Math.round(pkgG * k)))
    }
    return (
      <Modal title={food.name} onClose={onClose}>
        <RateCard food={food} />
        <p className="muted">
          Por 100 g: {r0(food.kcal)} kcal · {r1(food.p)} P · {r1(food.c)} H · {r1(food.f)} G
        </p>
        {(pkgG > 0 || isCode) && (
          <div className="pkg-box">
            <div className="pkg-top">
              <b>¿Cuánto del paquete?</b>
              {food.pkgG ? (
                <span className="muted small">paquete de {r0(food.pkgG)} g</span>
              ) : (
                <label className="pkg-in muted small">
                  paquete de
                  <input className="inp" inputMode="numeric" placeholder="g" value={pkgIn} onChange={(e) => setPkgIn(e.target.value.replace(/\D/g, '').slice(0, 5))} />g
                </label>
              )}
            </div>
            {pkgG > 0 && (
              <div className="chips wrap">
                {FR.map(([l, k]) => (
                  <button key={l} className={'chip' + (mode === 'g' && num(amount) === Math.round(pkgG * k) ? ' on' : '')} onClick={() => setFrac(k)}>
                    {l} · {Math.round(pkgG * k)} g
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
          onClick={() => {
            // si has puesto el peso del paquete de un producto escaneado, se recuerda para la próxima vez
            if (!food.pkgG && num(pkgIn) > 0 && isCode) {
              const code = food.barcode || String(food.id).slice(3)
              setData((d) => ({ ...d, myFoods: [...(d.myFoods || []).filter((x) => x.barcode !== code), { ...food, id: 'bc-' + code, barcode: code, pkgG: num(pkgIn) }] }))
            }
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
              pkgG: food.pkgG || (num(pkgIn) > 0 ? num(pkgIn) : undefined),
            })
          }}
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

  if (step === 'portion' && shot) {
    const chips = ['Todo', 'Tres cuartos', 'La mitad', 'Un cuarto']
    return (
      <Modal title="¿Cuánto te has comido?" onClose={onClose}>
        {fileInput}
        <img src={shot.url} alt="" className="ai-shot" />
        <p className="muted small">
          Así calculo solo lo que has comido. Vale un porcentaje, una fracción, gramos, unidades ("12 pipas") o una frase ("me dejé un cuarto").
        </p>
        <div className="chips wrap">
          {chips.map((c) => (
            <button key={c} className={'chip' + (portion === c ? ' on' : '')} onClick={() => setPortion(c)}>
              {c}
            </button>
          ))}
        </div>
        <input className="inp" value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="Ej. 200 g, 12 pipas, me dejé la mitad del arroz" />
        <button className="btn primary full" onClick={runPhoto}>
          <Icon name="sparkle" size={16} /> Analizar
        </button>
        <button className="link" onClick={() => fileRef.current?.click()}>
          Hacer otra foto
        </button>
      </Modal>
    )
  }

  if (step === 'review2' && rvItems) {
    const tot = rvItems.items.filter((x) => x.on).reduce((t, x) => {
      const m = scaled(x)
      return { kcal: t.kcal + m.kcal, p: t.p + m.p }
    }, { kcal: 0, p: 0 })
    const upd = (i, p) => setRvItems((r) => ({ ...r, items: r.items.map((x, k) => (k === i ? { ...x, ...p } : x)) }))
    return (
      <Modal title="Lo que te has comido" onClose={onClose}>
        <div className="polar-sum">
          <div>
            <b>{r0(tot.kcal)}</b>
            <span>kcal</span>
          </div>
          <div>
            <b>{r1(tot.p)}</b>
            <span>g proteína</span>
          </div>
        </div>
        {rvItems.assumptions && (
          <div className={'advice ' + (rvItems.conf === 'alta' ? 'green' : 'yellow') + ' sm'}>
            <b>Confianza {rvItems.conf}.</b> {rvItems.assumptions}
          </div>
        )}
        {rvItems.items.map((x, i) => {
          const m = scaled(x)
          return (
            <div key={i} className={'ai-item' + (x.on ? '' : ' off')}>
              <label className="chk-l">
                <input type="checkbox" checked={x.on} onChange={(e) => upd(i, { on: e.target.checked })} />
                <input className="inp ai-name" value={x.name} onChange={(e) => upd(i, { name: e.target.value })} />
              </label>
              <div className="ai-row">
                <input className="inp sm" inputMode="numeric" value={x.g} onFocus={(e) => e.target.select()} onChange={(e) => upd(i, { g: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })} />
                <span className="muted small">g comidos{x.base.total ? ` de ~${r0(x.base.total)} g` : ''}</span>
                <span className="ai-k">
                  <b>{r0(m.kcal)}</b> kcal · {r1(m.p)} P
                </span>
              </div>
            </div>
          )
        })}
        <button className="btn primary full" disabled={!rvItems.items.some((x) => x.on && num(x.g) > 0)} onClick={addDetected}>
          Añadir a {meal}
        </button>
        <button className="link" onClick={() => setStep('portion')}>
          <Icon name="left" size={18} /> Cambiar porción y volver a analizar
        </button>
      </Modal>
    )
  }

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
        ...(num(nc.pkgG) > 0 ? { pkgG: num(nc.pkgG) } : {}),
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
          <label>Paquete entero (g, opcional)<input className="inp" inputMode="decimal" value={nc.pkgG || ''} onChange={set('pkgG')} /></label>
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
        <div className="chips wrap cat-chips">
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

// Balance del día: lo que gastas (reloj) frente a lo que comes
function EnergyCard({ data, setData, date }) {
  const e = energy(data, date)
  if (!e.watch && !data.polar?.days?.[date]) return null
  if (e.spent == null) return null
  const today = date === todayStr()
  const aim = aimOf(data)
  const bal = e.balance
  const deficit = bal < 0
  // color: lo que va a favor de tu objetivo en verde
  const good = aim === 'keep' ? Math.abs(bal) < 300 : aim === 'lose' ? deficit : !deficit
  const tg = today ? targetFor(data, aim, e.train).kcal : null
  const burned = polarExercisesOn(data, date).reduce((n, x) => n + x.kcal, 0)
  return (
    <div className="card energy">
      <div className="sec-head nm">
        <b>{today ? 'Balance de hoy' : 'Balance de ese día'}</b>
        <span className="muted small">{aimLabel(aim)}</span>
      </div>
      <div className="en-grid">
        <div>
          <span>{today ? 'Gastas' : 'Gastaste'}</span>
          <b>
            {e.projected ? '~' : ''}
            {e.spent}
          </b>
        </div>
        <div>
          <span>Comido</span>
          <b>{e.eaten}</b>
        </div>
        <div className={good ? 'good' : 'bad'}>
          <span>{bal === 0 ? 'Equilibrio' : deficit ? 'Déficit' : 'Superávit'}</span>
          <b>{Math.abs(bal)}</b>
        </div>
      </div>
      <p className="muted small en-note">
        {e.projected
          ? `Previsto para un día de ${e.train ? 'entreno' : 'descanso'} con lo que sueles gastar${e.sofar ? ` · el reloj ya marca ${e.sofar}` : ''}${burned ? ` · entreno ${burned}` : ''}.`
          : `Según el reloj${burned ? ` (entreno ${burned} kcal)` : ''}.`}
        {today && !e.eaten ? ' Aún no has apuntado comida.' : ''}
      </p>
      {today && (
        <div className="en-tip">
          <Icon name="sparkle" size={15} />
          <span>
            Para {aimLabel(aim).toLowerCase()} hoy: <b>unas {tg} kcal</b>
            {data.goals.auto
              ? ' (tu objetivo ya está ajustado a esto).'
              : Math.abs(data.goals.kcal - tg) >= 100
                ? ` · tu objetivo fijo es ${data.goals.kcal}.`
                : '.'}
          </span>
        </div>
      )}
      {e.week && (
        <p className="small en-week">
          Últimos {e.week.n} días: {e.week.bal < 0 ? 'déficit' : 'superávit'} medio de <b>{Math.abs(e.week.bal)} kcal/día</b> ≈{' '}
          {kgWeek(e.week.bal) > 0 ? '+' : kgWeek(e.week.bal) < 0 ? '−' : ''}
          {String(Math.abs(kgWeek(e.week.bal))).replace('.', ',')} kg/semana.
        </p>
      )}
      {today && <AutoGoal data={data} setData={setData} />}
    </div>
  )
}

export default function Diet({ data, setData }) {
  const [date, setDate] = useState(todayStr())
  const [adding, setAdding] = useState(null)
  const entries = data.food[date] || []
  const t = dayTotals(entries)
  const g = { ...data.goals, kcal: kcalGoal(data, date) }
  const left = g.kcal - t.kcal

  const remove = (id) =>
    setData((d) => ({ ...d, food: { ...d.food, [date]: (d.food[date] || []).filter((e) => e.id !== id) } }))
  const [favs, setFavs] = useState(false)
  const [dayPlan, setDayPlan] = useState(false)
  const kcalOf = (items) => Math.round(items.reduce((n, e) => n + macros(e).kcal, 0))
  // copia comidas (de ayer o favoritas) al día y comida que estás viendo
  const copyIn = (items, meal) =>
    setData((d) => ({
      ...d,
      food: { ...d.food, [date]: [...(d.food[date] || []), ...items.map(({ id, meal: _m, ...e }) => ({ ...e, id: uid(), meal }))] },
    }))
  const saveFav = (meal, items) => {
    const name = prompt('Nombre para esta comida favorita', `${meal} de siempre`)
    if (!name?.trim()) return
    setData((d) => ({
      ...d,
      favMeals: [...(d.favMeals || []), { id: uid(), name: name.trim(), meal, items: items.map(({ id, ...e }) => e) }],
    }))
  }

  return (
    <div className="page">
      <div className="datenav">
        <button className="icon-btn" aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="left" size={18} />
        </button>
        <h2>{dateLabel(date)}</h2>
        <button className="icon-btn" aria-label="Día siguiente" onClick={() => setDate(addDays(date, 1))}>
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

      <EnergyCard data={data} setData={setData} date={date} />
      {date === todayStr() && <ProteinTip data={data} setData={setData} />}
      <button className="btn full dp-btn" onClick={() => setDayPlan(true)}>
        <Icon name="sparkle" size={16} /> Dieta del día (según lo que gastas)
      </button>
      {dayPlan && <DayPlanModal data={data} setData={setData} onClose={() => setDayPlan(false)} />}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m)
        const yday = (data.food[addDays(date, -1)] || []).filter((e) => e.meal === m)
        const favList = [...(data.favMeals || [])].sort((a, b) => (b.meal === m) - (a.meal === m)).slice(0, 4)
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
            {list.length === 0 && (yday.length > 0 || favList.length > 0) && (
              <div className="chips wrap meal-quick">
                {yday.length > 0 && (
                  <button className="chip" onClick={() => copyIn(yday, m)}>
                    ↺ Repetir de ayer · {kcalOf(yday)} kcal
                  </button>
                )}
                {favList.map((f) => (
                  <button className="chip" key={f.id} onClick={() => copyIn(f.items, m)}>
                    ★ {f.name} · {kcalOf(f.items)} kcal
                  </button>
                ))}
              </div>
            )}
            {list.length > 0 && (
              <button className="link small fav-save" onClick={() => saveFav(m, list)}>
                ☆ Guardar como favorita
              </button>
            )}
          </div>
        )
      })}
      {(data.favMeals || []).length > 0 && (
        <button className="link small" onClick={() => setFavs(true)}>
          Gestionar comidas favoritas ({data.favMeals.length})
        </button>
      )}
      {favs && (
        <Modal title="Comidas favoritas" onClose={() => setFavs(false)}>
          {(data.favMeals || []).length === 0 && <p className="muted">No tienes favoritas.</p>}
          {(data.favMeals || []).map((f) => (
            <div className="row nob li" key={f.id}>
              <div className="grow">
                <div className="li-t">★ {f.name}</div>
                <div className="muted small">
                  {f.items.map((e) => e.name.replace(/ \(.*\)/, '')).join(', ')} · {kcalOf(f.items)} kcal
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="Borrar favorita"
                onClick={() => confirm(`¿Borrar "${f.name}"?`) && setData((d) => ({ ...d, favMeals: d.favMeals.filter((x) => x.id !== f.id) }))}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </Modal>
      )}
      {adding && <AddFood data={data} setData={setData} date={date} meal={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}
