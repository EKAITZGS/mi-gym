// Cuentas y copia en la nube con Supabase.
// El móvil sigue siendo lo principal (la app funciona igual sin cuenta y sin conexión); la nube guarda una copia
// de todo `migym.v1` por usuario y la mantiene al día. Las fotos de progreso se quedan solo en el móvil.
import { useEffect, useRef, useState } from 'react'
import { DEFAULT } from './store'
import { migrate, mergeData } from './migrate'
import { merge3, getBase, setBase, saveBackup, canon } from './sync'

// Proyecto de Supabase. La clave "anon"/"publishable" es pública por diseño: lo que protege los datos son las
// reglas RLS de supabase/schema.sql (cada usuario solo ve lo suyo).
// VITE_CLOUD=off → app sin cuentas (solo para pruebas locales/Playwright)
const NO_CLOUD = import.meta.env.VITE_CLOUD === 'off'
export const SB_URL = NO_CLOUD ? '' : import.meta.env.VITE_SB_URL || 'https://fsantamxmriodlriantf.supabase.co'
export const SB_KEY = NO_CLOUD ? '' : import.meta.env.VITE_SB_KEY || 'sb_publishable_700NfTmDI4rbA3stzszyJg_ToevFG-m'
export const cloudReady = () => !!(SB_URL && SB_KEY)

let clientP = null
// supabase-js se carga solo cuando hace falta (no pesa al abrir la app sin cuenta)
export function sb() {
  if (!clientP)
    clientP = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SB_URL, SB_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'migym.sb' },
      })
    )
  return clientP
}

// { uid, email, synced: updated_at de la copia de la nube que tenemos, dirty: hay cambios sin subir }
const META = 'migym.cloud'
export const cloudMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(META) || 'null')
  } catch {
    return null
  }
}
const setMeta = (m) => {
  try {
    if (m) localStorage.setItem(META, JSON.stringify(m))
    else localStorage.removeItem(META)
  } catch {}
  window.dispatchEvent(new Event('migym-cloud'))
}
const patchMeta = (p) => {
  const m = cloudMeta()
  if (m) setMeta({ ...m, ...p })
}

const ERR = [
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/already registered|already been registered|user already exists/i, 'Ya hay una cuenta con ese email. Entra con tu contraseña.'],
  [/email not confirmed/i, 'Confirma tu email antes de entrar (mira el correo y la carpeta de spam).'],
  [/password should be at least (\d+)/i, (m) => `La contraseña necesita al menos ${m[1]} caracteres.`],
  [/password should contain/i, 'La contraseña necesita minúsculas, mayúsculas y números (ej.: Gym2026ok).'],
  [/pwned|leaked|weak password/i, 'Esa contraseña es demasiado fácil o ha salido en filtraciones. Elige otra.'],
  [/email rate limit/i, 'Se han mandado demasiados emails de confirmación seguidos. Prueba dentro de un rato (hasta 1 hora).'],
  [/rate limit|too many|security purposes/i, 'Demasiados intentos seguidos. Espera un minuto y prueba otra vez.'],
  [/invalid.*email|unable to validate email/i, 'Ese email no parece válido.'],
  [/failed to fetch|network/i, 'Sin conexión. Prueba cuando tengas internet.'],
]
const es = (e) => {
  const m = String(e?.message || e || '')
  for (const [r, t] of ERR) {
    const hit = m.match(r)
    if (hit) return typeof t === 'function' ? t(hit) : t
  }
  return `Algo ha fallado: ${m || 'error desconocido'}`
}
const appUrl = () => location.origin + location.pathname

export async function signUp(email, password, name, role = 'user') {
  const c = await sb()
  const { data, error } = await c.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim(), role: role === 'trainer' ? 'trainer' : 'user' }, emailRedirectTo: appUrl() },
  })
  if (error) throw new Error(es(error))
  // Supabase no da error si el email ya existe y está confirmado: devuelve un usuario sin identidades
  if (data.user && !data.user.identities?.length) throw new Error(es('already registered'))
  return { user: data.user, session: data.session }
}

export async function signIn(email, password) {
  const c = await sb()
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(es(error))
  return data.user
}

export async function resetPassword(email) {
  const c = await sb()
  const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
  if (error) throw new Error(es(error))
}

