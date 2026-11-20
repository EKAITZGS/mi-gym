// Pulso de cada serie y de cada ejercicio cruzando la hora a la que hiciste cada serie (`t` en la serie, ms) con la curva de
// pulso del reloj (Polar: `hr {step, v}` desde el inicio del entreno). Puro, sin React, para probarlo con npm test.
import { EX_BY_ID } from './data/exercises'

// Inicio del entreno del reloj en ms: `start` (hora local con segundos) + `off` (minutos respecto a UTC) si están;
// en los antiguos, fecha + hora:minuto (error de hasta 1 min)
export function watchStart(e) {
  if (e?.start) {
    const ms = e.off != null && !isNaN(Number(e.off)) ? Date.parse(e.start + 'Z') - Number(e.off) * 60000 : new Date(e.start).getTime()
    if (!isNaN(ms)) return ms
  }
  if (e?.date && e?.time) {
    const ms = new Date(`${e.date}T${e.time}:00`).getTime()
    if (!isNaN(ms)) return ms
  }
  return null
}

const timed = (s) =>
  Object.entries(s?.entries || {}).flatMap(([id, list]) =>
    (list || []).map((x, k) => ({ id, k, t: Number(x.t) || 0, warm: !!x.warm })).filter((x) => x.t > 0)
  )

// ventana del pico de una serie: el pulso sube durante la serie y llega arriba al acabarla o justo después
export const BEFORE = 45
export const AFTER = 20

// Pulso de cada serie (pico de la ventana) y resumen por ejercicio, ordenado de más a menos pulso.
// null si las horas no encajan con el entreno del reloj o si las series se apuntaron todas de golpe al final.
export function hrBySet(session, e) {
  const t0 = watchStart(e)
  const v = e?.hr?.v
  if (t0 == null || !v?.length) return null
  const step = (Number(e.hr.step) || 15) * 1000
  const end = t0 + v.length * step
  const all = timed(session)
  if (all.length < 2) return null
  const inside = all.filter((x) => x.t >= t0 - 60000 && x.t <= end + 60000)
  if (inside.length < Math.max(2, Math.ceil(all.length * 0.6))) return null
  const ts = inside.map((x) => x.t)
  if (inside.length >= 6 && Math.max(...ts) - Math.min(...ts) < 3 * 60000) return null
  const peak = (t) => {
    const a = Math.max(0, Math.floor((t - BEFORE * 1000 - t0) / step))
    const b = Math.min(v.length - 1, Math.ceil((t + AFTER * 1000 - t0) / step))
    let m = 0
    for (let i = a; i <= b; i++) m = Math.max(m, v[i] || 0)
    return m || null
  }
  const sets = inside.map((x) => ({ ...x, hr: peak(x.t), sec: Math.round((x.t - t0) / 1000) })).sort((a, b) => a.t - b.t)
  const by = {}
  for (const x of sets) if (x.hr && !x.warm) (by[x.id] ||= []).push(x.hr)
  const ex = Object.entries(by)
    .map(([id, l]) => ({ id, name: EX_BY_ID[id]?.name || id, n: l.length, avg: Math.round(l.reduce((a, b) => a + b, 0) / l.length), max: Math.max(...l) }))
    .sort((a, b) => b.avg - a.avg)
  if (!ex.length) return null
  return { sets, ex }
}

// El entreno apuntado que va con un entreno del reloj (mismo día y con las horas de las series dentro)
export function sessionForWatch(data, e) {
  const list = (data?.sessions || []).filter((s) => s.date === e?.date).reverse()
  for (const s of list) {
    const r = hrBySet(s, e)
    if (r) return { session: s, ...r }
  }
  return null
}

// Y al revés: el entreno del reloj de un entreno apuntado
export function watchForSession(data, s) {
  const list = Object.values(data?.polar?.exercises || {}).filter((e) => e.date === s?.date)
  for (const e of list) {
    const r = hrBySet(s, e)
    if (r) return { watch: e, ...r }
  }
  return null
}

// ¿El entreno tiene horas de serie? (para explicar por qué no sale el pulso por ejercicio)
export const hasSetTimes = (s) => timed(s).length >= 2
