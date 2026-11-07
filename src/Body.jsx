import { useEffect, useRef, useState } from 'react'
import { Modal, LineChart } from './ui'
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

// Cintura y peso (tendencia) en una sola gráfica: se dibuja el cambio desde el inicio, así no se ven pesos sueltos
function BodyChart({ waist, weight }) {
  const W = 340
  const H = 170
  const L = 34
  const R = 12
  const T = 12
  const B = 24
  const a = waist.map((p) => ({ date: p.date, d: Math.round((p.cm - waist[0].cm) * 10) / 10 }))
  const b = weight.map((p) => ({ date: p.date, d: Math.round((p.v - weight[0].v) * 10) / 10 }))
  const dates = [...a, ...b].map((p) => p.date).sort()
  const t0 = Date.parse(dates[0])
  const span = Math.max(1, Date.parse(dates[dates.length - 1]) - t0)
  const vs = [...a, ...b].map((p) => p.d)
  let min = Math.min(0, ...vs)
  let max = Math.max(0, ...vs)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.15
  min -= pad
  max += pad
  const x = (s) => L + ((Date.parse(s) - t0) / span) * (W - L - R)
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min))
  const path = (s) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.d).toFixed(1)}`).join(' ')
  const ticks = [min, (min + max) / 2, max]
  return (
    <div className="chart-wrap">
      <div className="chart-head" style={{ flexWrap: 'wrap', gap: 12 }}>
        <span className="small" style={{ color: 'var(--accent)' }}>● Cintura (cm)</span>
        <span className="small" style={{ color: 'var(--blue)' }}>● Peso, tendencia (kg)</span>
        <span className="muted small">cambio desde el inicio</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Cambio de cintura y de peso">
        {ticks.map((v, k) => (
          <text key={k} x={L - 6} y={y(v) + 3} textAnchor="end" className="ct">
            {(Math.round(v * 10) / 10).toString().replace('.', ',')}
          </text>
        ))}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="4 4" />
        <path d={path(a)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path(b)} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <text x={L} y={H - 6} className="ct">{fmtD(dates[0])}</text>
        <text x={W - R} y={H - 6} textAnchor="end" className="ct">{fmtD(dates[dates.length - 1])}</text>
      </svg>
    </div>
  )
}

export default function BodyCard({ data, setData }) {
  const [modal, setModal] = useState(null)
  const waist = data.body?.waist || []
  const photos = data.body?.photos || []
  const last = waist[waist.length - 1]
  const first = waist[0]
  const diff = last && first && last.date !== first.date ? Math.round((last.cm - first.cm) * 10) / 10 : null
  const dueW = daysSince(last?.date) >= 7
  const dueP = daysSince(photos[photos.length - 1]?.date) >= 28
  const recent = waist.filter((w) => w.date >= addDays(todayStr(), -120))
  const weights = data.body?.weight || []
  const wt = trend(weights)
  const wLast = wt[wt.length - 1]
  const wDiff = wt.length >= 2 ? Math.round((wLast.v - wt[0].v) * 10) / 10 : null
  const dueK = weights.length > 0 && daysSince(weights[weights.length - 1].date) >= 7
  const wRecent = wt.filter((w) => w.date >= addDays(todayStr(), -120))
  const both = recent.length >= 2 && wRecent.length >= 2
  return (
    <div className="card body-card">
      <div className="sec-head nm">
        <b>Tu cuerpo</b>
        <span className="muted small">cintura y tendencia</span>
      </div>
      <div className="body-row">
        <div className="grow">
          {last ? (
            <>
              <div className="body-num">
                {fmtKg(last.cm)} <span>cm de cintura</span>
              </div>
              {diff != null && (
                <div className={'delta ' + (diff <= 0 ? 'up' : 'down')}>
                  {diff > 0 ? '+' : ''}
                  {fmtKg(diff)} cm desde el {fmtD(first.date)}
                </div>
              )}
            </>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              Mide tu cintura una vez por semana: si baja, estás perdiendo grasa aunque la báscula no se mueva.
            </p>
          )}
        </div>
      </div>
      {!both && recent.length >= 2 && <LineChart points={recent.map((w) => ({ label: w.date, v: w.cm }))} unit="cm" />}
      {wLast && (
        <div className="body-row">
          <div className="grow">
            <div className="body-num">
              {fmtKg(wLast.v)} <span>kg de media (tendencia)</span>
            </div>
            {wDiff != null && (
              <div className={'delta ' + (wDiff <= 0 ? 'up' : 'down')}>
                {wDiff > 0 ? '+' : ''}
                {fmtKg(wDiff)} kg desde el {fmtD(wt[0].date)}
              </div>
            )}
          </div>
        </div>
      )}
      {!both && wRecent.length >= 2 && <LineChart points={wRecent.map((w) => ({ label: w.date, v: w.v }))} unit="kg" />}
      {both && <BodyChart waist={recent} weight={wRecent} />}
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
