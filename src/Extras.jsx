import { FOODS } from './data/foods'
import { kcalGoal } from './energy'
import { RANK_GROUPS, groupsOf } from './ranks'
import { dayTotals, todayStr, uid, fmtDate } from './store'

const FOOD = Object.fromEntries(FOODS.map((f) => [f.id, f]))

// Raciones típicas ricas en proteína (se usan para proponer cómo completar el día)
const OPTIONS = [
  { id: 'f-skyr', grams: 250, label: '250 g (tarrina)' },
  { id: 'f-atun', grams: 80, label: '1 lata' },
  { id: 'f-griego', grams: 125, label: '1 yogur' },
  { id: 'f-whey', grams: 30, label: '1 cacito' },
  { id: 'f-claras', grams: 200, label: '200 g' },
  { id: 'f-pollo', grams: 150, label: '150 g' },
  { id: 'f-pavo', grams: 150, label: '150 g' },
  { id: 'f-huevo', grams: 110, label: '2 huevos' },
  { id: 'f-merluza', grams: 200, label: '200 g' },
  { id: 'f-batido', grams: 330, label: '1 botella' },
].filter((o) => FOOD[o.id])

export const mealNow = () => {
  const h = new Date().getHours()
  return h < 11 ? 'Desayuno' : h < 16 ? 'Comida' : h < 19 ? 'Merienda' : 'Cena'
}

export function proteinPlan(data) {
  const t = dayTotals(data.food[todayStr()] || [])
  const left = Math.round(data.goals.protein - t.p)
  const kcalLeft = kcalGoal(data) - t.kcal
  if (left < 15) return null
  const opts = OPTIONS.map((o) => {
    const f = FOOD[o.id]
    const k = o.grams / 100
    return { ...o, f, p: Math.round(f.p * k), kcal: Math.round(f.kcal * k) }
  })
  // primero las que caben en las calorías que te quedan; dentro, las que más proteína dan por caloría
  const room = Math.max(kcalLeft, 150)
  opts.sort((a, b) => (b.kcal <= room) - (a.kcal <= room) || b.p / b.kcal - a.p / a.kcal)
  const used = new Set((data.food[todayStr()] || []).map((e) => e.name))
  const pick = opts.filter((o) => !used.has(o.f.name)).slice(0, 3)
  return { left, kcalLeft, pick }
}

export function ProteinTip({ data, setData }) {
  const h = new Date().getHours()
  const pp = proteinPlan(data)
  if (!pp || h < 12) return null
  const add = (o) => {
    const f = o.f
    setData((d) => ({
      ...d,
      food: {
        ...d.food,
        [todayStr()]: [
          ...(d.food[todayStr()] || []),
          {
            id: uid(),
            meal: mealNow(),
            name: f.name,
            grams: o.grams,
            kcal: f.kcal,
            p: f.p,
            c: f.c,
            f: f.f,
            s: f.s,
            sf: f.sf,
            natural: f.natural,
            unitG: f.unitG,
            unitName: f.unitName,
            label: o.label,
          },
        ],
      },
    }))
  }
  return (
    <div className="card prot-tip">
      <div className="sec-head nm">
        <b>Te faltan {pp.left} g de proteína</b>
        <span className="muted small">{pp.kcalLeft > 0 ? `${Math.round(pp.kcalLeft)} kcal libres` : 'sin kcal libres'}</span>
      </div>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        {h >= 19 ? 'Para cerrar el día, por ejemplo:' : 'Para llegar hoy, por ejemplo:'}
      </p>
      {pp.pick.map((o) => (
        <div className="row nob li" key={o.id}>
          <div className="grow">
            <div className="li-t">{o.f.name.replace(/ \(.*\)/, '')}</div>
            <div className="muted small">
              {o.label} · {o.p} g prot · {o.kcal} kcal
            </div>
          </div>
          <button className="btn sm-btn" onClick={() => add(o)}>
            Añadir
          </button>
        </div>
      ))}
    </div>
  )
}

