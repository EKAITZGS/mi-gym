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

/* ---------- 2.0: periodos, carga por músculo y lectura del progreso ---------- */
// Totales de un periodo [from, to] (fechas AAAA-MM-DD, ambas incluidas)
export function periodStats(sessions, from, to = '9999') {
  const ws = sessions.filter((s) => s.date >= from && s.date <= to)
  const sets = ws.reduce((t, s) => t + Object.values(s.entries || {}).reduce((q, l) => q + workSets(l).length, 0), 0)
  return { n: ws.length, days: new Set(ws.map((s) => s.date)).size, min: ws.reduce((t, s) => t + (s.min || 0), 0), vol: Math.round(ws.reduce((t, s) => t + sessionVol(s), 0)), sets }
}

// Semanas con al menos un entreno de las últimas `weeks` (consistencia)
export function consistency(sessions, weeks = 8, now = new Date()) {
  const w0 = monday(now)
  let hit = 0
  for (let k = 0; k < weeks; k++) {
    const a = new Date(w0)
    a.setDate(a.getDate() - 7 * k)
    const b = new Date(a)
    b.setDate(b.getDate() + 6)
    const fa = fmtDate(a), fb = fmtDate(b)
    if (sessions.some((s) => s.date >= fa && s.date <= fb)) hit++
  }
  return { hit, weeks }
}

// Series directas e indirectas por grupo en un periodo, y en cuántos días distintos se tocó cada grupo.
// groupsOf(id) → [{ g, main }] (el de ranks.js). Efectivas = directas + ½ indirectas (se explica en la UI).
export function muscleLoad(sessions, from, groupsOf, to = '9999') {
  const out = {}
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue
    for (const [id, sets] of Object.entries(s.entries || {})) {
      const n = workSets(sets).filter((x) => num(x.r) > 0 || x.s || x.m).length
      if (!n) continue
      for (const { g, main } of groupsOf(id)) {
        const o = (out[g] ??= { direct: 0, indirect: 0, days: new Set() })
        o[main ? 'direct' : 'indirect'] += n
        o.days.add(s.date)
      }
    }
  }
  return Object.fromEntries(Object.entries(out).map(([g, o]) => [g, { direct: o.direct, indirect: o.indirect, eff: Math.round(o.direct + o.indirect / 2), freq: o.days.size }]))
}

// Lectura honesta de la evolución de un ejercicio a partir de exStats(): no todo cambio es progreso.
// → { kind: 'weight' | 'reps' | 'volume' | 'flat' | 'down' | 'few', text }
export function progressRead(st) {
  if (!st || st.length < 3) return { kind: 'few', text: st?.length ? 'Pocos datos aún: con 3 o más entrenos se puede valorar.' : 'Sin datos.' }
  const last = st[st.length - 1]
  const prev = st.slice(-4, -1) // hasta 3 anteriores
  const bestPrev = prev.reduce((m, x) => (x.best.e > m.best.e ? x : m), prev[0])
  const volPrev = prev.reduce((t, x) => t + x.vol, 0) / prev.length
  const dE = last.best.e / bestPrev.best.e - 1
  const sameW = Math.abs(last.best.w - bestPrev.best.w) < 0.01
  if (dE >= 0.01 && last.best.w > bestPrev.best.w && last.best.r >= bestPrev.best.r - 1) return { kind: 'weight', text: `Más peso con repeticiones comparables (${last.best.w} kg × ${last.best.r} frente a ${bestPrev.best.w} × ${bestPrev.best.r}).` }
  if (sameW && last.best.r > bestPrev.best.r) return { kind: 'reps', text: `Mismo peso y más repeticiones (${last.best.r} frente a ${bestPrev.best.r} con ${last.best.w} kg).` }
  if (volPrev > 0 && last.vol / volPrev - 1 >= 0.1) return { kind: 'volume', text: `Más volumen total (${Math.round(last.vol)} kg frente a ~${Math.round(volPrev)} de media en los anteriores).` }
  if (dE <= -0.05) return { kind: 'down', text: `Por debajo de tu mejor marca reciente (${Math.round(Math.abs(dE) * 100)} % menos de 1RM estimado). Puede ser fatiga, sueño o técnica: no saques conclusiones de un día.` }
  return { kind: 'flat', text: 'Variación normal: ni mejora clara ni bajada. Si pasa 3-4 sesiones así, prueba otro rango de reps o una descarga.' }
}
