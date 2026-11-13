import { useId } from 'react'
import { Modal } from './ui'
import { groupsOf } from './ranks'

const ZONE_NAMES = ['Muy suave', 'Suave', 'Moderado', 'Intenso', 'Máximo']
const ZONE_COLORS = ['#7b8494', '#4ea8ff', '#a3ff12', '#ffb547', '#ff5d6c']

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

// ---- Pulso según lo que entrenaste ----
// Un día de pierna sube mucho más el pulso que uno de brazo: se compara con lo normal para ese tipo de día
// y, con 3 o más entrenos parecidos, con tu propia media.
const SIZE = { Pierna: 'pierna', Espalda: 'torso', Pecho: 'torso', Hombro: 'torso', Core: 'torso', 'Bíceps': 'brazo', 'Tríceps': 'brazo', Antebrazo: 'brazo' }
const CENTER = { pierna: 0.68, mixto: 0.65, torso: 0.62, brazo: 0.58 } // pulso medio esperado / pulso máximo
const KIND_TXT = { pierna: 'pierna', brazo: 'brazo', torso: 'torso', mixto: 'cuerpo completo' }

export function sessionKind(session) {
  const w = {}
  const mainW = {} // solo el músculo principal de cada ejercicio, para el nombre del día
  let sets = 0
  for (const [id, list] of Object.entries(session?.entries || {})) {
    const n = (list || []).length
    const gs = groupsOf(id)
    if (!n || !gs.length) continue
    sets += n
    for (const { g, main } of gs) w[g] = (w[g] || 0) + n * (main ? 1 : 0.35)
    mainW[gs[0].g] = (mainW[gs[0].g] || 0) + n
  }
  if (!sets) return null
  const tot = Object.values(w).reduce((a, b) => a + b, 0)
  const share = (k) => Object.entries(w).filter(([g]) => SIZE[g] === k).reduce((a, [, v]) => a + v, 0) / tot
  const kind = share('pierna') >= 0.45 ? 'pierna' : share('brazo') >= 0.5 ? 'brazo' : share('pierna') >= 0.2 ? 'mixto' : 'torso'
  const top = Object.entries(mainW)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v], i) => i === 0 || (i === 1 && v / sets >= 0.25))
    .map(([g]) => g.toLowerCase())
  return { kind, sets, label: kind === 'mixto' ? 'cuerpo completo' : top.join(' y ') }
}

const sessionOn = (data, date) =>
  (data?.sessions || [])
    .filter((s) => s.date === date)
    .map((s) => ({ s, k: sessionKind(s) }))
    .filter((x) => x.k)
    .sort((a, b) => b.k.sets - a.k.sets)[0]

function strengthTips(e, data) {
  const cur = sessionOn(data, e.date)
  if (!cur || !e.hrAvg) return null
  const k = cur.k
  const max = e.zones?.length ? Math.max(...e.zones.map((z) => z.hi || 0)) || 200 : 200
  const past = Object.values(data.polar?.exercises || {})
    .filter((x) => x.id !== e.id && x.date < e.date && x.hrAvg)
    .map((x) => {
      const o = sessionOn(data, x.date)
      return o && o.k.kind === k.kind ? { hr: x.hrAvg, sets: o.k.sets, mps: x.min / o.k.sets } : null
    })
    .filter(Boolean)
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const day = `un día de ${k.label}`
  let level
  let base = null
  if (past.length >= 3) {
    base = Math.round(avg(past.map((p) => p.hr)))
    const d = (e.hrAvg - base) / base
    level = d < -0.12 ? 'low' : d > 0.08 ? 'high' : 'ok'
  } else {
    const rel = e.hrAvg / max
    const c = CENTER[k.kind]
    level = rel < c - 0.1 ? 'low' : rel > c + 0.06 ? 'high' : 'ok'
  }
  const vs = base ? ` (tu media en días de ${KIND_TXT[k.kind]}: ${base})` : ''
  const tips = []
  if (level === 'high')
    tips.push({ tone: 'green', text: `Media de ${e.hrAvg} ppm: alta para ${day}${vs}. Has ido a buen ritmo.` })
  else if (level === 'ok') tips.push({ tone: 'green', text: `Media de ${e.hrAvg} ppm: normal para ${day}${vs}.` })
  else {
    // ¿descansaste más o hiciste menos? Se mira con tus entrenos parecidos
    let why = 'descansos largos o poca intensidad. Acorta los descansos a 60–90 s o lleva la última serie más cerca del fallo.'
    if (past.length >= 2) {
      const uSets = avg(past.map((p) => p.sets))
      const uMps = avg(past.map((p) => p.mps))
      const mps = e.min / k.sets
      if (k.sets < uSets * 0.8) why = `hiciste menos series de lo normal (${k.sets} frente a ~${Math.round(uSets)}): día flojo.`
      else if (mps > uMps * 1.2)
        why = `hiciste tus series, pero tardaste ${String(Math.round(mps * 10) / 10).replace('.', ',')} min por serie frente a ~${String(Math.round(uMps * 10) / 10).replace('.', ',')}: descansaste más de lo normal.`
    }
    tips.push({ tone: 'yellow', text: `Media de ${e.hrAvg} ppm: muy baja para ${day}${vs}. Seguramente ${why}` })
  }
  return { tips, k }
}

// Valoración del esfuerzo con el pulso (orientativa: en pesas manda más el RIR)
export function polarVerdict(e, data) {
  const st = data && strengthTips(e, data)
  if (st) {
    const total = (e.zones || []).reduce((a, z) => a + z.s, 0)
    const hard = total ? (e.zones || []).filter((z) => [4, 5].includes(z.i)).reduce((a, z) => a + z.s, 0) / total : 0
    const tips = [...st.tips]
    if (hard > 0.35) tips.push({ tone: 'yellow', text: 'Mucho rato en zonas altas: mañana prioriza dormir y comer bien.' })
    if (e.min > 100) tips.push({ tone: 'yellow', text: `Has estado ${e.min} min. Con 60–75 min bien aprovechados es suficiente; más tiempo no da más músculo.` })
    return tips
  }
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

export default function PolarSession({ ex: raw, data, onClose }) {
  const ex = raw.zones?.length ? { ...raw, zones: [...raw.zones].sort((a, b) => a.lo - b.lo).map((z, k) => ({ ...z, i: k + 1 })) } : raw
  const total = (ex.zones || []).reduce((a, z) => a + z.s, 0)
  const peaks = hrPeaks(ex.hr)
  const tips = polarVerdict(ex, data)
  const kind = data ? sessionOn(data, ex.date)?.k : null
  return (
    <Modal title={`${ex.sport} · ${ex.min} min`} onClose={onClose}>
      <div className="polar-sum">
        <div><b>{ex.kcal}</b><span>kcal</span></div>
        {ex.hrAvg && <div><b>{ex.hrAvg}</b><span>ppm media</span></div>}
        {ex.hrMax && <div><b>{ex.hrMax}</b><span>ppm máx.</span></div>}
        {peaks > 0 && <div><b>{peaks}</b><span>picos</span></div>}
      </div>

      {kind && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Día de {kind.label} · {kind.sets} series apuntadas
        </p>
      )}
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
