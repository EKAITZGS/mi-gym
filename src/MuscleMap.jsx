// Mapa muscular (frente y espalda): series efectivas, frecuencia y directas/indirectas por grupo, por semana o mes.
// Tocar un músculo (en el maniquí o en la lista) abre su detalle: series, días, última vez y ejercicios.
import { useMemo, useState } from 'react'
import Mannequin from './Mannequin'
import { groupsOf, RANK_GROUPS } from './ranks'
import { muscleLoad } from './stats'
import { fmtDate, workSets, num } from './store'
import { EX_BY_ID } from './data/exercises'
import { Segmented, IconButton } from './ds'
import Icon from './icons'

const RANGES = [
  { v: 'week', label: 'Esta semana' },
  { v: '4w', label: '4 semanas' },
  { v: 'month', label: 'Este mes' },
]
// color por series efectivas: gris → lima
const tone = (n, max) => {
  if (!n) return null
  const k = Math.min(1, n / max)
  const l = 28 + k * 40 // luminosidad
  return `hsl(80 ${40 + k * 60}% ${l}%)`
}
const done = (x) => num(x.r) > 0 || x.s || x.m
const fmtD = (s) => `${Number(s.slice(8))}/${Number(s.slice(5, 7))}`

export default function MuscleMap({ data }) {
  const [range, setRange] = useState('week')
  const [sel, setSel] = useState(null)
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
  // detalle del músculo elegido: ejercicios del periodo (directo o de rebote) y la última vez que se entrenó
  const detail = useMemo(() => {
    if (!sel) return null
    const ex = {}
    let last = null
    for (const s of data.sessions || []) {
      for (const [id, sets] of Object.entries(s.entries || {})) {
        const n = workSets(sets).filter(done).length
        if (!n) continue
        const hit = groupsOf(id).find((x) => x.g === sel)
        if (!hit) continue
        if (!last || s.date > last) last = s.date
        if (s.date < from) continue
        const o = (ex[id] ??= { id, n: 0, main: hit.main })
        o.n += n
      }
    }
    return { last, list: Object.values(ex).sort((a, b) => b.main - a.main || b.n - a.n) }
  }, [sel, data.sessions, from])
  if (!data.sessions?.length) return null
  const L = sel ? load[sel] : null
  const rangeTxt = RANGES.find((r) => r.v === range).label.toLowerCase()
  return (
    <div className="card mm-card">
      <div className="card-h">
        <Icon name="user" size={16} />
        <h3>Mapa muscular</h3>
        <span className="card-aside">toca un músculo</span>
      </div>
      <Segmented label="Periodo" value={range} options={RANGES} onChange={(v) => setRange(v)} className="seg-sm" />
      <div className="mm-wrap">
        <Mannequin groups={groups} onPick={setSel} picked={sel} />
      </div>
      <div className="mm-legend">
        <span><i className="mm-empty-dot" /> sin series</span>
        <span><i style={{ background: tone(max * 0.25, max) }} /> pocas</span>
        <span><i style={{ background: tone(max * 0.6, max) }} /> medias</span>
        <span><i style={{ background: tone(max, max) }} /> {max}+ series</span>
      </div>
      {sel && (
        <div className="mm-detail" role="region" aria-label={`Detalle de ${sel}`}>
          <div className="mm-detail-h">
            <b>{sel}</b>
            <span className="muted small">{rangeTxt}</span>
            <IconButton icon="x" label="Cerrar detalle" ghost size={15} onClick={() => setSel(null)} />
          </div>
          <div className="mm-stats">
            <div>
              <b>{L?.eff || 0}</b>
              <span>series efectivas</span>
            </div>
            <div>
              <b>{L?.direct || 0}</b>
              <span>directas</span>
            </div>
            <div>
              <b>{L?.indirect || 0}</b>
              <span>de rebote</span>
            </div>
            <div>
              <b>{L?.freq || 0}</b>
              <span>{L?.freq === 1 ? 'día' : 'días'}</span>
            </div>
          </div>
          <p className="muted small mo-b2">
            {detail?.last ? `Última vez que lo entrenaste: ${fmtD(detail.last)}.` : 'Todavía no has entrenado este músculo.'}
          </p>
          {detail?.list.length > 0 ? (
            detail.list.map((x) => (
              <div className="mm-ex" key={x.id}>
                <span className="grow">{EX_BY_ID[x.id]?.name || 'Ejercicio propio'}</span>
                <span className={'badge' + (x.main ? ' accent' : '')}>{x.main ? 'directo' : 'de rebote'}</span>
                <b>{x.n}</b>
              </div>
            ))
          ) : (
            <p className="muted small m-0">Sin series en este periodo.</p>
          )}
          <p className="muted small mm-honest">Es lo que has entrenado, no cuánto músculo tienes.</p>
        </div>
      )}
      {!any && <p className="muted small">Sin series en este periodo.</p>}
      {any && (
        <div className="mm-list">
          {RANK_GROUPS.filter((g) => load[g]?.eff)
            .sort((a, b) => load[b].eff - load[a].eff)
            .map((g) => (
              <button type="button" key={g} className={'mm-row' + (sel === g ? ' on' : '')} onClick={() => setSel(sel === g ? null : g)} aria-expanded={sel === g}>
                <i style={{ background: tone(load[g].eff, max) }} />
                <span className="grow">{g}</span>
                <span className="muted small">
                  {load[g].direct} directas{load[g].indirect ? ` + ${load[g].indirect} indirectas` : ''}
                </span>
                <b>{load[g].eff}</b>
                <span className="badge">{load[g].freq}×</span>
              </button>
            ))}
        </div>
      )}
      <details className="tech-d">
        <summary>¿Cómo se calcula?</summary>
        <p>Series de trabajo (sin calentamientos) con repeticiones apuntadas. Las que tocan un músculo de rebote (el press suma a tríceps y hombro) cuentan la mitad y se enseñan aparte; «×» = días distintos. Referencia habitual: 10-20 efectivas por músculo y semana, pero depende de ti.</p>
      </details>
    </div>
  )
}
