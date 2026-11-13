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
  [/password should be at least|weak password/i, 'La contraseña necesita al menos 6 caracteres.'],
  [/rate limit|too many|security purposes/i, 'Demasiados intentos. Espera un minuto y prueba otra vez.'],
  [/invalid.*email|unable to validate email/i, 'Ese email no parece válido.'],
  [/failed to fetch|network/i, 'Sin conexión. Prueba cuando tengas internet.'],
]
const es = (e) => {
  const m = String(e?.message || e || '')
  return ERR.find(([r]) => r.test(m))?.[1] || `Algo ha fallado: ${m || 'error desconocido'}`
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
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
export const listTrainers = () => q((c) => c.from('profiles').select('id, name').eq('role', 'trainer').order('name'))
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
