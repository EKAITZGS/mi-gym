// Progreso serie a serie y fatiga por el orden de los ejercicios. Puro (sin React) para probarlo con npm test.
// - No es lo mismo hacer un ejercicio el primero que después de otros que cargan los mismos músculos:
//   `preFatigue` cuenta las series previas que lo cansan (mismo músculo principal 1, de rebote 0,5).
// - Mejorar no es solo la mejor serie: `compareSets` compara la 1.ª con la 1.ª, la 2.ª con la 2.ª…
import { EX_BY_ID } from './data/exercises'
import { num, workSets, e1rm, fmtKg, exStats, weightStep } from './store'

// diferencia de fatiga previa (en series "de lo mismo") a partir de la cual ya no se compara como si nada
export const FATIGUE_GAP = 2.5

function loadOf(id) {
  const ex = EX_BY_ID[id]
  if (!ex) return null
  const m = {}
  for (const x of ex.sec || []) m[x] = 0.5
  for (const x of ex.main || []) m[x] = 1
  return m
}
// Cuánto cansa una serie de `a` a los músculos principales de `x`: 1 lo mismo, 0,5 de rebote, 0 nada
export function overlap(a, x) {
  if (a === x) return 1
  const la = loadOf(a)
  const ex = EX_BY_ID[x]
  if (!la || !ex?.main?.length) return 0
  return Math.max(0, ...ex.main.map((m) => la[m] || 0))
}
const doneSets = (sets) => workSets(sets || []).filter((s) => num(s.r) > 0 || num(s.s) > 0 || num(s.m) > 0 || num(s.km) > 0 || num(s.min) > 0).length

// Orden en que se hicieron los ejercicios: `order` (se guarda al terminar desde esta versión) o, en los antiguos,
// el del día del plan si coinciden los ejercicios (aproximado; en la nube el orden de las claves no se conserva).
// null si no se puede saber.
export function sessionOrder(s, plan = []) {
  const keys = Object.keys(s?.entries || {})
  if (Array.isArray(s?.order) && s.order.length) {
    const o = s.order.filter((k) => keys.includes(k))
    return [...o, ...keys.filter((k) => !o.includes(k))]
  }
  if (keys.length <= 1) return keys
  const day = (plan || []).find((d) => d.id === s.dayId)
  if (!day) return null
  const idx = new Map(day.items.map((it, i) => [it.ex, i]))
  if (!keys.every((k) => idx.has(k))) return null
  return [...keys].sort((a, b) => idx.get(a) - idx.get(b))
}

// Fatiga previa de `exId` en un entreno ya hecho (null si no se sabe el orden)
export function preFatigue(s, exId, plan) {
  const order = sessionOrder(s, plan)
  if (!order || !order.includes(exId)) return null
  let f = 0
  for (const k of order) {
    if (k === exId) return f
    f += doneSets(s.entries[k]) * overlap(k, exId)
  }
  return f
}

// Fatiga con la que vas a hacer (o estás haciendo) `exId` hoy. `touch` = cuándo empezaste cada ejercicio.
// Si ya lo empezaste: lo que de verdad hiciste antes. Si no: lo de antes en la lista (previsto o hecho) + lo ya hecho de después.
export function liveFatigue(items, entries, touch = {}, exId) {
  const tx = touch?.[exId]
  let f = 0
  let before = true
  for (const it of items || []) {
    if (it.ex === exId) {
      before = false
      continue
    }
    const done = doneSets(entries?.[it.ex])
    const ti = touch?.[it.ex]
    const n = tx != null ? (ti != null && ti < tx ? done : 0) : before ? Math.max(done, Number(it.sets) || 0) : done
    f += n * overlap(it.ex, exId)
  }
  return f
}

const r1 = (n) => String(Math.round(n * 2) / 2).replace('.', ',')
// Texto si hoy la fatiga previa es claramente distinta de la de otro entreno (null si es parecida o no se sabe)
export function fatigueNote(now, prev) {
  if (now == null || prev == null) return null
  const d = now - prev
  if (d >= FATIGUE_GAP) return { more: true, now, prev, text: `después de más trabajo de esos músculos que la otra vez (~${r1(now)} series antes, frente a ~${r1(prev)})` }
  if (d <= -FATIGUE_GAP) return { more: false, now, prev, text: `más fresco que la otra vez (~${r1(now)} series antes para esos músculos, frente a ~${r1(prev)})` }
  return null
}

const repSets = (sets) => workSets(sets || []).filter((s) => num(s.r) > 0)
// Una serie frente a la misma serie de la otra vez: 1 mejor, -1 peor, 0 igual
export function pairCmp(a, b) {
  const wa = num(a.w)
  const wb = num(b.w)
  const ra = num(a.r)
  const rb = num(b.r)
  if (Math.abs(wa - wb) < 0.01) return Math.sign(rb - ra)
  if (wb > wa && rb >= ra) return 1
  if (wb < wa && rb <= ra) return -1
  const ea = wa > 0 ? e1rm(wa, ra) : ra
  const eb = wb > 0 ? e1rm(wb, rb) : rb
  return eb > ea * 1.01 ? 1 : eb < ea * 0.99 ? -1 : 0
}

