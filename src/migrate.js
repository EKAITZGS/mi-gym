// Versionado del documento `migym.v1` y fusión segura entre móvil y nube.
//
// Reglas (ver AUDIT_MI_GYM_2_0.md §7):
//  - Cada paso de migración SOLO añade o normaliza campos; nunca borra, renombra ni cambia ids.
//  - `migrate()` es idempotente: aplicarla dos veces da lo mismo.
//  - Antes de subir de versión se guarda una copia `migym.v1.pre-<v>` (una sola vez).
//  - `mergeData()` nunca descarta un entreno: las sesiones se unen por id.
import { DEFAULT } from './store'

export const SCHEMA = 2

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const arr = (v) => (Array.isArray(v) ? v : [])
const obj = (v) => (isObj(v) ? v : {})

// Pasos: clave = versión de origen → devuelve el documento en la versión siguiente
const STEPS = {
  // v1 → v2: forma mínima garantizada (arrays y objetos existen), sin tocar contenido
  1: (d) => ({
    ...d,
    goals: { ...DEFAULT.goals, ...obj(d.goals) },
    plan: arr(d.plan).map((day) => ({ ...day, items: arr(day?.items) })),
    sessions: arr(d.sessions),
    food: obj(d.food),
    myFoods: arr(d.myFoods),
    myExercises: arr(d.myExercises),
    v: 2,
  }),
}

// claves con `undefined` no pisan el valor por defecto
const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

export function migrate(raw) {
  let d = { ...DEFAULT, ...defined(obj(raw)) }
  let v = Number(d.v) || 1
  // documentos marcados con una versión más nueva que esta app: no se tocan (compatibilidad hacia delante)
  if (v > SCHEMA) return d
  while (v < SCHEMA) {
    const step = STEPS[v]
    if (!step) break
    d = step(d)
    v = Number(d.v) || v + 1
  }
  return d
}

export const needsMigration = (raw) => (Number(obj(raw).v) || 1) < SCHEMA

// Copia de seguridad previa a una migración (solo la primera vez para cada versión)
export function backupBeforeMigrate(rawText, fromV) {
  try {
    const k = `migym.v1.pre-${SCHEMA}`
    if (fromV < SCHEMA && rawText && !localStorage.getItem(k)) localStorage.setItem(k, rawText)
  } catch {}
}

// Validación de una copia (exportada o bajada): forma básica; el contenido lo normaliza `migrate`
export function validBackup(o) {
  if (!isObj(o) || !Array.isArray(o.plan)) return false
  if (['sessions', 'myFoods', 'myExercises'].some((k) => k in o && o[k] != null && !Array.isArray(o[k]))) return false
  if (['food', 'goals'].some((k) => k in o && o[k] != null && !isObj(o[k]))) return false
  return true
}

const byId = (list, key = 'id') => {
  const m = new Map()
  for (const x of arr(list)) if (x && x[key] != null) m.set(x[key], x)
  return m
}

// Une dos listas por id: lo de `a` manda, lo de `b` que falte se añade; orden final por fecha
function unionSessions(a, b) {
  const m = byId(b)
  for (const s of arr(a)) if (s?.id != null) m.set(s.id, s)
  // sesiones antiguas sin id (no debería haber): se conservan todas
  const noId = [...arr(a), ...arr(b)].filter((s) => s && s.id == null)
  return [...m.values(), ...noId].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
}

// Fusión cuando hay cambios en los dos sitios: gana `winner` (normalmente el móvil), pero
// ningún entreno ni ejercicio propio del otro lado se pierde. Devuelve también qué se recuperó.
export function mergeData(winner, other) {
  const w = migrate(winner)
  const o = migrate(other)
  const sessions = unionSessions(w.sessions, o.sessions)
  const ex = byId(o.myExercises)
  for (const x of w.myExercises) ex.set(x.id, x)
  const recovered = sessions.length - w.sessions.length
  return { data: { ...w, sessions, myExercises: [...ex.values()] }, recovered }
}
