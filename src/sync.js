// Sincronización entre dispositivos: fusión a tres bandas y "base" común.
//
// base   = la última versión que este móvil y la nube tenían en común (se guarda en IndexedDB).
// local  = lo que hay ahora en este móvil.
// remote = lo que hay ahora en la nube.
//
// Regla, registro a registro (cada entreno, comida, pesaje, día de la rutina, ejercicio propio...):
//  - si solo ha cambiado un lado, gana ese cambio (también si el cambio es borrarlo);
//  - si han cambiado los dos, gana este móvil, pero un registro editado nunca se pierde por un borrado
//    en el otro lado, y se anota como conflicto (y se guarda copia de lo de la nube).
// Sin base (primera vez tras actualizar): se juntan los dos lados sin borrar nada.
// No cambia la forma de los datos: solo compara y une.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Comparación independiente del orden de las claves (Postgres jsonb las reordena). Memo por objeto:
// los datos de la app son inmutables (React), así que el texto de un objeto no cambia.
const memo = new WeakMap()
export function canon(v) {
  if (v !== null && typeof v === 'object') {
    const hit = memo.get(v)
    if (hit !== undefined) return hit
  }
  const s = Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : isObj(v)
      ? `{${Object.keys(v)
          .filter((k) => v[k] !== undefined)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canon(v[k]))
          .join(',')}}`
      : JSON.stringify(v ?? null)
  if (v !== null && typeof v === 'object') memo.set(v, s)
  return s
}
const eq = (a, b) => a === b || canon(a) === canon(b)

// Clave estable de un registro dentro de una lista: id, o la fecha (pesajes y cintura van uno por día)
const keyOf = (x) => (isObj(x) ? (x.id != null ? 'i:' + x.id : typeof x.date === 'string' ? 'd:' + x.date : null) : null)

// ¿cómo se une una lista? 'keyed' (registros con id/fecha), 'set' (valores sueltos, p. ej. favoritos) o 'atomic'
function listKind(lists) {
  const all = lists.flat()
  if (!all.length) return 'set'
  if (all.every((x) => x === null || typeof x !== 'object')) return 'set'
  for (const l of lists) {
    const keys = l.map(keyOf)
    if (keys.some((k) => k == null) || new Set(keys).size !== keys.length) return 'atomic'
  }
  return 'keyed'
}

function mergeKeyed(b, l, r, path, out) {
  const mb = new Map(b.map((x) => [keyOf(x), x]))
  const ml = new Map(l.map((x) => [keyOf(x), x]))
  const mr = new Map(r.map((x) => [keyOf(x), x]))
  const keys = [...ml.keys(), ...[...mr.keys()].filter((k) => !ml.has(k))]
  const res = []
  for (const k of keys) {
    const v = m3(mb.get(k), ml.get(k), mr.get(k), `${path}[${k}]`, out)
    if (v !== undefined) res.push(v)
  }
  // listas con fecha (entrenos, pesajes...) siguen en orden cronológico
  if (res.length && res.every((x) => typeof x.date === 'string')) {
    return res.map((x, i) => [x, i]).sort((a, z) => (a[0].date < z[0].date ? -1 : a[0].date > z[0].date ? 1 : a[1] - z[1])).map((p) => p[0])
  }
  return res
}

function mergeSet(b, l, r) {
  const cb = new Set(b.map(canon))
  const cl = new Set(l.map(canon))
  const cr = new Set(r.map(canon))
  const keep = (c) => (cl.has(c) && cr.has(c)) || (cl.has(c) && !cb.has(c)) || (cr.has(c) && !cb.has(c))
  const res = l.filter((x) => keep(canon(x)))
  for (const x of r) if (!cl.has(canon(x)) && keep(canon(x))) res.push(x)
  return res
}

function m3(b, l, r, path, out) {
  if (eq(l, r)) return l
  if (eq(l, b)) return r
  if (eq(r, b)) return l
  // han cambiado los dos lados
  if (l === undefined || r === undefined) {
    // borrado en un lado y editado en el otro: se conserva lo editado (no se pierden datos)
    out.conflicts.push(path)
    return l === undefined ? r : l
  }
  if (isObj(l) && isObj(r)) {
    const bb = isObj(b) ? b : {}
    const res = {}
    for (const k of [...Object.keys(l), ...Object.keys(r).filter((k) => !(k in l))]) {
      const v = m3(bb[k], l[k], r[k], path ? `${path}.${k}` : k, out)
      if (v !== undefined) res[k] = v
    }
    return res
  }
  if (Array.isArray(l) && Array.isArray(r)) {
    const bl = Array.isArray(b) ? b : []
    const kind = listKind([bl, l, r])
    if (kind === 'keyed') return mergeKeyed(bl, l, r, path, out)
    if (kind === 'set') return mergeSet(bl, l, r)
  }
  out.conflicts.push(path)
  return l
}

// → { data, conflicts: [rutas] }. `base` puede ser null (sin versión común conocida).
export function merge3(base, local, remote) {
  const out = { conflicts: [] }
  const data = m3(base ?? undefined, local, remote, '', out)
  return { data, conflicts: out.conflicts }
}

/* ---------- Base común y copias, en IndexedDB (en localStorage no cabrían dos copias más) ---------- */
const DB = 'migym-sync'
const STORE = 'kv'
const hasIdb = () => typeof indexedDB !== 'undefined'
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function kv(mode, fn) {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => res(req?.result)
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}
// Versión común guardada para esta cuenta (null si no hay o es de otra cuenta)
export async function getBase(uid) {
  if (!hasIdb()) return null
  try {
    const v = await kv('readonly', (s) => s.get('base'))
    return v && v.uid === uid ? v.data : null
  } catch {
    return null
  }
}
export async function setBase(uid, data) {
  if (!hasIdb() || !uid) return
  try {
    await kv('readwrite', (s) => s.put({ uid, data, at: Date.now() }, 'base'))
  } catch {}
}
// Copias de seguridad antes de fusionar ('antes-fusion') y de lo de la nube en conflictos ('nube-anterior')
export async function saveBackup(name, data) {
  if (!hasIdb()) return
  try {
    await kv('readwrite', (s) => s.put({ data, at: Date.now() }, 'bak:' + name))
  } catch {}
}
export async function getBackup(name) {
  if (!hasIdb()) return null
  try {
    return (await kv('readonly', (s) => s.get('bak:' + name))) || null
  } catch {
    return null
  }
}