// Serie a serie (la 1.ª con la 1.ª…). reps = diferencia de repeticiones en las series con el mismo peso.
export function compareSets(prev, cur) {
  const a = repSets(prev)
  const b = repSets(cur)
  const n = Math.min(a.length, b.length)
  const out = { n, better: 0, worse: 0, same: 0, reps: 0, sameW: 0, extra: Math.max(0, b.length - a.length), missing: Math.max(0, a.length - b.length), kind: 'none' }
  if (!n) return out
  for (let i = 0; i < n; i++) {
    const c = pairCmp(a[i], b[i])
    if (Math.abs(num(a[i].w) - num(b[i].w)) < 0.01) {
      out.sameW++
      out.reps += num(b[i].r) - num(a[i].r)
    }
    if (c > 0) out.better++
    else if (c < 0) out.worse++
    else out.same++
  }
  out.kind = out.better && !out.worse ? 'up' : out.worse && !out.better ? 'down' : out.better && out.worse ? 'mixed' : 'same'
  return out
}
const reps = (n) => `${n} ${Math.abs(n) === 1 ? 'rep' : 'reps'}`
// Etiqueta corta (insignia) y frase
export function compareTag(c) {
  if (!c?.n) return null
  if (c.kind === 'up') return c.sameW === c.n ? `+${reps(c.reps)}` : `Mejor ${c.better}/${c.n}`
  if (c.kind === 'down') return c.sameW === c.n ? `−${reps(-c.reps)}` : `Peor ${c.worse}/${c.n}`
  if (c.kind === 'mixed') return `${c.better} mejor · ${c.worse} peor`
  return 'Igual'
}
export function compareTxt(c) {
  if (!c?.n) return ''
  const all = c.sameW === c.n
  if (c.kind === 'up') return all ? `${reps(c.reps)} más con el mismo peso` : `mejor en ${c.better} de ${c.n} series`
  if (c.kind === 'down') return all ? `${reps(-c.reps)} menos con el mismo peso` : `peor en ${c.worse} de ${c.n} series`
  if (c.kind === 'mixed') return `${c.better} ${c.better === 1 ? 'serie mejor' : 'series mejor'} y ${c.worse} peor`
  return 'igual que la otra vez'
}

// Objetivo de cada serie para hoy (doble progresión serie a serie, con lo que hiciste en esa misma serie la otra vez):
// llegaste al tope del rango → más peso y vuelves al mínimo; si no → mismo peso y 1 rep más (2 si te sobraban 3+).
// Con bastante más fatiga que la otra vez el objetivo es igualar.
export function setTargets(prevSets, repsTarget, equip, { rir, fatigue = null } = {}) {
  const sets = repSets(prevSets)
  if (!sets.length) return null
  const m = String(repsTarget || '').trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
  const lo = m ? Number(m[1]) : null
  const hi = m ? Number(m[2] || m[1]) : null
  const tired = fatigue?.more === true
  return sets.map((s) => {
    const w = num(s.w)
    const r = num(s.r)
    if (tired) return { w, r, up: false, keep: true }
    if (w > 0 && hi && (r >= hi || (rir >= 3 && r >= lo))) return { w: Math.round((w + weightStep(w, equip)) * 100) / 100, r: lo, up: true }
    const step = rir >= 3 ? 2 : 1
    return { w, r: hi && w > 0 ? Math.min(hi, r + step) : r + step, up: false }
  })
}
// "10 · 10 · 9 con 40 kg" o "42,5×8 · 40×10"
export function targetsTxt(t) {
  if (!t?.length) return ''
  const ws = new Set(t.map((x) => x.w))
  if (ws.size === 1) {
    const w = t[0].w
    return `${t.map((x) => x.r).join(' · ')} reps${w > 0 ? ` con ${fmtKg(w)} kg` : ''}`
  }
  return t.map((x) => (x.w > 0 ? `${fmtKg(x.w)}×${x.r}` : `${x.r}`)).join(' · ')
}

// Historial de un ejercicio (lo de exStats) + fatiga previa de cada entreno, sus series y la media de sus 3 mejores series
export function exHistory(sessions, exId, plan = []) {
  const out = []
  for (const s of sessions || []) {
    const sets = s.entries?.[exId]
    if (!sets) continue
    const st = exStats([s], exId)[0]
    if (!st) continue
    const es = repSets(sets)
      .filter((x) => num(x.w) > 0)
      .map((x) => e1rm(x.w, x.r))
      .sort((a, b) => b - a)
      .slice(0, 3)
    out.push({ ...st, sets: repSets(sets), top3: es.length ? es.reduce((a, x) => a + x, 0) / es.length : 0, pf: preFatigue(s, exId, plan) })
  }
  return out
}
