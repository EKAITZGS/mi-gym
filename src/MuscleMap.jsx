// Mapa muscular (frente y espalda): series efectivas, frecuencia y directas/indirectas por grupo, por semana o mes.
import { useMemo, useState } from 'react'
import Mannequin from './Mannequin'
import { groupsOf, RANK_GROUPS } from './ranks'
import { muscleLoad } from './stats'
import { fmtDate } from './store'

const RANGES = [
  { id: 'week', label: 'Esta semana', days: null },
  { id: '4w', label: '4 semanas', days: 28 },
  { id: 'month', label: 'Este mes', days: null },
]
// color por series efectivas: gris → lima
const tone = (n, max) => {
  if (!n) return null
  const k = Math.min(1, n / max)
  const l = 28 + k * 40 // luminosidad
  return `hsl(80 ${40 + k * 60}% ${l}%)`
}
export default function MuscleMap({ data }) {
  const [range, setRange] = useState('week')
  const from = useMemo(() => {
    const d = new Date()
    if (range === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    else if (range === 'month') d.setDate(1)
    else d.setDate(d.getDate() - 27)
    return fmtDate(d)
  }, [range])
  const load = useMemo(() => muscleLoad(data.sessions || [], from, groupsOf), [data.sessions, from])
  const weeks = range === 'week' ? 1 : range === '4w' ? 4 : Math.max(1, Math.ceil(new Date().getDate() / 7))
  const max = 20 * weeks
  const groups = Object.fromEntries(RANK_GROUPS.map((g) => [g, load[g]?.eff ? { rank: { color: tone(load[g].eff, max) } } : {}]))
  const any = Object.values(load).some((v) => v.eff)
  if (!data.sessions?.length) return null
  return (
    <div className="card">
      <div className="sec-head nm">
        <b>Mapa muscular</b>
        <div className="seg seg3" style={{ width: 'auto', margin: 0 }}>
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)} style={{ minHeight: 32, fontSize: 12, padding: '0 8px' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mm-wrap">
        <Mannequin groups={groups} />
      </div>
      <div className="mm-legend">
        <span><i style={{ background: '#3b4250' }} /> sin series</span>
        <span><i style={{ background: tone(max * 0.25, max) }} /> pocas</span>
        <span><i style={{ background: tone(max * 0.6, max) }} /> medias</span>
        <span><i style={{ background: tone(max, max) }} /> {max}+ series</span>
      </div>
      {!any && <p className="muted small">Sin series en este periodo.</p>}
      {any && (
        <div className="mm-list">
          {RANK_GROUPS.filter((g) => load[g]?.eff).sort((a, b) => load[b].eff - load[a].eff).map((g) => (
            <div key={g} className="mm-row">
              <i style={{ background: tone(load[g].eff, max) }} />
              <span className="grow">{g}</span>
              <span className="muted small">{load[g].direct} directas{load[g].indirect ? ` + ${load[g].indirect} indirectas` : ''}</span>
              <b>{load[g].eff}</b>
              <span className="badge">{load[g].freq}×</span>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">
        Método: series de trabajo (sin calentamientos) con repeticiones apuntadas. Las que tocan un músculo de rebote (el press suma a tríceps y hombro) cuentan la mitad y se enseñan aparte; «×» = días distintos. Referencia habitual: 10-20 efectivas por músculo y semana, pero depende de ti.
      </p>
    </div>
  )
}
