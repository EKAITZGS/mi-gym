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

export function energy(data, date = todayStr()) {
  const today = todayStr()
  const days = data.polar?.days || {}
  // días ya cerrados de las últimas 3 semanas (con el reloj puesto)
  const done = Object.entries(days).filter(([d, v]) => d < today && d >= addDays(today, -21) && v.kcal >= 1200)
  const bmrs = done.map(([, v]) => v.kcal - (v.active || 0)).filter((b) => b >= 1100 && b <= 2800)
  const kg = (data.body?.weight || []).slice(-1)[0]?.kg
  const bmr = Math.round(bmrs.length >= 2 ? median(bmrs) : kg ? kg * 22 : 1700)
  const tr = done.filter(([d]) => isTrainDay(data, d)).map(([, v]) => v.kcal)
  const rs = done.filter(([d]) => !isTrainDay(data, d)).map(([, v]) => v.kcal)
  const all = avg(done.map(([, v]) => v.kcal))
  const typ = {
    n: done.length,
    train: tr.length >= 2 ? avg(tr) : all,
    rest: rs.length >= 2 ? avg(rs) : all,
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
    const minimum = v ? bmr + (v.active || 0) : bmr
    spent = Math.max(minimum, usual)
    projected = true
  } else if (v && v.kcal >= 1200 && date < today) spent = v.kcal
  else if (date < today && v) spent = bmr + (v.active || 0)

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
  if (!data.goals?.auto) return data.goals.kcal
  return targetFor(data, aimOf(data), isTrainDay(data, date)).kcal
}

export const kgWeek = (bal) => Math.round(((bal * 7) / 7700) * 10) / 10
