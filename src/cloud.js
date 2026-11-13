// Cuentas y copia en la nube con Supabase.
// El móvil sigue siendo lo principal (la app funciona igual sin cuenta y sin conexión); la nube guarda una copia
// de todo `migym.v1` por usuario y la mantiene al día. Las fotos de progreso se quedan solo en el móvil.
import { useEffect, useRef, useState } from 'react'
import { DEFAULT } from './store'

// Proyecto de Supabase. La clave "anon"/"publishable" es pública por diseño: lo que protege los datos son las
// reglas RLS de supabase/schema.sql (cada usuario solo ve lo suyo).
export const SB_URL = import.meta.env.VITE_SB_URL || 'https://fsantamxmriodlriantf.supabase.co'
export const SB_KEY = import.meta.env.VITE_SB_KEY || 'sb_publishable_700NfTmDI4rbA3stzszyJg_ToevFG-m'
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

async function push(uid, data) {
  const c = await sb()
  const updated_at = new Date().toISOString()
  const { error } = await c.from('user_data').upsert({ user_id: uid, data, updated_at, device: navigator.userAgent.slice(0, 120) })
  if (error) throw new Error(es(error))
  return updated_at
}

// cuenta nueva: todo vacío (sin el plan de ejemplo); la bienvenida le ayuda a crear el suyo
export const CLEAN = { ...DEFAULT, plan: [] }
const hasData = (d) => !!(d?.sessions?.length || Object.keys(d?.food || {}).length || d?.body?.waist?.length || d?.body?.weight?.length)
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`
export const summary = (d) =>
  [pl(d?.sessions?.length || 0, 'entreno', 'entrenos'), pl(Object.keys(d?.food || {}).length, 'día de dieta', 'días de dieta'), pl(d?.body?.weight?.length || 0, 'pesaje', 'pesajes')].join(', ')
// Postgres (jsonb) cambia el orden de las claves: se compara con las claves ordenadas
const canon = (v) =>
  Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',')}}` : JSON.stringify(v ?? null)
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
    setMeta({ ...base, synced: row.updated_at })
    setData({ ...DEFAULT, ...row.data })
    return { action: 'downloaded' }
  }
  if (other || !hasData(local)) {
    setMeta({ ...base, synced: row.updated_at })
    setData({ ...DEFAULT, ...row.data })
    return { action: 'downloaded' }
  }
  if (same(row.data, local)) {
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
    setMeta({ ...m, pending: false, dirty: false, synced: cloud.updated_at })
    setData({ ...DEFAULT, ...cloud.data })
  } else {
    const at = await push(m.uid, local)
    setMeta({ ...m, pending: false, ask: false, dirty: false, synced: at })
  }
}

// Sincronía automática: sube los cambios (a los 3 s) y, al abrir o volver a la app, baja lo que se haya
// cambiado en otro móvil. Devuelve el estado para enseñarlo en Ajustes.
export function useCloudSync(data, setData) {
  const [state, setState] = useState(() => ({ meta: cloudMeta(), busy: false, error: '', recovery: false }))
  const applying = useRef(false)
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
    if (await hasSession()) return false
    setState((s) => ({ ...s, busy: false, error: 'Tu sesión ha caducado: vuelve a entrar en tu cuenta.' }))
    setMeta(null)
    return true
  }

  const upload = async () => {
    const m = cloudMeta()
    if (!m?.uid || m.pending) return
    setState((s) => ({ ...s, busy: true }))
    try {
      if (await expired()) return
      const at = await push(m.uid, dataRef.current)
      patchMeta({ synced: at, dirty: false })
      setState((s) => ({ ...s, busy: false, error: '' }))
    } catch (e) {
      setState((s) => ({ ...s, busy: false, error: e.message }))
    }
  }

  const download = async () => {
    const m = cloudMeta()
    if (!m?.uid || m.pending) return
    try {
      if (await expired()) return
      fetchProfile(m.uid)
        .then((p) => p && (p.role !== m.role || p.name !== m.name) && patchMeta({ role: p.role, name: p.name }))
        .catch(() => {})
      const row = await pull(m.uid)
      if (!row) return upload()
      if (m.synced && row.updated_at <= m.synced) return m.dirty ? upload() : null
      if (m.dirty) {
        // cambios en los dos sitios: gana lo del móvil, pero lo de la nube se guarda aparte
        try {
          localStorage.setItem('migym.v1.nube-anterior', JSON.stringify(row.data))
        } catch {}
        return upload()
      }
      applying.current = true
      patchMeta({ synced: row.updated_at, dirty: false })
      setData({ ...DEFAULT, ...row.data })
    } catch (e) {
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
    if (applying.current) {
      applying.current = false
      return
    }
    const m = cloudMeta()
    if (!m?.uid || m.pending) return
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
export const studentData = (uid) => q((c) => c.from('user_data').select('data, updated_at').eq('user_id', uid).maybeSingle())

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

// Lo pendiente para avisar: mensajes sin leer, entrenos por responder (alumno) y solicitudes (entrenador)
export async function inbox() {
  const uid = uidNow()
  if (!uid) return null
  const c = await sb()
  const [msgs, wks, links] = await Promise.all([
    c.from('coach_messages').select('id, link_id').neq('sender_id', uid).is('read_at', null),
    c.from('coach_workouts').select('id, link_id, day').eq('status', 'pending'),
    c.from('coach_links').select('id, user_id, trainer_id, status'),
  ])
  const L = links.data || []
  const mineAsUser = new Set(L.filter((l) => l.user_id === uid).map((l) => l.id))
  return {
    messages: (msgs.data || []).length,
    msgByLink: (msgs.data || []).reduce((a, m) => ((a[m.link_id] = (a[m.link_id] || 0) + 1), a), {}),
    workouts: (wks.data || []).filter((w) => mineAsUser.has(w.link_id)).length,
    // nombres de los días de los que el entrenador propone cambios
    changes: (wks.data || []).filter((w) => mineAsUser.has(w.link_id) && w.day?.baseId).map((w) => w.day.baseName || 'tu día'),
    requests: L.filter((l) => l.trainer_id === uid && l.status === 'pending').length,
  }
}
