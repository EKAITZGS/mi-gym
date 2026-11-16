// Avisos en el móvil (Web Push). El intermediario de Cloudflare guarda la lista de avisos programados
// y los envía a su hora; la app la recalcula cada vez que cambian tus datos.
import { POLAR_WORKER } from './polar'
import { todayStr, addDays } from './store'
import { polarExercisesOn } from './polar'
import { proteinPlan } from './Extras'
import { dayMinutes } from './plans'

const LS = 'migym.push'
export const DEFAULT_PREFS = { train: true, trainAt: '09:00', protein: true, proteinAt: '21:00', watch: true, waist: true, walk: true, walkAt: '18:00' }

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
export const pushState = () => {
  try {
    return JSON.parse(localStorage.getItem(LS) || 'null')
  } catch {
    return null
  }
}
const setState = (v) => {
  try {
    localStorage.setItem(LS, JSON.stringify(v))
  } catch {}
}

const b64ToBytes = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function post(path, body) {
  const r = await fetch(POLAR_WORKER + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.json()
}

const at = (date, hhmm) => {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number)
  const d = new Date(date + 'T00:00:00')
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

// Lista de avisos para los próximos 7 días según tu plan y lo que llevas hoy
export function pushPlan(data) {
  const pr = { ...DEFAULT_PREFS, ...(data.pushPrefs || {}) }
  const now = Date.now()
  const today = todayStr()
  const items = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i)
    const wd = new Date(date + 'T12:00:00').getDay()
    if (pr.train) {
      const day = data.plan.find((d) => d.weekday === wd)
      const done = data.sessions.some((s) => s.date === date)
      if (day && !done) {
        const n = day.items.length
        const sets = day.items.reduce((t, x) => t + (Number(x.sets) || 0), 0)
        items.push({
          k: 'train-' + date,
          at: at(date, pr.trainAt),
          title: `Entreno de hoy · ${day.name.trim()}`,
          body: n
            ? `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'} · ${sets} series · ~${dayMinutes(day.items)} min. Recuerda iniciar la sesión en el reloj.`
            : 'El día aún no tiene ejercicios: añádelos al empezar.',
        })
      }
    }
    if (pr.protein) {
      if (i === 0) {
        const pp = proteinPlan(data)
        if (pp) {
          const o = pp.pick[0]
          items.push({
            k: 'prot-' + date,
            at: at(date, pr.proteinAt),
            title: `Proteína · faltan ${pp.left} g`,
            body: o ? `Una opción para cerrar el día: ${o.label} de ${o.f.name.replace(/ \(.*\)/, '').toLowerCase()} (+${o.p} g).` : 'Revisa en Dieta qué puedes añadir para llegar a tu objetivo.',
          })
        }
      } else {
        items.push({ k: 'prot-' + date, at: at(date, pr.proteinAt), title: 'Registro de comidas', body: 'Apunta lo que has comido hoy para ver cuánta proteína te falta.' })
      }
    }
    // días de descanso: a andar, salvo que ya hayas entrenado, el reloj tenga un entreno o ya llegues a tus pasos
    // (los pasos solo se saben de hoy y con la última sincronización; al abrir la app se recalcula)
    if (pr.walk && !data.plan.some((d) => d.weekday === wd)) {
      const moved = data.sessions.some((s) => s.date === date) || polarExercisesOn(data, date).length > 0
      const steps = data.polar?.days?.[date]?.steps || 0
      const goal = data.goals?.steps || 7000
      if (!moved && steps < goal)
        items.push({
          k: 'walk-' + date,
          at: at(date, pr.walkAt),
          title: 'Día de descanso · Actividad ligera',
          body: `30–45 min andando a buen ritmo ayudan a recuperar y a mantener el gasto diario.${i === 0 && steps ? ` Llevas ${steps.toLocaleString('es-ES')} de ${goal.toLocaleString('es-ES')} pasos.` : ''}`,
        })
    }
    if (pr.waist && wd === 0) {
      const w = data.body?.waist || []
      const last = w[w.length - 1]?.date
      if (!last || addDays(last, 6) <= date) items.push({ k: 'waist-' + date, at: at(date, '10:00'), title: 'Control semanal · Cintura', body: 'Mídela en ayunas, a la altura del ombligo. Si quieres, registra también el peso.' })
    }
  }
  if (pr.watch && data.polar && data.sessions.some((s) => s.date === today) && !polarExercisesOn(data, today).length)
    items.push({ k: 'watch-' + today, at: at(today, '21:30'), title: 'Sincroniza tu reloj Polar', body: 'Abre Polar Flow para que MI-GYM importe el entreno de hoy.' })
  return items.filter((it) => it.at > now).sort((a, b) => a.at - b.at)
}

async function currentSub() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('NO_SUPPORT')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('DENIED')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { key } = await fetch(POLAR_WORKER + '/push/key').then((r) => r.json())
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) })
  }
  setState({ on: true, last: '' })
  return sub
}

export async function disablePush() {
  const sub = await currentSub().catch(() => null)
  if (sub) {
    await post('/push/off', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  setState({ on: false })
}

// Prueba de verdad: si Apple dice que la suscripción ya no vale (404/410), se crea otra y se reintenta
export async function testPush(data) {
  let sub = await currentSub()
  if (!sub) sub = await enablePush()
  let r = await post('/push/test', { sub: sub.toJSON() })
  if (!r.ok && (r.status === 404 || r.status === 410)) {
    await sub.unsubscribe().catch(() => {})
    await enablePush()
    if (data) await syncPush(data, true)
    sub = await currentSub()
    r = await post('/push/test', { sub: sub.toJSON() })
  }
  if (!r.ok) throw new Error('PUSH_' + (r.status || 'ERR'))
  return r
}

// Estado real en el móvil: permiso y suscripción (la app puede creer que están activos y no estarlo)
export async function pushHealth() {
  if (!pushSupported()) return { ok: false, why: 'support' }
  if (Notification.permission !== 'granted') return { ok: false, why: 'perm' }
  const sub = await currentSub().catch(() => null)
  return sub ? { ok: true } : { ok: false, why: 'sub' }
}

// Sube la lista de avisos solo si ha cambiado (para no gastar escrituras)
export async function syncPush(data, force = false) {
  const st = pushState()
  if (!st?.on || !pushSupported()) return
  let sub = await currentSub().catch(() => null)
  // la suscripción puede desaparecer (reinstalar la app, iOS): si el permiso sigue dado, se crea otra sola
  if (!sub && Notification.permission === 'granted') {
    try {
      const { key } = await fetch(POLAR_WORKER + '/push/key').then((r) => r.json())
      const reg = await navigator.serviceWorker.ready
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) })
    } catch {}
  }
  if (!sub) return
  const items = pushPlan(data)
  const sig = JSON.stringify(items) + sub.endpoint
  if (!force && st.last === sig) return
  await post('/push/sync', { sub: sub.toJSON(), items })
  setState({ ...st, last: sig })
}
