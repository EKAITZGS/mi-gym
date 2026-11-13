// Gasto de energía con el reloj (Polar) y balance con lo que comes.
// Polar da por día `kcal` (total, con metabolismo basal) y `active` (solo actividad).
import { todayStr, addDays, parseDate, dayTotals } from './store'
import { polarExercisesOn } from './polar'

export const AIMS = [
  ['lose', 'Bajar grasa'],
  ['keep', 'Mantener'],
  ['gain', 'Ganar músculo'],
]
// déficit / superávit diario de cada objetivo (−500 ≈ −0,5 kg de grasa por semana)
const DELTA = { lose: -500, keep: 0, gain: 300 }
export const aimOf = (data) => (DELTA[data.goals?.aim] != null ? data.goals.aim : 'lose')
export const aimLabel = (aim) => AIMS.find((a) => a[0] === aim)?.[1] || 'Bajar grasa'

const worn = (v) => (v.steps || 0) >= 1000 || (v.active || 0) >= 150
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

// ¿entrenas ese día? (hecho, en el reloj o en el plan para ese día de la semana)
export const isTrainDay = (data, date) =>
  (data.sessions || []).some((s) => s.date === date) ||
  polarExercisesOn(data, date).length > 0 ||
  (date >= todayStr() && (data.plan || []).some((d) => d.weekday === parseDate(date).getDay()))

// El basal que da Polar (kcal − actividad) es una fórmula y suele cuadrar; donde los relojes se pasan es en la
// actividad (en pesas, mucho). Hasta calibrar se cuenta el 65 % de la actividad que marca.
const ACT_DEFAULT = 0.65
const bmrOf = (v) => v.kcal - (v.active || 0)

// Calibración: en 3–4 semanas compara lo que comes con lo que de verdad cambia tu peso y deduce qué parte de
// la actividad del reloj es real. 7700 kcal ≈ 1 kg.
export function calibration(data) {
  const today = todayStr()
  const from = addDays(today, -28)
  const days = data.polar?.days || {}
  const pairs = Object.entries(days)
    .filter(([d, v]) => d >= from && d < today && v.kcal >= 1200 && worn(v))
    .map(([d, v]) => ({ e: dayTotals(data.food?.[d] || []).kcal, b: bmrOf(v), a: v.active || 0 }))
    .filter((p) => p.e >= 800)
  const ws = (data.body?.weight || []).filter((w) => w.date >= from)
  const span = ws.length ? (Date.parse(ws[ws.length - 1].date) - Date.parse(ws[0].date)) / 864e5 : 0
  const off = (why) => ({ act: ACT_DEFAULT, ok: false, why, n: pairs.length })
  if (pairs.length < 14) return off(`faltan ${14 - pairs.length} días con la comida apuntada y el reloj`)
  if (ws.length < 3 || span < 14) return off('faltan pesajes (uno por semana, 3 o más)')
  // tendencia del peso: recta de regresión (no se fía de un pesaje suelto)
  const xs = ws.map((w) => (Date.parse(w.date) - Date.parse(ws[0].date)) / 864e5)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ws.reduce((a, w) => a + w.kg, 0) / ws.length
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ws[i].kg - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0) // kg/día
  // si la cintura baja y el peso no, estás ganando músculo: el peso no sirve para calibrar
  const wa = (data.body?.waist || []).filter((w) => w.date >= from)
  if (wa.length >= 2 && wa[wa.length - 1].cm - wa[0].cm <= -1 && slope * 28 > -0.2) return off('la cintura baja aunque el peso no (ganas músculo): no se ajusta')
  const m = (k) => pairs.reduce((a, p) => a + p[k], 0) / pairs.length
  const real = m('e') - slope * 7700 // lo que de verdad gastas al día
  const act = m('a') > 50 ? Math.round(Math.max(0.3, Math.min(1.2, (real - m('b')) / m('a'))) * 100) / 100 : ACT_DEFAULT
  return { act, ok: true, n: pairs.length, real: Math.round(real), watch: Math.round(m('b') + m('a')) }
}

