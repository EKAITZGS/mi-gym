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

export async function signUp(email, password, name) {
  const c = await sb()
  const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: appUrl() } })
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
export async function connect(user, local, setData) {
  const row = await pull(user.id)
  const base = { uid: user.id, email: user.email, dirty: false }
  if (!row) {
    // primera vez: se sube lo que tienes en el móvil
    const at = await push(user.id, local)
    setMeta({ ...base, synced: at })
    return { action: 'uploaded' }
  }
  if (same(row.data, local)) {
    setMeta({ ...base, synced: row.updated_at })
    return { action: 'same' }
  }
  if (!hasData(local)) {
    keepLocal()
    setMeta({ ...base, synced: row.updated_at })
    setData({ ...DEFAULT, ...row.data })
    return { action: 'downloaded' }
  }
  // hay datos en los dos sitios y son distintos: elige el usuario
  setMeta({ ...base, synced: null, pending: true })
  return { action: 'conflict', cloud: row }
}

// Resolver el conflicto: 'cloud' usa lo de la cuenta, 'local' sube lo del móvil
export async function resolve(choice, cloud, local, setData) {
  const m = cloudMeta()
  if (!m) return
  if (choice === 'cloud') {
    keepLocal()
    setMeta({ ...m, pending: false, dirty: false, synced: cloud.updated_at })
    setData({ ...DEFAULT, ...cloud.data })
  } else {
    const at = await push(m.uid, local)
    setMeta({ ...m, pending: false, dirty: false, synced: at })
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
