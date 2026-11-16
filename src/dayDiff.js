// Propuestas sobre un día del plan (entrenador o entrenador IA): qué cambia y cómo se aplica.
// Puro (sin React ni red) para poder probarlo con npm test.
import { uid as newId } from './store'

// Ejercicio del plan sin su id (lo que viaja en la propuesta)
export const clean = (it) => ({
  ex: it.ex,
  sets: it.sets,
  reps: it.reps,
  ...(it.drop ? { drop: true } : {}),
  ...(it.uni ? { uni: true } : {}),
  ...(it.track ? { track: it.track } : {}),
  ...(it.rir != null ? { rir: it.rir } : {}),
  ...(it.rest ? { rest: it.rest } : {}),
})
export const sr = (it) => `${it.sets}×${String(it.reps).trim()}`
export const norm = (it) => ({ ...it, sets: Math.max(1, Math.min(50, +it.sets || 3)), reps: String(it.reps || '').trim().slice(0, 20) || '10' })

// Qué cambia: day = { name, items[{fromId?}], baseId, baseName, base[{id, ex, sets, reps}] }
export function diffDay(day) {
  const base = day?.base || []
  const items = day?.items || []
  const out = []
  if (day?.baseName && day.name && day.name !== day.baseName) out.push({ t: 'name', from: day.baseName, to: day.name })
  for (const it of items) {
    const b = it.fromId && base.find((x) => x.id === it.fromId)
    if (!b) out.push({ t: 'add', ex: it.ex, sr: sr(it) })
    else if (b.ex !== it.ex) out.push({ t: 'swap', from: b.ex, ex: it.ex, sr: sr(it) })
    else if (sr(b) !== sr(it)) out.push({ t: 'sets', ex: it.ex, from: sr(b), sr: sr(it) })
  }
  for (const b of base) if (!items.some((it) => it.fromId === b.id)) out.push({ t: 'del', ex: b.ex })
  return out
}

// Aplica los cambios aceptados al día del plan. Respeta lo que el alumno haya tocado después de la propuesta.
export function applyChanges(plan, day) {
  const p = plan.find((x) => x.id === day.baseId)
  if (!p) return null
  const base = day.base || []
  const baseIds = new Set(base.map((b) => b.id))
  const items = []
  for (const raw of day.items || []) {
    const it = norm(raw)
    const cur = it.fromId && p.items.find((x) => x.id === it.fromId)
    const b = it.fromId && base.find((x) => x.id === it.fromId)
    const changed = !b || b.ex !== it.ex || sr(b) !== sr(it)
    if (cur) {
      // si cambia el ejercicio, fuera lo que era propio del anterior (unilateral, tipo de medida)
      const { uni, track, ...rest } = cur
      items.push({ ...(cur.ex !== it.ex ? rest : cur), ...clean(it), id: cur.id, drop: !!it.drop })
    } else if (changed) items.push({ ...clean(it), id: newId(), drop: !!it.drop })
    // si él lo quitó después y el entrenador no lo tocó, no vuelve
  }
  // lo que el alumno añadió después de la propuesta se queda al final
  for (const x of p.items) if (!baseIds.has(x.id)) items.push(x)
  return plan.map((x) => (x.id === p.id ? { ...x, name: day.name || x.name, items } : x))
}