export async function updatePassword(password) {
  const c = await sb()
  const { error } = await c.auth.updateUser({ password })
  if (error) throw new Error(es(error))
}

// Cerrar sesión: los datos del móvil se quedan; solo deja de sincronizar
export async function signOut() {
  try {
    const c = await sb()
    await c.auth.signOut()
  } catch {}
  setMeta(null)
}

// ¿sigue la sesión abierta? (si caduca, hay que volver a entrar)
async function hasSession() {
  const c = await sb()
  const { data } = await c.auth.getSession()
  return !!data.session
}

async function pull(uid) {
  const c = await sb()
  const { data, error } = await c.from('user_data').select('data, updated_at').eq('user_id', uid).maybeSingle()
  if (error) throw new Error(es(error))
  return data
}

// Subida explícita (cuenta nueva o cuando el usuario elige "lo de este móvil"): escribe sin mirar
async function push(uid, data) {
  const c = await sb()
  const updated_at = new Date().toISOString()
  const { error } = await c.from('user_data').upsert({ user_id: uid, data, updated_at, device: navigator.userAgent.slice(0, 120) })
  if (error) throw new Error(es(error))
  await setBase(uid, data)
  return updated_at
}

// Subida automática con control de versión: solo escribe si la nube sigue en la versión que conocemos
// (prevAt). Si otro dispositivo ha guardado entretanto devuelve { conflict: true } y no pisa nada.
async function pushIf(uid, data, prevAt) {
  const c = await sb()
  const updated_at = new Date().toISOString()
  const row = { data, updated_at, device: navigator.userAgent.slice(0, 120) }
  if (prevAt) {
    const { data: rows, error } = await c.from('user_data').update(row).eq('user_id', uid).eq('updated_at', prevAt).select('updated_at')
    if (error) throw new Error(es(error))
    return rows?.length ? { at: updated_at } : { conflict: true }
  }
  // sin versión conocida: solo se crea si aún no existe
  const { error } = await c.from('user_data').insert({ user_id: uid, ...row })
  if (error) {
    if (error.code === '23505' || /duplicate key/i.test(error.message)) return { conflict: true }
    throw new Error(es(error))
  }
  return { at: updated_at }
}
const sameAt = (a, b) => !!a && !!b && Date.parse(a) === Date.parse(b)
// tiempo máximo de cada llamada a la nube: si no contesta, se suelta y se reintenta (no se queda «subiendo» para siempre)
const NET_MS = 20000
const timed = (p, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`La nube no responde (${what}). Se reintentará.`)), NET_MS))])

// Registro de la sincronización (Perfil → tocar el estado): las últimas 20 cosas que ha hecho, para saber qué pasa
const LOG = 'migym.synclog'
export function syncLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG) || '[]')
  } catch {
    return []
  }
}
function logSync(t, msg = '') {
  try {
    const l = syncLog()
    l.unshift({ at: new Date().toISOString(), t, msg: String(msg).slice(0, 160) })
    localStorage.setItem(LOG, JSON.stringify(l.slice(0, 20)))
  } catch {}
}

// Junta lo de este móvil con lo de la nube. Con versión común (base): fusión a tres bandas, registro a registro.
// Sin base: si aquí no hay cambios pendientes manda la nube; si los hay, se une todo sin borrar nada.
async function mergeWithCloud(uid, local, row, dirty) {
  const remote = migrate(row.data)
  const base = await getBase(uid)
  if (!base && !dirty) return { data: remote, conflicts: [] }
  const r = merge3(base, local, remote)
  await saveBackup('antes-fusion', local)
  if (r.conflicts.length) await saveBackup('nube-anterior', row.data)
  return r
}

