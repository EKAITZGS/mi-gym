import { useId } from 'react'
import { Modal } from './ui'

const ZONE_NAMES = ['Muy suave', 'Suave', 'Moderado', 'Intenso', 'Máximo']
const ZONE_COLORS = ['#7b8494', '#4ea8ff', '#3ee08f', '#ffb547', '#ff5d6c']

const fmtMin = (s) => {
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

// Picos de pulso separados al menos 60 s: en pesas suelen coincidir con las series duras
export function hrPeaks(hr) {
  if (!hr?.v?.length) return 0
  const v = hr.v.filter((n) => n > 0)
  const avg = v.reduce((a, b) => a + b, 0) / v.length
  const gap = Math.max(1, Math.round(60 / hr.step))
  let peaks = 0
  let last = -gap
  for (let i = 1; i < hr.v.length - 1; i++) {
    const n = hr.v[i]
    if (n > avg + 12 && n >= hr.v[i - 1] && n >= hr.v[i + 1] && i - last >= gap) {
      peaks++
      last = i
    }
  }
  return peaks
}

// Valoración del esfuerzo con el pulso (orientativa: en pesas manda más el RIR)
export function polarVerdict(e) {
  const tips = []
  const total = (e.zones || []).reduce((a, z) => a + z.s, 0)
  const pct = (idx) => (total ? (e.zones || []).filter((z) => idx.includes(z.i)).reduce((a, z) => a + z.s, 0) / total : 0)
  const hard = pct([4, 5])
  const mid = pct([3])
  const max = e.zones?.length ? e.zones[e.zones.length - 1].hi : 200
  const rel = e.hrAvg ? e.hrAvg / max : null
  if (total && hard > 0.35) {
    tips.push({ tone: 'yellow', text: 'Sesión muy intensa: mucho rato en zonas altas. Está bien de vez en cuando, pero mañana prioriza dormir y comer bien.' })
  } else if ((rel != null && rel < 0.6 && hard < 0.05) || (total && hard + mid < 0.1)) {
    tips.push({ tone: 'yellow', text: 'Sesión suave: el pulso estuvo bajo casi todo el rato. Si querías apretar, acorta los descansos a 60–90 s o lleva la última serie más cerca del fallo.' })
  } else if (e.hrAvg) {
    tips.push({ tone: 'green', text: 'Buen esfuerzo: subidas en las series y recuperación entre ellas, justo lo que buscas en pesas.' })
  }
  if (e.min > 100) tips.push({ tone: 'yellow', text: `Has estado ${e.min} min. Con 60–75 min bien aprovechados es suficiente; más tiempo no da más músculo.` })
  return tips
}

function HrChart({ hr, zones }) {
  const gid = useId().replace(/:/g, '')
  const v = hr.v
  const W = 340
  const H = 170
  const L = 34
  const R = 10
  const T = 12
  const B = 24
  const vals = v.filter((n) => n > 0)
  const lo = Math.max(40, Math.floor((Math.min(...vals) - 10) / 10) * 10)
  const hi = Math.ceil((Math.max(...vals) + 8) / 10) * 10
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, v.length - 1)
  const y = (n) => T + (H - T - B) * (1 - (n - lo) / (hi - lo))
  let d = ''
  v.forEach((n, i) => {
    if (n <= 0) return
    d += `${d && v[i - 1] > 0 ? 'L' : 'M'}${x(i).toFixed(1)},${y(n).toFixed(1)}`
  })
  const totalMin = Math.round((v.length * hr.step) / 60)
  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, m: Math.round(totalMin * f) }))
  const bands = (zones || []).filter((z) => z.hi > lo && z.lo < hi)
  return (
    <svg className="hr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pulso durante el entreno">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5d6c" />
          <stop offset="1" stopColor="#ffb547" />
        </linearGradient>
      </defs>
      {bands.map((z) => (
        <rect
          key={z.i}
          x={L}
          width={W - L - R}
          y={y(Math.min(hi, z.hi))}
          height={Math.max(0, y(Math.max(lo, z.lo)) - y(Math.min(hi, z.hi)))}
          fill={ZONE_COLORS[z.i - 1] || '#555'}
          opacity="0.08"
        />
      ))}
      {[0, 1, 2, 3].map((k) => {
        const n = lo + ((hi - lo) * k) / 3
        return (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(n)} y2={y(n)} stroke="currentColor" opacity="0.08" />
            <text x={L - 6} y={y(n) + 4} textAnchor="end" className="ax">
              {Math.round(n)}
            </text>
          </g>
        )
      })}
      {xt.map((t) => (
        <text key={t.f} x={L + t.f * (W - L - R)} y={H - 6} textAnchor={t.f === 0 ? 'start' : t.f === 1 ? 'end' : 'middle'} className="ax">
          {t.m}′
        </text>
      ))}
      <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function PolarSession({ ex: raw, onClose }) {
  const ex = raw.zones?.length ? { ...raw, zones: [...raw.zones].sort((a, b) => a.lo - b.lo).map((z, k) => ({ ...z, i: k + 1 })) } : raw
  const total = (ex.zones || []).reduce((a, z) => a + z.s, 0)
  const peaks = hrPeaks(ex.hr)
  const tips = polarVerdict(ex)
  return (
    <Modal title={`${ex.sport} · ${ex.min} min`} onClose={onClose}>
      <div className="polar-sum">
        <div><b>{ex.kcal}</b><span>kcal</span></div>
        {ex.hrAvg && <div><b>{ex.hrAvg}</b><span>ppm media</span></div>}
        {ex.hrMax && <div><b>{ex.hrMax}</b><span>ppm máx.</span></div>}
        {peaks > 0 && <div><b>{peaks}</b><span>picos</span></div>}
      </div>

      <h4>Pulso durante el entreno</h4>
      {ex.hr ? (
        <HrChart hr={ex.hr} zones={ex.zones} />
      ) : (
        <p className="muted small">La curva de pulso aparecerá en los entrenos que sincronices a partir de ahora.</p>
      )}

      {total > 0 && (
        <>
          <h4>Tiempo en cada zona</h4>
          {ex.zones.map((z) => (
            <div className="zone-row" key={z.i}>
              <span className="zone-n">
                <i style={{ background: ZONE_COLORS[z.i - 1] }} />
                {ZONE_NAMES[z.i - 1] || `Zona ${z.i}`}
                <em>
                  {z.lo}–{z.hi}
                </em>
              </span>
              <span className="zone-bar">
                <span style={{ width: `${Math.round((z.s / total) * 100)}%`, background: ZONE_COLORS[z.i - 1] }} />
              </span>
              <span className="zone-t">{fmtMin(z.s)}</span>
            </div>
          ))}
        </>
      )}

      {tips.length > 0 && (
        <>
          <h4>Valoración</h4>
          {tips.map((t, i) => (
            <div key={i} className={'advice ' + t.tone}>
              {t.text}
            </div>
          ))}
        </>
      )}
      <p className="muted small">
        En pesas el pulso orienta pero no lo es todo: el esfuerzo real de cada serie lo marcan las repeticiones que te quedaban en reserva.
      </p>
    </Modal>
  )
}