// Series por grupo muscular esta semana (lunes a domingo). Orientación: 10–20 por músculo y semana.
export function MuscleSets({ data }) {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const monday = fmtDate(d)
  const direct = Object.fromEntries(RANK_GROUPS.map((g) => [g, 0]))
  const indirect = Object.fromEntries(RANK_GROUPS.map((g) => [g, 0]))
  for (const s of data.sessions.filter((x) => x.date >= monday))
    for (const [exId, sets] of Object.entries(s.entries || {}))
      for (const { g, main } of groupsOf(exId)) (main ? direct : indirect)[g] += sets.length
  if (!Object.values(direct).some(Boolean)) return null
  return <MuscleBars direct={direct} indirect={indirect} title="Series por músculo" sub="esta semana · ideal 10–20" />
}

// Volumen semanal que suma el plan (días con día fijo): avisa de músculos cortos o pasados antes de entrenar
export function PlanVolume({ days }) {
  const direct = Object.fromEntries(RANK_GROUPS.map((g) => [g, 0]))
  const indirect = Object.fromEntries(RANK_GROUPS.map((g) => [g, 0]))
  for (const d of days)
    for (const it of d.items || [])
      for (const { g, main } of groupsOf(it.ex)) (main ? direct : indirect)[g] += Number(it.sets) || 0
  if (!Object.values(direct).some(Boolean)) return null
  const n = (g) => Math.round(direct[g] + indirect[g] / 2)
  // el antebrazo no se avisa: se trabaja con el agarre en casi todo
  const gs = RANK_GROUPS.filter((g) => g !== 'Antebrazo')
  const low = gs.filter((g) => n(g) < 10)
  const high = gs.filter((g) => n(g) > 20)
  return (
    <MuscleBars direct={direct} indirect={indirect} title="Volumen de tu plan" sub="series por semana · ideal 10–20">
      {low.length > 0 && <div className="advice yellow sm">Se quedan cortos (menos de 10): {low.join(', ')}.</div>}
      {high.length > 0 && <div className="advice yellow sm">Demasiadas (más de 20): {high.join(', ')}. Más no es mejor si no recuperas.</div>}
      {!low.length && !high.length && <div className="advice green sm">Volumen equilibrado en todos los grupos.</div>}
    </MuscleBars>
  )
}

function MuscleBars({ direct, indirect, title, sub, children }) {
  // las series indirectas (músculo secundario) cuentan la mitad
  const count = Object.fromEntries(RANK_GROUPS.map((g) => [g, Math.round(direct[g] + indirect[g] / 2)]))
  const MAX = 24
  return (
    <div className="card">
      <div className="sec-head nm">
        <b>{title}</b>
        <span className="muted small">{sub}</span>
      </div>
      <div className="muted small" style={{ marginTop: 2 }}>
        Las de músculos secundarios cuentan la mitad (el press banca suma a tríceps y hombro).
      </div>
      <div className="msets">
        {RANK_GROUPS.map((g) => {
          const n = count[g]
          const tone = n === 0 ? 'none' : n < 10 ? 'low' : n > 20 ? 'high' : 'ok'
          return (
            <div className="mset" key={g}>
              <span className="mset-n">{g}</span>
              <span className="mset-bar">
                <span className="mset-band" style={{ left: `${(10 / MAX) * 100}%`, width: `${(10 / MAX) * 100}%` }} />
                <span className={'mset-fill ' + tone} style={{ width: `${Math.min(100, (n / MAX) * 100)}%` }} />
              </span>
              <span className="mset-v" title={indirect[g] ? `${direct[g]} directas + ${indirect[g]} indirectas` : undefined}>{n}</span>
            </div>
          )
        })}
      </div>
      {children}
    </div>
  )
}

const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export function StepsBar({ steps, goal }) {
  const pct = Math.min(100, Math.round((steps / goal) * 100))
  return (
    <div className="steps">
      <div className="steps-top">
        <span>
          <b>{miles(steps)}</b> pasos hoy
        </span>
        <span className="muted small">{steps >= goal ? '¡Objetivo cumplido!' : `faltan ${miles(goal - steps)}`}</span>
      </div>
      <span className="steps-bar">
        <span style={{ width: pct + '%' }} className={steps >= goal ? 'ok' : ''} />
      </span>
    </div>
  )
}