// cuenta nueva: todo vacío (sin el plan de ejemplo); la bienvenida le ayuda a crear el suyo
export const CLEAN = { ...DEFAULT, plan: [] }
const hasData = (d) => !!(d?.sessions?.length || Object.keys(d?.food || {}).length || d?.body?.waist?.length || d?.body?.weight?.length)
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`
export const summary = (d) =>
  [pl(d?.sessions?.length || 0, 'entreno', 'entrenos'), pl(Object.keys(d?.food || {}).length, 'día de dieta', 'días de dieta'), pl(d?.body?.weight?.length || 0, 'pesaje', 'pesajes')].join(', ')
// Postgres (jsonb) cambia el orden de las claves: se compara con las claves ordenadas
const same = (a, b) => canon(a) === canon(b)
// guarda lo que había en el móvil antes de cambiarlo por lo de la nube, por si acaso
const keepLocal = () => {
  try {
    const s = localStorage.getItem('migym.v1')
    if (s) localStorage.setItem('migym.v1.antes-nube', s)
  } catch {}
}

// Al entrar en la cuenta: decide qué hacer con lo del móvil y lo de la nube, sin perder nada.
// → { action: 'uploaded' | 'downloaded' | 'same' | 'conflict', cloud? }
const LAST = 'migym.lastUid'

// Cosas de este móvil que son de la cuenta: reloj Polar, avisos y clave de IA. Si entra otra cuenta se
// guardan aparte (y se apagan los avisos del anterior) y se recuperan las de la cuenta que entra.
const DEV_KEYS = ['migym.polar', 'migym.push', 'migym.groqkey', 'migym.groqmodel']
async function swapDevice(prevUid, uid) {
  try {
    const bag = {}
    for (const k of DEV_KEYS) {
      const v = localStorage.getItem(k)
      if (v != null) bag[k] = v
    }
    if (bag['migym.push']) await import('./push').then((m) => m.disablePush()).catch(() => {})
    for (const k of DEV_KEYS) localStorage.removeItem(k)
    if (prevUid && Object.keys(bag).length) localStorage.setItem('migym.dev.' + prevUid, JSON.stringify(bag))
    const mine = JSON.parse(localStorage.getItem('migym.dev.' + uid) || '{}')
    for (const [k, v] of Object.entries(mine)) localStorage.setItem(k, v)
    localStorage.removeItem('migym.dev.' + uid)
  } catch {}
}

// nombre y rol (usuario / entrenador) de la cuenta
export async function fetchProfile(uid) {
  const c = await sb()
  const { data } = await c.from('profiles').select('name, role').eq('id', uid).maybeSingle()
  return data || null
}

async function startClean(uid, base, setData) {
  setData({ ...CLEAN })
  const at = await push(uid, { ...CLEAN })
  setMeta({ ...base, synced: at })
}

// Al entrar en la cuenta: decide qué hacer con lo del móvil y lo de la nube, sin perder nada.
// → { action: 'uploaded' | 'downloaded' | 'same' | 'fresh' | 'ask' | 'conflict', cloud? }
export async function connect(user, local, setData) {
  const [row, profile] = await Promise.all([pull(user.id), fetchProfile(user.id).catch(() => null)])
  const base = { uid: user.id, email: user.email, dirty: false, name: profile?.name || '', role: profile?.role || user.user_metadata?.role || 'user' }
  let last = null
  try {
    last = localStorage.getItem(LAST)
    localStorage.setItem(LAST, user.id)
  } catch {}
  const other = last && last !== user.id
  if (other) await swapDevice(last, user.id)
  if (!row) {
    if (!hasData(local)) {
      await startClean(user.id, base, setData)
      return { action: 'fresh' }
    }
    if (other) {
      // lo del móvil es de otra cuenta: se guarda aparte y esta empieza limpia
      keepLocal()
      await startClean(user.id, base, setData)
      return { action: 'fresh' }
    }
    // hay datos en el móvil y la cuenta está vacía: ¿son suyos? Lo decide el usuario
    setMeta({ ...base, synced: null, pending: true, ask: true })
    return { action: 'ask' }
  }
  if (other && hasData(local)) keepLocal()
  // misma cuenta que la última vez en este móvil: lo de la nube es lo bueno (se subió todo al cerrar sesión)
  if (last === user.id && !same(row.data, local)) {
    keepLocal()
    const common = await getBase(user.id)
    if (common) {
      // misma cuenta y versión común conocida: fusión registro a registro (lo cambiado aquí sin subir no se pierde)
      const r = merge3(common, local, migrate(row.data))
      await saveBackup('antes-fusion', local)
      if (r.conflicts.length) await saveBackup('nube-anterior', row.data)
      await setBase(user.id, migrate(row.data))
      setMeta({ ...base, synced: row.updated_at, dirty: !same(r.data, row.data) })
      setData(r.data)
      return { action: 'downloaded' }
    }
    // sin versión común: lo de la nube manda (se subió todo al cerrar sesión), pero un entreno hecho en este móvil sin subir no se pierde
    const m = mergeData(row.data, local)
    await setBase(user.id, migrate(row.data))
    setMeta({ ...base, synced: row.updated_at, dirty: m.recovered > 0 })
    setData(m.data)
    return { action: 'downloaded', recovered: m.recovered }
  }
  if (other || !hasData(local)) {
    await setBase(user.id, migrate(row.data))
    setMeta({ ...base, synced: row.updated_at })
    setData(migrate(row.data))
    return { action: 'downloaded' }
  }
  if (same(row.data, local)) {
    await setBase(user.id, migrate(row.data))
    setMeta({ ...base, synced: row.updated_at })
    return { action: 'same' }
  }
  // hay datos en los dos sitios y son distintos: elige el usuario
  setMeta({ ...base, synced: null, pending: true })
  return { action: 'conflict', cloud: row }
}

// Resolver el conflicto: 'cloud' usa lo de la cuenta, 'local' sube lo del móvil
export async function resolve(choice, cloud, local, setData) {
  const m = cloudMeta()
  if (!m) return
  if (choice === 'fresh') {
    keepLocal()
    setData({ ...CLEAN })
    const at = await push(m.uid, { ...CLEAN })
    setMeta({ ...m, pending: false, ask: false, dirty: false, synced: at })
    return
  }
  if (choice === 'cloud') {
    keepLocal()
    // elige la nube, pero los entrenos del móvil que allí no estén se conservan
    const mg = mergeData(cloud.data, local)
    await setBase(m.uid, migrate(cloud.data))
    setMeta({ ...m, pending: false, dirty: mg.recovered > 0, synced: cloud.updated_at })
    setData(mg.data)
  } else {
    const at = await push(m.uid, local)
    setMeta({ ...m, pending: false, ask: false, dirty: false, synced: at })
  }
}

// Sincronía automática: sube los cambios (a los 3 s) y, al abrir o volver a la app, baja lo que se haya
// cambiado en otro móvil. Devuelve el estado para enseñarlo en Ajustes.
export function useCloudSync(data, setData) {
  const [state, setState] = useState(() => ({ meta: cloudMeta(), busy: false, error: '', recovery: false }))
  // último dato que ha puesto la sincronización (no cuenta como cambio tuyo)
  const appliedRef = useRef(null)
  const first = useRef(true)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const on = () => setState((s) => ({ ...s, meta: cloudMeta() }))
    window.addEventListener('migym-cloud', on)
    return () => window.removeEventListener('migym-cloud', on)
  }, [])

  // enlaces del email (confirmar cuenta / nueva contraseña): supabase-js lee el token de la URL
  useEffect(() => {
    if (!cloudReady()) return
    if (/type=(signup|email)/.test(location.hash)) setState((s) => ({ ...s, confirmed: true }))
    if (!cloudMeta() && !/access_token|type=recovery|error_description/.test(location.hash)) return
    let sub
    sb().then((c) => {
      sub = c.auth.onAuthStateChange((ev) => {
        if (ev === 'PASSWORD_RECOVERY') setState((s) => ({ ...s, recovery: true }))
      }).data.subscription
    })
    return () => sub?.unsubscribe()
  }, [])

  const expired = async () => {
    if (await timed(hasSession(), 'sesión')) return false
    logSync('sesión', 'caducada')
    setState((s) => ({ ...s, busy: false, error: 'Tu sesión ha caducado: vuelve a entrar en tu cuenta.' }))
    setMeta(null)
    return true
  }

  // Aplica lo fusionado. `from` = lo que había aquí cuando empezó la fusión: si mientras tanto has cambiado algo,
  // se junta también (tu último cambio no se pierde).
  const apply = (next, from) => {
    const cur = dataRef.current
    const res = cur === from ? next : merge3(from, cur, next).data
    if (same(res, cur)) return
    appliedRef.current = res
    dataRef.current = res
    setData((c) => (c === cur ? res : merge3(cur, c, res).data))
  }
  const uploading = useRef(0) // hora de inicio de la subida en curso (0 = ninguna)
  const again = useRef(false)

  const upload = async () => {
    let m = cloudMeta()
    if (!m?.uid || m.pending) return
    // una subida cada vez; si llega otra mientras, se repite al terminar (y una subida colgada se suelta al minuto)
    if (uploading.current && Date.now() - uploading.current < 60000) {
      again.current = true
      return
    }
    uploading.current = Date.now()
    setState((s) => ({ ...s, busy: true }))
    let err = ''
    try {
      if (await expired()) {
        err = 'Tu sesión ha caducado: vuelve a entrar en tu cuenta.'
        return
      }
      for (let i = 0; i < 4; i++) {
        const sent = dataRef.current
        const r = await timed(pushIf(m.uid, sent, m.synced), 'subir')
        if (r.at) {
          await setBase(m.uid, sent)
          patchMeta({ synced: r.at, dirty: dataRef.current !== sent })
          logSync('subida', `${Math.round(JSON.stringify(sent).length / 1024)} KB`)
          return
        }
        // otro dispositivo guardó antes: se trae lo suyo, se fusiona con lo de aquí y se vuelve a intentar
        const row = await timed(pull(m.uid), 'traer')
        if (!row) {
          m = { ...m, synced: null }
          continue
        }
        const local = dataRef.current
        const merged = await mergeWithCloud(m.uid, local, row, true)
        await setBase(m.uid, migrate(row.data))
        patchMeta({ synced: row.updated_at })
        apply(merged.data, local)
        logSync('fusión', `otro dispositivo había guardado antes${merged.conflicts.length ? ` · ${merged.conflicts.length} dato(s) cambiados en los dos: gana este` : ''}`)
        m = cloudMeta()
      }
      err = 'No se pudo guardar en tu cuenta (cambios a la vez en otro dispositivo). Se reintentará.'
    } catch (e) {
      err = e.message
    } finally {
      if (err) logSync('error', err)
      uploading.current = 0
      setState((s) => ({ ...s, busy: false, error: err }))
      // si mientras subía cambiaste algo, se sube enseguida (no se queda «Cambios por subir»)
      if (again.current || (!err && cloudMeta()?.dirty)) {
        again.current = false
        setTimeout(upload, 300)
      }
    }
  }

  const download = async () => {
    const m = cloudMeta()
    if (!m?.uid || m.pending || uploading.current) return
    try {
      if (await expired()) return
      fetchProfile(m.uid)
        .then((p) => p && (p.role !== m.role || p.name !== m.name) && patchMeta({ role: p.role, name: p.name }))
        .catch(() => {})
      const row = await timed(pull(m.uid), 'traer')
      if (!row) return upload()
      if (sameAt(row.updated_at, m.synced)) {
        // la nube sigue como la dejamos: esa es la versión común
        await setBase(m.uid, migrate(row.data))
        return cloudMeta()?.dirty ? upload() : null
      }
      // ha cambiado en otro dispositivo: se fusiona (si aquí no había nada pendiente, simplemente se baja)
      const local = dataRef.current
      const dirty = !!cloudMeta()?.dirty
      const merged = await mergeWithCloud(m.uid, local, row, dirty)
      await setBase(m.uid, migrate(row.data))
      apply(merged.data, local)
      const pending = !same(dataRef.current, migrate(row.data))
      patchMeta({ synced: row.updated_at, dirty: pending })
      logSync('bajada', `cambios de otro dispositivo${pending ? ' · se juntan con los de aquí' : ''}`)
      if (pending) upload()
      setState((s) => ({ ...s, error: '' }))
    } catch (e) {
      logSync('error', e.message)
      setState((s) => ({ ...s, error: e.message }))
    }
  }

  // cada cambio de datos: marcar pendiente y subir a los 3 s
  useEffect(() => {
    // al abrir la app no hay cambios nuevos: primero se mira la nube
    if (first.current) {
      first.current = false
      return
    }
    const m = cloudMeta()
    if (!m?.uid || m.pending) return
    // lo que acaba de poner la sincronización no es un cambio tuyo; pero si hay algo pendiente, se sube igualmente
    const fromCloud = data === appliedRef.current
    // si lo puso una subida o bajada en marcha, esa misma se encarga de subirlo
    if (fromCloud && (!m.dirty || uploading.current)) return
    if (!m.dirty) patchMeta({ dirty: true })
    const t = setTimeout(upload, 3000)
    return () => clearTimeout(t)
  }, [data])

  // al abrir, al volver a la app y al recuperar conexión
  useEffect(() => {
    if (!cloudReady()) return
    let last = 0
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 30000) return
      last = Date.now()
      download()
    }
    check()
    const online = () => {
      last = 0
      check()
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', online)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', online)
    }
  }, [])

  const doneRecovery = () => setState((s) => ({ ...s, recovery: false }))
  return { ...state, upload, download, doneRecovery }
}

// ---- Entrenadores y alumnos (tabla coach_links, ver supabase/02-entrenadores.sql) ----
const uidNow = () => cloudMeta()?.uid
const q = async (fn) => {
  const c = await sb()
  const { data, error } = await fn(c)
  if (error) throw new Error(/coach_links|relation|does not exist/i.test(error.message) ? 'Falta activar lo de entrenadores en Supabase (02-entrenadores.sql).' : es(error))
  return data
}
export async function listTrainers() {
  try {
    return await q((c) => c.from('profiles').select('id, name, bio').eq('role', 'trainer').order('name'))
  } catch {
    // sin la columna bio (falta 03-perfil.sql)
    return q((c) => c.from('profiles').select('id, name').eq('role', 'trainer').order('name'))
  }
}

// Perfil: nombre, tipo de cuenta (usuario / entrenador) y "sobre mí" del entrenador
export async function getMyProfile() {
  const uid = uidNow()
  try {
    return await q((c) => c.from('profiles').select('name, role, bio').eq('id', uid).maybeSingle())
  } catch {
    return q((c) => c.from('profiles').select('name, role').eq('id', uid).maybeSingle())
  }
}
export async function updateProfile({ name, role, bio }) {
  const uid = uidNow()
  const row = { name: name.trim().slice(0, 40), role: role === 'trainer' ? 'trainer' : 'user' }
  const c = await sb()
  let { error } = await c.from('profiles').update({ ...row, bio: (bio || '').trim().slice(0, 240) || null }).eq('id', uid)
  let noBio = false
  if (error && /bio/i.test(error.message)) {
    noBio = true
    ;({ error } = await c.from('profiles').update(row).eq('id', uid))
  }
  if (error) throw new Error(es(error))
  // si deja de ser entrenador, sus alumnos dejan de estar con él
  if (row.role === 'user') await c.from('coach_links').delete().eq('trainer_id', uid)
  await c.auth.updateUser({ data: { name: row.name, role: row.role } }).catch(() => {})
  patchMeta({ name: row.name, role: row.role })
  return { noBio }
}
export async function countStudents() {
  const uid = uidNow()
  const rows = await q((c) => c.from('coach_links').select('id').eq('trainer_id', uid))
  return rows.length
}
export const myLinks = () => q((c) => c.from('coach_links').select('id, user_id, trainer_id, status, created_at, updated_at').order('created_at', { ascending: false }))
export async function requestTrainer(trainerId) {
  const uid = uidNow()
  // si te rechazó antes, se borra la solicitud vieja para poder pedir otra vez
  await q((c) => c.from('coach_links').delete().eq('user_id', uid).eq('trainer_id', trainerId).eq('status', 'rejected'))
  return q((c) => c.from('coach_links').insert({ user_id: uid, trainer_id: trainerId }))
}
export const removeLink = (id) => q((c) => c.from('coach_links').delete().eq('id', id))
export const answerLink = (id, ok) => q((c) => c.from('coach_links').update({ status: ok ? 'accepted' : 'rejected', updated_at: new Date().toISOString() }).eq('id', id))
export const profilesOf = (ids) => (ids.length ? q((c) => c.from('profiles').select('id, name').in('id', ids)) : Promise.resolve([]))
// Datos del alumno: el servidor devuelve solo plan, entrenos, cuerpo y pulso (student_data de 05-privacidad.sql).
// Ya no hay lectura de la fila entera: RLS no la permite y no debe intentarse.
export async function studentData(uid) {
  const c = await sb()
  const r = await c.rpc('student_data', { uid })
  if (!r.error) return Array.isArray(r.data) ? r.data[0] || null : r.data
  if (/function|does not exist|schema cache/i.test(r.error.message)) throw new Error('Falta activar la privacidad del alumno en Supabase (05-privacidad.sql).')
  throw new Error(es(r.error))
}

// Eliminar la cuenta entera (datos, perfil, relaciones y usuario). Necesita 05-privacidad.sql en Supabase.
export async function deleteAccount() {
  const c = await sb()
  const { error } = await c.rpc('delete_my_account')
  if (error) {
    if (/function|does not exist|schema cache/i.test(error.message)) throw new Error('Falta activar el borrado de cuenta en Supabase (05-privacidad.sql).')
    throw new Error(es(error))
  }
  try {
    for (const k of ['migym.v1', 'migym.cloud', 'migym.lastUid', 'migym.push', 'migym.polar']) localStorage.removeItem(k)
  } catch {}
  await signOut()
}

// ---- Mensajes y entrenos del entrenador (supabase/04-mensajes.sql) ----
const need04 = (e) => (/coach_messages|coach_workouts|in_link|does not exist/i.test(e.message) ? new Error('Falta activar mensajes y entrenos en Supabase (04-mensajes.sql).') : e)
const q4 = async (fn) => {
  try {
    return await q(fn)
  } catch (e) {
    throw need04(e)
  }
}
export const listMessages = (linkId) => q4((c) => c.from('coach_messages').select('id, sender_id, body, created_at, read_at').eq('link_id', linkId).order('created_at').limit(300))
export const sendMessage = (linkId, body) => q4((c) => c.from('coach_messages').insert({ link_id: linkId, sender_id: uidNow(), body: body.trim().slice(0, 2000) }))
export const markRead = (linkId) =>
  q4((c) => c.from('coach_messages').update({ read_at: new Date().toISOString() }).eq('link_id', linkId).neq('sender_id', uidNow()).is('read_at', null))
export const listWorkouts = (linkId) => q4((c) => c.from('coach_workouts').select('id, day, note, status, created_at, answered_at').eq('link_id', linkId).order('created_at', { ascending: false }).limit(50))
export const sendWorkout = (linkId, day, note) => q4((c) => c.from('coach_workouts').insert({ link_id: linkId, day, note: (note || '').trim().slice(0, 500) || null }))
export const answerWorkout = (id, ok) => q4((c) => c.from('coach_workouts').update({ status: ok ? 'accepted' : 'rejected', answered_at: new Date().toISOString() }).eq('id', id))
export const deleteWorkout = (id) => q4((c) => c.from('coach_workouts').delete().eq('id', id))

// ---- Aviso al entrenador cuando el alumno termina un entreno ----
// Va como un mensaje marcado (sin tablas nuevas). Se guarda en cola por si en el gimnasio no hay cobertura.
export const TRAIN_TAG = '⟦entreno⟧ '
export const isTrainMsg = (b) => typeof b === 'string' && b.startsWith(TRAIN_TAG)
// al final va la referencia del entreno: " ⟦idDelEntreno|fecha⟧" (para enseñarlo entero con el pulso)
const REF = / ⟦([^|⟧]+)\|(\d{4}-\d{2}-\d{2})⟧$/
export const trainTxt = (b) => String(b || '').slice(TRAIN_TAG.length).replace(REF, '')
export const trainRef = (b) => {
  const m = String(b || '').match(REF)
  return m ? { sid: m[1], date: m[2] } : null
}
const NQ = 'migym.notify'
const readQ = () => {
  try {
    return JSON.parse(localStorage.getItem(NQ) || '[]')
  } catch {
    return []
  }
}
export function queueTrainerNote(text, ref) {
  const uid = uidNow()
  if (!uid) return
  const full = ref ? `${text} ⟦${ref.sid}|${ref.date}⟧` : text
  try {
    localStorage.setItem(NQ, JSON.stringify([...readQ(), { uid, text: full, at: Date.now() }].slice(-5)))
  } catch {}
  flushTrainerNotes().catch(() => {})
}
let flushing = false
export async function flushTrainerNotes() {
  const uid = uidNow()
  // solo los de esta cuenta y de los últimos 2 días
  const list = readQ().filter((n) => n.uid === uid && Date.now() - n.at < 2 * 864e5)
  if (!uid || flushing || !list.length) return
  flushing = true
  try {
    const c = await sb()
    const { data: links, error } = await c.from('coach_links').select('id').eq('user_id', uid).eq('status', 'accepted')
    if (error) throw error
    for (const l of links || [])
      for (const n of list) {
        const r = await c.from('coach_messages').insert({ link_id: l.id, sender_id: uid, body: (TRAIN_TAG + n.text).slice(0, 2000) })
        if (r.error) throw r.error
      }
    localStorage.removeItem(NQ)
  } finally {
    flushing = false
  }
}
// El entrenador ha visto la ficha: los avisos de entreno de ese alumno quedan leídos (los mensajes normales no)
export const markTrainRead = (linkId) =>
  q4((c) =>
    c
      .from('coach_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('link_id', linkId)
      .neq('sender_id', uidNow())
      .is('read_at', null)
      .like('body', TRAIN_TAG.trim() + '%')
  )

// Lo pendiente para avisar: mensajes sin leer, entrenos por responder (alumno) y solicitudes (entrenador)
export async function inbox() {
  const uid = uidNow()
  if (!uid) return null
  const c = await sb()
  flushTrainerNotes().catch(() => {})
  const [msgs, wks, links] = await Promise.all([
    c.from('coach_messages').select('id, link_id, body, created_at').neq('sender_id', uid).is('read_at', null).order('created_at'),
    c.from('coach_workouts').select('id, link_id, day').eq('status', 'pending'),
    c.from('coach_links').select('id, user_id, trainer_id, status'),
  ])
  const L = links.data || []
  const mineAsUser = new Set(L.filter((l) => l.user_id === uid).map((l) => l.id))
  const unread = msgs.data || []
  const chat = unread.filter((m) => !isTrainMsg(m.body))
  const trained = unread.filter((m) => isTrainMsg(m.body))
  const byLink = (l) => l.reduce((a, m) => ((a[m.link_id] = (a[m.link_id] || 0) + 1), a), {})
  return {
    messages: chat.length,
    msgByLink: byLink(chat),
    // entrenos nuevos de alumnos (avisos automáticos)
    trained: trained.length,
    trainedByLink: byLink(trained),
    trainedTxt: trained.length ? trainTxt(trained[trained.length - 1].body) : '',
    trainedLast: trained.length ? { link: trained[trained.length - 1].link_id, ...(trainRef(trained[trained.length - 1].body) || {}) } : null,
    workouts: (wks.data || []).filter((w) => mineAsUser.has(w.link_id)).length,
    // nombres de los días de los que el entrenador propone cambios
    changes: (wks.data || []).filter((w) => mineAsUser.has(w.link_id) && w.day?.baseId).map((w) => w.day.baseName || 'tu día'),
    requests: L.filter((l) => l.trainer_id === uid && l.status === 'pending').length,
  }
}

// ---- Panel de administración (supabase/06-admin.sql). Solo lectura; quién es admin lo decide el servidor. ----
const noFn = (e) => /function|does not exist|schema cache|could not find/i.test(e?.message || '')
// true / false; null si falta 06-admin.sql en Supabase
export async function adminCheck() {
  const c = await sb()
  const { data, error } = await c.rpc('is_admin')
  if (error) {
    if (noFn(error)) return null
    throw new Error(es(error))
  }
  return !!data
}
export async function adminUsers() {
  const c = await sb()
  const { data, error } = await c.rpc('admin_users')
  if (error) throw new Error(es(error))
  return data || []
}
export async function adminUserData(uid) {
  const c = await sb()
  const { data, error } = await c.rpc('admin_user_data', { uid })
  if (error) throw new Error(es(error))
  return Array.isArray(data) ? data[0] || null : data
}
export async function sessionUser() {
  const c = await sb()
  const { data } = await c.auth.getSession()
  return data.session?.user || null
}
export async function authSignOut() {
  const c = await sb()
  await c.auth.signOut().catch(() => {})
}
