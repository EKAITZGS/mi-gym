import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './icons'

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.body.classList.add('modal-open')
    return () => {
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
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <h3>{title}</h3>
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

export function LineChart({ points, unit = 'kg' }) {
  const gid = useId().replace(/:/g, '')
  const [sel, setSel] = useState(null)
  if (points.length < 2)
    return (
      <div className="chart-empty">
        <Icon name="trend" size={22} />
        <span>Haz al menos 2 entrenos con este ejercicio para ver la gráfica.</span>
      </div>
    )
  const W = 340
  const H = 180
  const L = 38
  const R = 14
  const T = 16
  const B = 26
  const vs = points.map((p) => p.v)
  let min = Math.min(...vs)
  let max = Math.max(...vs)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.15
  const lo = Math.max(0, min - pad)
  const hi = max + pad
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1)
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo))
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1)},${H - B} L${x(0)},${H - B} Z`
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3)
  const fmtD = (s) => {
    const [, m, dd] = s.split('-')
    return `${dd}/${m}`
  }
  const active = sel ?? points.length - 1
  const ap = points[active]
  return (
    <div className="chart-wrap">
      <div className="chart-head">
        <b>
          {String(Math.round(ap.v * 10) / 10).replace('.', ',')} {unit}
        </b>
        <span className="muted small">{fmtD(ap.label)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Gráfica de progreso">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={i ? '3 4' : ''} />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="ct">
              {hi - lo < 6 ? String(Math.round(t * 10) / 10).replace('.', ',') : Math.round(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={x(active)} x2={x(active)} y1={T} y2={H - B} stroke="var(--accent)" strokeOpacity=".35" />
        {points.map((p, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(p.v)} r="12" fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(p.v)}
              r={i === active ? 5.5 : 3.5}
              fill={i === active ? 'var(--bg)' : 'var(--accent)'}
              stroke="var(--accent)"
              strokeWidth={i === active ? 3 : 0}
            />
          </g>
        ))}
        <text x={L} y={H - 6} className="ct">
          {fmtD(points[0].label)}
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" className="ct">
          {fmtD(points[points.length - 1].label)}
        </text>
      </svg>
    </div>
  )
}