export function energy(data, date = todayStr()) {
  const today = todayStr()
  const days = data.polar?.days || {}
  const cal = calibration(data)
  const A = cal.act
  const kcalOf = (v) => bmrOf(v) + (v.active || 0) * A // gasto del día con la actividad corregida
  // días ya cerrados de las últimas 3 semanas
  const closed = Object.entries(days).filter(([d, v]) => d < today && d >= addDays(today, -21) && v.kcal >= 1200)
  // basal: Polar lo calcula aunque no lleves el reloj
  const bmrs = closed.map(([, v]) => bmrOf(v)).filter((b) => b >= 1100 && b <= 2800)
  // gasto típico: solo días con el reloj puesto (sin pasos ni actividad, es que no lo llevabas)
  const done = closed.filter(([, v]) => worn(v)).map(([d, v]) => [d, { ...v, kcal: Math.round(kcalOf(v)), raw: v.kcal }])
  const kg = (data.body?.weight || []).slice(-1)[0]?.kg
  const bmr = Math.round(bmrs.length >= 2 ? median(bmrs) : kg ? kg * 22 : 1700)
  const tr = done.filter(([d]) => isTrainDay(data, d)).map(([, v]) => v.kcal)
  const rs = done.filter(([d]) => !isTrainDay(data, d)).map(([, v]) => v.kcal)
  const all = avg(done.map(([, v]) => v.kcal))
  // con pocos días de un tipo, estimación prudente con el basal
  const typ = {
    n: done.length,
    train: tr.length >= 2 ? avg(tr) : Math.round(Math.max(all || 0, bmr * 1.5)),
    rest: rs.length >= 2 ? avg(rs) : Math.round(Math.min(all || Infinity, bmr * 1.35)),
    nTrain: tr.length,
    nRest: rs.length,
  }
  const fallback = Math.round((bmr * 1.4) / 10) * 10 // sin datos del reloj: estimación

  const train = isTrainDay(data, date)
  const v = days[date]
  const usual = (train ? typ.train : typ.rest) || fallback
  let spent = null
  let sofar = null
  let projected = false
  if (date === today) {
    // lo que ya has gastado: basal de todo el día + la actividad que lleva el reloj
    sofar = v ? v.kcal : null
    const minimum = bmr + (v?.active || 0) * A
    spent = Math.max(minimum, usual)
    projected = true
  } else if (v && date < today) spent = v.kcal >= 1200 ? kcalOf(v) : bmr + (v.active || 0) * A

  const eaten = Math.round(dayTotals(data.food?.[date] || []).kcal)
  // media de los últimos días cerrados en los que apuntaste la comida
  const logged = done
    .filter(([d]) => d >= addDays(today, -7))
    .map(([d, v]) => [dayTotals(data.food?.[d] || []).kcal, v.kcal])
    .filter(([e]) => e >= 800)
  const week = logged.length >= 3 ? { n: logged.length, bal: avg(logged.map(([e, k]) => e - k)) } : null

  return {
    bmr,
    typ,
    fallback,
    train,
    spent: spent != null ? Math.round(spent) : null,
    sofar,
    projected,
    eaten,
    balance: spent != null ? Math.round(eaten - spent) : null,
    week,
    watch: done.length > 0,
    cal,
  }
}

// kcal para comer según lo que gastas en ese tipo de día y tu objetivo
export function targetFor(data, aim, train) {
  const e = energy(data)
  const base = (train ? e.typ.train : e.typ.rest) || e.fallback
  const t = base + (DELTA[aim] ?? -500)
  // nunca por debajo del basal ni de 1500
  return { kcal: Math.round(Math.max(t, e.bmr, 1500) / 50) * 50, base, e }
}

// objetivo de kcal de un día: el fijo o, si lo activas, el que sale de lo que gastas
export function kcalGoal(data, date = todayStr()) {
  if (data.goals?.today?.date === date) return data.goals.today.kcal
  if (!data.goals?.auto) return data.goals.kcal
  return targetFor(data, aimOf(data), isTrainDay(data, date)).kcal
}

// Macros según tu peso (media de los 3 últimos pesajes) y objetivo.
// Proteína: 2 g/kg bajando grasa (protege el músculo), 1,8 g/kg manteniendo o ganando. Grasa: mín. 0,8 g/kg o 25 % de las kcal.
const PROT = { lose: 2, keep: 1.8, gain: 1.8 }
export function bodyKg(data) {
  const w = (data.body?.weight || []).slice(-3)
  return w.length ? w.reduce((a, x) => a + x.kg, 0) / w.length : null
}
export function macroPlan(data, aim, kcal) {
  const kg = bodyKg(data)
  const r5 = (n) => Math.round(n / 5) * 5
  const protein = kg ? Math.min(230, r5(kg * (PROT[aim] || 2))) : data.goals.protein
  const fat = r5(Math.max(kg ? kg * 0.8 : 0, (kcal * 0.25) / 9))
  const carbs = Math.max(0, r5((kcal - protein * 4 - fat * 9) / 4))
  return { protein, fat, carbs, kg: kg ? Math.round(kg * 10) / 10 : null, perKg: PROT[aim] || 2 }
}
// proteína del día: la fija o, con el objetivo automático, la que sale de tu peso
export function proteinGoal(data, date = todayStr()) {
  if (!data.goals?.auto) return data.goals.protein
  return macroPlan(data, aimOf(data), kcalGoal(data, date)).protein
}

export const kgWeek = (bal) => Math.round(((bal * 7) / 7700) * 10) / 10
