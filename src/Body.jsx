import { useEffect, useRef, useState } from 'react'
import { Modal, TrendChart } from './ui'
import Icon from './icons'
import { todayStr, uid, num, fmtKg, addDays, fmtDate } from './store'
import { savePhoto, loadPhoto, deletePhoto, compressImage } from './photos'

const fmtD = (s) => `${s.slice(8)}/${s.slice(5, 7)}`
const daysSince = (s) => (s ? Math.round((Date.parse(todayStr()) - Date.parse(s)) / 864e5) : Infinity)

function Photo({ id, className, onClick }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let alive = true
    loadPhoto(id)
      .then((d) => alive && setSrc(d || null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id])
  return src ? <img src={src} alt="" className={className} onClick={onClick} /> : <div className={className + ' ph-empty'} />
}

function WaistModal({ data, setData, onClose }) {
  const waist = data.body?.waist || []
  const last = waist[waist.length - 1]
  const [cm, setCm] = useState(last ? String(last.cm).replace('.', ',') : '')
  const save = () => {
    const v = num(cm)
    if (v < 40 || v > 200) return
    const d = todayStr()
    setData((x) => {
      const w = (x.body?.waist || []).filter((e) => e.date !== d)
      return { ...x, body: { ...(x.body || {}), waist: [...w, { date: d, cm: v }].sort((a, b) => a.date.localeCompare(b.date)) } }
    })
    onClose()
  }
  return (
    <Modal title="Medir cintura" onClose={onClose}>
      <p className="muted small">
        Una vez por semana, el mismo día y por la mañana antes de desayunar. Cinta a la altura del ombligo, de pie, relajado y sin apretar.
      </p>
      <label className="lbl">Cintura (cm)</label>
      <input className="inp" inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} placeholder="Ej. 92" autoFocus />
      <button className="btn primary full" disabled={!(num(cm) >= 40 && num(cm) <= 200)} onClick={save}>
        Guardar
      </button>
      {waist.length > 0 && (
        <>
          <h4>Historial</h4>
          {[...waist].reverse().slice(0, 8).map((e) => (
            <div className="row nob li" key={e.date}>
              <span className="grow">{fmtD(e.date)}</span>
              <b>{fmtKg(e.cm)} cm</b>
              <button
                className="icon-btn ghost"
                aria-label="Borrar medida"
                onClick={() =>
                  setData((x) => ({ ...x, body: { ...x.body, waist: (x.body?.waist || []).filter((w) => w.date !== e.date) } }))
                }
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}

// Media de los últimos 3 pesajes: lo que se muestra es la tendencia, no el número suelto
const trend = (list) => list.map((_, i) => {
  const s = list.slice(Math.max(0, i - 2), i + 1)
  return { date: list[i].date, v: Math.round((s.reduce((a, e) => a + e.kg, 0) / s.length) * 10) / 10 }
})

function WeightModal({ data, setData, onClose }) {
  const weights = data.body?.weight || []
  const [kg, setKg] = useState('')
  const [show, setShow] = useState(false)
  const save = () => {
    const v = num(kg)
    if (v < 30 || v > 300) return
    const d = todayStr()
    setData((x) => {
      const w = (x.body?.weight || []).filter((e) => e.date !== d)
      return { ...x, body: { ...(x.body || {}), weight: [...w, { date: d, kg: v }].sort((a, b) => a.date.localeCompare(b.date)) } }
    })
    onClose()
  }
  return (
    <Modal title="Pesarte" onClose={onClose}>
      <p className="muted small">
        Una vez por semana, el mismo día, por la mañana, en ayunas y después de ir al baño. No mires el número suelto: lo que importa es la tendencia.
      </p>
      <label className="lbl">Peso (kg)</label>
      <input className="inp" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="Ej. 80,5" autoFocus />
      <button className="btn primary full" disabled={!(num(kg) >= 30 && num(kg) <= 300)} onClick={save}>
        Guardar
      </button>
      {weights.length > 0 && (
        <>
          <button className="btn full" onClick={() => setShow(!show)}>
            {show ? 'Ocultar pesos sueltos' : 'Ver pesos sueltos'}
          </button>
          {show &&
            [...weights].reverse().slice(0, 8).map((e) => (
              <div className="row nob li" key={e.date}>
                <span className="grow">{fmtD(e.date)}</span>
                <b>{fmtKg(e.kg)} kg</b>
                <button
                  className="icon-btn ghost"
                  aria-label="Borrar peso"
                  onClick={() => setData((x) => ({ ...x, body: { ...x.body, weight: (x.body?.weight || []).filter((w) => w.date !== e.date) } }))}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
        </>
      )}
    </Modal>
  )
}

function PhotosModal({ data, setData, onClose }) {
  const photos = data.body?.photos || []
  const fileRef = useRef()
  const galRef = useRef()
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(null)
  // Cámara o galería (varias a la vez). De la galería se usa la fecha de la foto si es anterior a hoy.
  const add = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    const added = []
    for (const f of files) {
      try {
        const url = await compressImage(f)
        const id = uid()
        await savePhoto(id, url)
        const taken = f.lastModified ? fmtDate(new Date(f.lastModified)) : todayStr()
        added.push({ id, date: taken < todayStr() ? taken : todayStr() })
      } catch {}
    }
    if (added.length < files.length) alert('Alguna foto no se pudo guardar.')
    setData((x) => ({
      ...x,
      body: { ...(x.body || {}), photos: [...(x.body?.photos || []), ...added].sort((a, b) => a.date.localeCompare(b.date)) },
    }))
    setBusy(false)
  }
  const del = async (p) => {
    if (!confirm('¿Borrar esta foto?')) return
    await deletePhoto(p.id).catch(() => {})
    setData((x) => ({ ...x, body: { ...x.body, photos: (x.body?.photos || []).filter((y) => y.id !== p.id) } }))
    setView(null)
  }
  const first = photos[0]
  const last = photos[photos.length - 1]
  return (
    <Modal title="Fotos de progreso" onClose={onClose}>
      <p className="muted small">
        Una al mes: misma luz, mismo sitio, de frente y de perfil. Se guardan solo en este móvil y no salen en ningún sitio.
      </p>
      <input type="file" accept="image/*" capture="user" ref={fileRef} onChange={add} hidden />
      <input type="file" accept="image/*" multiple ref={galRef} onChange={add} hidden />
      <div className="btns">
        <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={16} /> {busy ? 'Guardando…' : 'Hacer foto'}
        </button>
        <button className="btn" disabled={busy} onClick={() => galRef.current?.click()}>
          <Icon name="plus" size={16} /> De la galería
        </button>
      </div>
      {photos.length >= 2 && (
        <>
          <h4>Antes y ahora</h4>
          <div className="ph-compare">
            <figure>
              <Photo id={first.id} className="ph-img" />
              <figcaption>{fmtD(first.date)}</figcaption>
            </figure>
            <figure>
              <Photo id={last.id} className="ph-img" />
              <figcaption>{fmtD(last.date)}</figcaption>
            </figure>
          </div>
        </>
      )}
      {photos.length > 0 && (
        <>
          <h4>Todas</h4>
          <div className="ph-grid">
            {[...photos].reverse().map((p) => (
              <figure key={p.id}>
                <Photo id={p.id} className="ph-img sm" onClick={() => setView(p)} />
                <figcaption>{fmtD(p.date)}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      {view && (
        <div className="ph-full" onClick={() => setView(null)}>
          <Photo id={view.id} className="ph-big" />
          <div className="ph-full-bar" onClick={(e) => e.stopPropagation()}>
            <span>{fmtD(view.date)}</span>
            <button className="btn danger" onClick={() => del(view)}>
              Borrar
            </button>
            <button className="btn" onClick={() => setView(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// lectura rápida de cintura + peso de las últimas 4 semanas (solo pistas, sin pesos sueltos)
function bodyRead(waist, wt) {
  if (waist.length < 2 || wt.length < 2) return null
  const win = (list, key) => {
    const end = list[list.length - 1]
    const from = list.filter((p) => p.date >= addDays(end.date, -28))
    const a = from.length >= 2 ? from[0] : list[list.length - 2]
    return { d: end[key] - a[key], days: (Date.parse(end.date) - Date.parse(a.date)) / 864e5 }
  }
  const w = win(waist, 'cm')
  const k = win(wt, 'v')
  if (Math.min(w.days, k.days) < 14) return 'Con 2–3 semanas de medidas te diré si estás perdiendo grasa, ganando músculo o las dos cosas.'
  if (w.d <= -0.5 && k.d <= -0.3) return 'Bajan la cintura y el peso: estás perdiendo grasa. Sigue así.'
  if (w.d <= -0.5) return 'La cintura baja y el peso se mantiene o sube: pierdes grasa y ganas músculo a la vez.'
  if (w.d >= 0.5 && k.d >= 0.3) return 'Suben la cintura y el peso: probablemente te sobran calorías. Revisa la dieta.'
  if (k.d <= -0.3) return 'Bajas de peso pero la cintura no se mueve: llega a la proteína para no perder músculo.'
  return 'Cintura y peso estables este último mes.'
}

const sign = (d) => (d > 0 ? '+' : d < 0 ? '−' : '±')

export default function BodyCard({ data, setData }) {
  const [modal, setModal] = useState(null)
  const waist = data.body?.waist || []
  const photos = data.body?.photos || []
  const last = waist[waist.length - 1]
  const first = waist[0]
  const diff = last && first && last.date !== first.date ? Math.round((last.cm - first.cm) * 10) / 10 : null
  const dueW = daysSince(last?.date) >= 7
  const dueP = daysSince(photos[photos.length - 1]?.date) >= 28
  const weights = data.body?.weight || []
  const wtAll = trend(weights)
  const wLast = wtAll[wtAll.length - 1]
  // solo medias completas (3 pesajes): comparar un pesaje suelto con una media daba cambios falsos
  const wt = wtAll.slice(2)
  const wDiff = wt.length >= 2 ? Math.round((wLast.v - wt[0].v) * 10) / 10 : null
  const dueK = weights.length > 0 && daysSince(weights[weights.length - 1].date) >= 7
  const [metric, setMetric] = useState(null)
  const m = metric || (waist.length < 2 && wt.length >= 2 ? 'weight' : 'waist')
  const read = bodyRead(waist, wt)
  const tile = (key, label, color, val, unit, d, since) => (
    <button className={'body-tile' + (m === key ? ' on' : '')} style={{ '--c': color }} onClick={() => setMetric(key)}>
      <div className="bt-l">
        <i /> {label}
      </div>
      <div className="bt-v">
        {val != null ? fmtKg(val) : '—'} <span>{unit}</span>
      </div>
      <div className={'bt-d ' + (d == null ? 'flat' : d < 0 ? 'up' : d > 0 ? 'down' : 'flat')}>
        {d == null ? (
          val == null ? 'Sin medidas' : key !== 'weight' ? 'Primera medida' : weights.length < 3 ? `Pesajes: ${weights.length} de 3` : 'Primera media'
        ) : (
          <>
            <b>
              {sign(d)}
              {fmtKg(Math.abs(d))} {unit}
            </b>{' '}
            <span>desde {fmtD(since)}</span>
          </>
        )}
      </div>
    </button>
  )
  return (
    <div className="card body-card">
      <div className="sec-head nm">
        <b>Tu cuerpo</b>
        <span className="muted small">cintura y tendencia</span>
      </div>
      {!last && !wLast ? (
        <p className="muted small" style={{ margin: '4px 0 10px' }}>
          Mide tu cintura una vez por semana: si baja, estás perdiendo grasa aunque la báscula no se mueva.
        </p>
      ) : (
        <>
          <div className="body-tiles">
            {tile('waist', 'Cintura', 'var(--accent)', last?.cm, 'cm', diff, first?.date)}
            {tile('weight', 'Peso (media)', 'var(--blue)', wLast?.v, 'kg', wDiff, wt[0]?.date)}
          </div>
          {m === 'waist' ? (
            <TrendChart
              key="waist"
              points={waist.map((w) => ({ label: w.date, v: w.cm }))}
              unit="cm"
              color="var(--accent)"
              good="down"
              empty="Mide la cintura otra semana y aquí verás cómo baja."
            />
          ) : (
            <TrendChart
              key="weight"
              points={wt.map((w) => ({ label: w.date, v: w.v }))}
              unit="kg"
              color="var(--blue)"
              good="down"
              empty={
                weights.length < 3
                  ? `La tendencia sale con 3 pesajes (llevas ${weights.length}). Uno por semana basta.`
                  : 'Con el próximo pesaje verás cómo va la tendencia.'
              }
            />
          )}
          {read && (
            <div className="body-read">
              <Icon name="trend" size={16} /> <span>{read}</span>
            </div>
          )}
        </>
      )}
      <div className="btns">
        <button className={'btn' + (dueW ? ' primary' : '')} onClick={() => setModal('waist')}>
          <Icon name="edit" size={15} /> {dueW ? 'Toca medir' : 'Cintura'}
        </button>
        <button className={'btn' + (dueK ? ' primary' : '')} onClick={() => setModal('weight')}>
          <Icon name="edit" size={15} /> {dueK ? 'Toca pesarte' : 'Peso'}
        </button>
        <button className={'btn' + (dueP ? ' primary' : '')} onClick={() => setModal('photos')}>
          <Icon name="camera" size={15} /> {dueP ? 'Toca foto' : `Fotos (${photos.length})`}
        </button>
      </div>
      {modal === 'waist' && <WaistModal data={data} setData={setData} onClose={() => setModal(null)} />}
      {modal === 'weight' && <WeightModal data={data} setData={setData} onClose={() => setModal(null)} />}
      {modal === 'photos' &&<PhotosModal data={data} setData={setData} onClose={() => setModal(null)} />}
    </div>
  )
}
