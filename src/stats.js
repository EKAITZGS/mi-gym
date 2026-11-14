import { exStats, fmtDate, num, workSets } from './store'

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
    (t, sets) => t + workSets(sets).reduce((q, x) => q + num(x.w) * num(x.r) + (x.drops || []).reduce((k, d) => k + num(d.w) * num(d.r), 0), 0),
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

// ---------- Sueño ----------
export const hmc = (min) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}`
export const hm = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`
// hora de acostarse en minutos, contando las de después de medianoche como 24:xx para poder hacer medias
const bedMin = (t) => {
  if (!/^\d\d:\d\d$/.test(t || '')) return null
  const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  return m < 12 * 60 ? m + 1440 : m
}
const clock = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`
const avgOf = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// sleep: { 'YYYY-MM-DD': { start, end, total, interr, light?, deep?, rem?, score?, goal? } } (minutos)
// tiempo de sueño como lo cuenta Polar: de dormirse a despertarse (las interrupciones van aparte)
const lenOf = (n) => spanOf(n.start, n.end) || n.total

export function sleepAnalysis(sleep, recharge, now = new Date()) {
  const dates = Object.keys(sleep || {}).sort()
  if (!dates.length) return null
  const today = fmtDate(now)
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - 6 + i)
    const k = fmtDate(d)
    const n = sleep[k]
    return { date: k, ...(n || {}), ...(n?.total ? { len: lenOf(n) } : {}) }
  })
  const nights = week.filter((n) => n.total)
  const prev = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - 13 + i)
    return sleep[fmtDate(d)]
  }).filter((n) => n?.total)
  const lastN = sleep[dates[dates.length - 1]]
  const last = { ...lastN, len: lenOf(lastN) }
  if (!nights.length) return { last, lastIsToday: false, week, avg: last.len, goal: last.goal || 480, tips: ['No hay noches de esta semana: duerme con el reloj puesto para ver tu análisis.'] }
  const goal = last.goal || 480
  const avg = Math.round(avgOf(nights.map((n) => n.len)))
  const prevAvg = prev.length >= 3 ? Math.round(avgOf(prev.map(lenOf))) : null
  const beds = nights.map((n) => bedMin(n.start)).filter((x) => x != null)
  const bedAvg = avgOf(beds)
  const spread = beds.length >= 3 ? Math.round(Math.sqrt(avgOf(beds.map((b) => (b - bedAvg) ** 2)))) : null
  const staged = nights.filter((n) => n.deep != null && n.total && (n.light || n.rem))
  const conts = nights.map((n) => n.cont).filter((v) => v > 0)
  const cont = conts.length ? Math.round(avgOf(conts) * 10) / 10 : null
  const deepPct = staged.length ? Math.round(avgOf(staged.map((n) => (n.deep / n.total) * 100))) : null
  const remPct = staged.length ? Math.round(avgOf(staged.map((n) => ((n.rem || 0) / n.total) * 100))) : null
  const interr = Math.round(avgOf(nights.map((n) => n.interr || 0)))
  const short = nights.filter((n) => n.len < 360).length
  const rKeys = Object.keys(recharge || {}).sort().slice(-7)
  const hrvs = rKeys.map((k) => recharge[k].hrv).filter((v) => v != null)
  const hrs = rKeys.map((k) => recharge[k].hr).filter((v) => v != null)

  const tips = []
  if (avg < 420) tips.push(`Duermes de media ${hm(avg)}: para ganar músculo y perder grasa conviene llegar a 7–9 h. Prueba a acostarte 30 min antes.`)
  else if (avg >= 420 && avg <= 560) tips.push(`Buena media: ${hm(avg)} por noche. Mantén ese horario.`)
  if (short >= 2) tips.push(`${short} noches de menos de 6 h esta semana: esos días baja la intensidad y no busques récords.`)
  if (spread != null && spread > 60) tips.push(`Te acuestas a horas muy distintas (±${spread} min). Una hora fija, también el fin de semana, mejora mucho la calidad.`)
  if (deepPct != null && deepPct < 13) tips.push(`Poco sueño profundo (${deepPct} %): evita cenar fuerte, alcohol y pantallas en la última hora.`)
  if (cont != null && cont < 3) tips.push(`Sueño poco continuo (${String(cont).replace('.', ',')}/5): te despiertas a menudo. Evita líquidos y pantallas antes de dormir.`)
  if (interr > 30) tips.push(`Pasas unos ${interr} min despierto por noche: habitación fresca y a oscuras, y nada de cafeína después de las 16 h.`)
  if (prevAvg != null && avg - prevAvg <= -30) tips.push(`Esta semana duermes ${prevAvg - avg} min menos que la anterior.`)
  if (!tips.length) tips.push('Tu sueño va bien esta semana. Sigue así.')
  return {
    last, lastDate: dates[dates.length - 1], lastIsToday: dates[dates.length - 1] === today, week, goal, avg, prevAvg,
    bed: bedAvg != null ? clock(bedAvg) : null, spread, deepPct, remPct, interr, cont,
    hrv: hrvs.length ? Math.round(avgOf(hrvs)) : null, hr: hrs.length ? Math.round(avgOf(hrs)) : null, tips,
  }
}

// Noches con las correcciones del usuario (data.sleepFix: { fecha: { start, end } }), p. ej. cuando el reloj
// cuenta como sueño el rato que estuvo en la mesilla. Las interrupciones se reparten en proporción al nuevo horario.
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const spanOf = (a, b) => (/^\d\d:\d\d$/.test(a || '') && /^\d\d:\d\d$/.test(b || '') ? (toMin(b) - toMin(a) + 1440) % 1440 : 0)
export function nightsOf(data) {
  const sleep = data.polar?.sleep || {}
  const fix = data.sleepFix || {}
  if (!Object.keys(fix).length) return sleep
  const out = { ...sleep }
  for (const [d, f] of Object.entries(fix)) {
    const n = sleep[d]
    if (!n) continue
    const start = f.start || n.start, end = f.end || n.end
    const span = spanOf(start, end)
    if (!span) continue
    const old = spanOf(n.start, n.end) || n.total + (n.interr || 0)
    const interr = Math.round((n.interr || 0) * Math.min(1, span / old))
    const { light, deep, rem, score, ...rest } = n // las fases y la puntuación del reloj ya no valen
    out[d] = { ...rest, start, end, interr, total: Math.max(0, span - interr), fixed: true }
  }
  return out
}
