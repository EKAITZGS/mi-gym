import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './icons'

export function Modal({ title, onClose, children }) {
  const tid = useId()
  const ref = useRef(null)
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.body.classList.add('modal-open')
    // accesibilidad: foco dentro de la ventana y Escape para cerrar
    const prev = document.activeElement
    ref.current?.focus({ preventScroll: true })
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      try { prev?.focus?.({ preventScroll: true }) } catch {}
      document.body.style.overflow = ''
      // otra ventana puede seguir abierta (se abren encadenadas)
      setTimeout(() => {
        if (!document.querySelector('.overlay')) document.body.classList.remove('modal-open')
      }, 0)
    }
  }, [])
  // Portal al <body>: en Safari iOS el contenedor con scroll atrapa los position:fixed
  // y la barra inferior quedaba por encima de la ventana.
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={tid} tabIndex={-1} ref={ref}>
        <div className="grabber" />
        <div className="sheet-head">
          <h3 id={tid}>{title}</h3>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function Thumb({ ex, size = 48 }) {
  const style = { width: size, height: size }
  return ex?.imgs?.[0] ? (
    <img className="thumb" style={style} src={ex.imgs[1] || ex.imgs[0]} alt="" loading="lazy" decoding="async" />
  ) : (
    <div className="thumb empty" style={style}>
      <Icon name="dumbbell" size={size * 0.45} />
    </div>
  )
}

