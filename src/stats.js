import { exStats, fmtDate, num } from './store'

const monday = (d) => {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const ids = (sessions) => [...new Set(sessions.flatMap((s) => Object.keys(s.entries || {})))]

// kg × reps de todas las series (y drops) de un entreno
export const sessionVol = (s) =>
  Object.values(s.entries || {}).reduce(
    (t, sets) => t + sets.reduce((q, x) => q + num(x.w) * num(x.r) + (x.drops || []).reduce((k, d) => k + num(d.w) * num(d.r), 0), 0),
    0,
  )

// Semanas seguidas con al menos un entreno; la semana actual solo cuenta si ya entrenaste (no rompe la racha un lunes)
export function streakWeeks(sessions, now = new Date()) {
  const weeks = new Set(sessions.map((s) => fmtDate(monday(new Date(s.date + 'T12:00')))))
  const w = monday(now)
  if (!weeks.has(fmtDate(w))) w.setDate(w.getDate() - 7)
  let n = 0
  while (weeks.has(fmtDate(w))) {
    n++
    w.setDate(w.getDate() - 7)
  }
  return n
}

export function weekTotals(sessions, now = new Date()) {
  const from = fmtDate(monday(now))
  const ws = sessions.filter((s) => s.date >= from)
  return { n: ws.length, min: ws.reduce((t, s) => t + (s.min || 0), 0), vol: Math.round(ws.reduce((t, s) => t + sessionVol(s), 0)) }
}

// Récords de 1RM estimado de los últimos `days` días (el último de cada ejercicio), más recientes primero
export function recentPRs(sessions, days = 30, now = new Date()) {
  const since = new Date(now)
  since.setDate(since.getDate() - days)
  const from = fmtDate(since)
  const out = []
  for (const id of ids(sessions)) {
    const st = exStats(sessions, id)
    let best = 0
    let pr = null
    for (const x of st) {
      if (best && x.best.e > best + 0.01 && x.date >= from) pr = { id, date: x.date, ...x.best, prev: best }
      best = Math.max(best, x.best.e)
    }
    if (pr) out.push(pr)
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// Ejercicios sin mejorar el 1RM estimado en sus últimos 3 entrenos (y hechos en las últimas 3 semanas)
export function stalled(sessions, now = new Date()) {
  const since = new Date(now)
  since.setDate(since.getDate() - 21)
  const from = fmtDate(since)
  const out = []
  for (const id of ids(sessions)) {
    const st = exStats(sessions, id)
    if (st.length < 4 || st[st.length - 1].date < from) continue
    const before = Math.max(...st.slice(0, -3).map((x) => x.best.e))
    const last = Math.max(...st.slice(-3).map((x) => x.best.e))
    if (last <= before + 0.01) out.push({ id, best: before })
  }
  return out
}

// Objetivos diarios orientativos: Mifflin-St Jeor × actividad; déficit 20 % para bajar grasa, +10 % para ganar músculo.
// Proteína 2 g/kg si cambias de peso, 1,6 g/kg si mantienes. Redondeo a 50 kcal y 5 g.
export const ACTIVITY = [
  { f: 1.2, label: 'Poco (oficina, pocos pasos)' },
  { f: 1.375, label: 'Algo (entreno 2-3 días)' },
  { f: 1.55, label: 'Bastante (entreno 4-5 días)' },
  { f: 1.725, label: 'Mucho (trabajo físico o a diario)' },
]
export function calcGoals({ kg, cm, age, male, act = 1.375, aim = 'lose' }) {
  if (!(kg > 30 && cm > 120 && age >= 14)) return null
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (male ? 5 : -161)
  const kcal = bmr * act * (aim === 'lose' ? 0.8 : aim === 'gain' ? 1.1 : 1)
  return { kcal: Math.round(kcal / 50) * 50, protein: Math.round((kg * (aim === 'keep' ? 1.6 : 2)) / 5) * 5 }
}