// Foto del ejercicio que alterna posición inicial ↔ final
export function ExPhoto({ ex, className = '' }) {
  const [f, setF] = useState(0)
  const n = ex?.imgs?.length || 0
  useEffect(() => {
    if (n < 2) return
    const t = setInterval(() => setF((x) => (x + 1) % n), 1300)
    return () => clearInterval(t)
  }, [n])
  if (!n)
    return (
      <div className={'exphoto empty ' + className}>
        <Icon name="dumbbell" size={40} />
      </div>
    )
  return (
    <div className={'exphoto ' + className}>
      {ex.imgs.map((s, i) => (
        <img key={s} src={s} alt={ex.name} className={i === f ? 'on' : ''} decoding="async" />
      ))}
      {n > 1 && (
        <div className="frames">
          {ex.imgs.map((_, i) => (
            <span key={i} className={i === f ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Bar({ value, max, color = 'var(--accent)' }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))
  return (
    <div className="bar">
      <div className="bar-fill" style={{ width: pct + '%', background: value > max ? 'var(--warn)' : color }} />
    </div>
  )
}

// Anillo de progreso
export function Ring({ value, max, size = 132, stroke = 12, color = 'var(--accent)', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, max ? value / max : 0))
  const over = value > max
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--track)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? 'var(--warn)' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-prog"
          style={{ transition: 'stroke-dashoffset .6s ease', '--c': c }}
        />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  )
}

// ---- Gráficas de evolución (cintura, peso, fuerza) ----
const DAY = 864e5
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dLabel = (s) => `${+s.slice(8)} ${MES[+s.slice(5, 7) - 1]}`
const fmtN = (v, dec) => {
  const d = dec ?? (Math.abs(v) >= 100 ? 0 : 1)
  return (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('es-ES', { maximumFractionDigits: d })
}
// paso "bonito" para el eje: 1, 2, 2,5 o 5 × 10^n
const niceStep = (raw) => {
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}
// curva suave que no se pasa de los puntos (monótona, Fritsch–Carlson)
const smoothPath = (P) => {
  const n = P.length
  if (n < 3) return P.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const dx = [], m = [], t = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = P[i + 1][0] - P[i][0] || 1e-6
    m[i] = (P[i + 1][1] - P[i][1]) / dx[i]
  }
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i])
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${(P[i][0] + h).toFixed(1)},${(P[i][1] + t[i] * h).toFixed(1)} ${(P[i + 1][0] - h).toFixed(1)},${(P[i + 1][1] - t[i + 1] * h).toFixed(1)} ${P[i + 1][0].toFixed(1)},${P[i + 1][1].toFixed(1)}`
  }
  return d
}
const RANGES = [
  { k: '1M', d: 31 },
  { k: '3M', d: 92 },
  { k: '6M', d: 183 },
  { k: 'Año', d: 366 },
]

// points: [{ label: 'AAAA-MM-DD', v }] ordenados. good: 'up' | 'down' (qué dirección es buena).
export function TrendChart({ points, unit = 'kg', color = 'var(--accent)', good = 'up', dec, title, empty }) {
  const gid = useId().replace(/:/g, '')
  const [sel, setSel] = useState(null)
  const [range, setRange] = useState(null)
  if (points.length < 2)
    return (
      <div className="chart-empty">
        <Icon name="trend" size={22} />
        <span>{empty || 'Haz al menos 2 entrenos con este ejercicio para ver la gráfica.'}</span>
      </div>
    )
  const tLast = Date.parse(points[points.length - 1].label)
  const spanAll = (tLast - Date.parse(points[0].label)) / DAY
  const opts = RANGES.filter((r) => spanAll > r.d * 1.15)
  const rk = range && (range === 'Todo' || opts.some((o) => o.k === range)) ? range : spanAll > 120 && opts.length ? '3M' : 'Todo'
  const rd = RANGES.find((r) => r.k === rk)?.d
  let pts = rd ? points.filter((p) => Date.parse(p.label) >= tLast - rd * DAY) : points
  if (pts.length < 2) pts = points.slice(-2)
  const n = pts.length

  const W = 340, H = 196, L = 40, R = 14, T = 18, B = 28
  const t0 = Date.parse(pts[0].label)
  const span = Math.max(DAY, tLast - t0)
  const vs = pts.map((p) => p.v)
  let mn = Math.min(...vs), mx = Math.max(...vs)
  const pad = Math.max((mx - mn) * 0.12, Math.abs(mx) * 0.004, 0.2)
  mn -= pad
  mx += pad
  const step = niceStep((mx - mn) / 3)
  const lo = Math.floor(mn / step) * step
  const hi = Math.ceil(mx / step) * step
  const tdec = Number.isInteger(step) ? 0 : Number.isInteger(Math.round(step * 1e6) / 1e5) ? 1 : 2
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v)
  const x = (lab) => L + ((Date.parse(lab) - t0) / span) * (W - L - R)
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo))
  const P = pts.map((p) => [x(p.label), y(p.v)])
  const line = smoothPath(P)
  const area = `${line} L${P[n - 1][0].toFixed(1)},${H - B} L${P[0][0].toFixed(1)},${H - B} Z`
  // fechas del eje: inicio, fin y 1–2 intermedias sin pisarse
  const nx = Math.min(4, Math.max(2, Math.round(span / DAY) + 1))
  const xt = Array.from({ length: nx }, (_, k) => new Date(t0 + (span * k) / (nx - 1)).toISOString().slice(0, 10))

  const ai = sel != null && sel < n ? sel : n - 1
  const ap = pts[ai]
  const d0 = Math.round((ap.v - pts[0].v) * 10) / 10
  const days = Math.round((Date.parse(ap.label) - t0) / DAY)
  const ok = d0 === 0 ? null : (d0 < 0) === (good === 'down')
  const perWeek = days >= 14 ? (d0 / days) * 7 : null

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(P[i][0] - px) < Math.abs(P[best][0] - px)) best = i
    setSel(best)
  }
  const key = `${rk}-${n}-${pts[0].label}-${Math.round(pts[n - 1].v * 100)}`
  return (
    <div className="chart-wrap tc" style={{ '--c': color }}>
      <div className="tc-head">
        <div>
          {title && <div className="tc-title">{title}</div>}
          <div className="tc-val">
            {fmtN(ap.v, dec)} <span>{unit}</span>
          </div>
          <div className="tc-sub">
            {dLabel(ap.label)}
            {ai === n - 1 ? ' · último' : ''}
          </div>
        </div>
        {ai > 0 && (
          <div className="tc-delta">
            <span className={'delta ' + (ok == null ? 'flat' : ok ? 'up' : 'down')}>
              {d0 > 0 ? '+' : d0 < 0 ? '−' : '±'}
              {fmtN(Math.abs(d0), dec)} {unit}
            </span>
            <span className="tc-sub">
              {days ? `en ${days} día${days === 1 ? '' : 's'}` : ''}
              {perWeek != null && Math.abs(perWeek) >= 0.05 ? ` · ${perWeek > 0 ? '+' : '−'}${fmtN(Math.abs(perWeek), 1)} ${unit}/sem` : ''}
            </span>
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart tc-svg"
        role="img"
        aria-label={`Gráfica de ${title || 'progreso'}`}
        onPointerDown={pick}
        onPointerMove={(e) => (e.buttons || e.pointerType === 'touch') && pick(e)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={i ? 'tc-grid' : 'tc-base'} />
            <text x={L - 7} y={y(t) + 3.5} textAnchor="end" className="ct">
              {fmtN(t, tdec)}
            </text>
          </g>
        ))}
        {xt.map((d, i) => (
          <text key={d + i} x={x(d)} y={H - 8} textAnchor={i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'} className="ct">
            {dLabel(d)}
          </text>
        ))}
        <path key={'a' + key} d={area} fill={`url(#${gid})`} className="tc-area" />
        <path key={'l' + key} d={line} pathLength="1" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="tc-line" />
        <line x1={P[ai][0]} x2={P[ai][0]} y1={T - 6} y2={H - B} className="tc-guide" />
        {n <= 24 && P.map((p, i) => i !== ai && <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} className="tc-dot" />)}
        {ai === n - 1 && <circle cx={P[ai][0]} cy={P[ai][1]} r="10" fill={color} className="tc-halo" />}
        <circle cx={P[ai][0]} cy={P[ai][1]} r="6" fill="var(--bg2)" stroke={color} strokeWidth="3" />
        <rect x="0" y="0" width={W} height={H} fill="transparent" />
      </svg>
      {opts.length > 0 && (
        <div className="tc-ranges">
          {[...opts.map((o) => o.k), 'Todo'].map((k) => (
            <button key={k} className={'tc-r' + (k === rk ? ' on' : '')} onClick={() => (setRange(k), setSel(null))}>
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// compatibilidad: la gráfica de fuerza de cada ejercicio
export function LineChart({ points, unit = 'kg' }) {
  return <TrendChart points={points} unit={unit} good="up" />
}
