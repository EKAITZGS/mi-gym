// Conexión con Polar (a través del intermediario en Cloudflare).
// El token de Polar se guarda solo en este móvil, aparte de las copias de seguridad.
import { todayStr, addDays } from './store'

export const POLAR_WORKER = 'https://mi-gym-polar.ekaitzmartinezm.workers.dev'
const KEY = 'migym.polar'

export const getPolar = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}
export const setPolar = (v) => {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v))
    else localStorage.removeItem(KEY)
  } catch {}
}

// Al volver de Polar, el token llega en el # de la dirección
export function readPolarReturn() {
  const h = new URLSearchParams(location.hash.slice(1))
  if (!h.has('polar') && !h.has('polar_error')) return null
  history.replaceState(null, '', location.pathname + location.search)
  if (h.get('polar')) {
    setPolar({ token: h.get('polar'), user: h.get('polar_user'), since: new Date().toISOString() })
    return { ok: true }
  }
  return { ok: false, error: h.get('polar_error') }
}

export const connectPolar = () => {
  location.href = POLAR_WORKER + '/auth'
}

// "PT1H5M30S" -> minutos
export const isoMinutes = (d) => {
  const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/)
  if (!m) return 0
  return Math.round((+m[1] || 0) * 60 + (+m[2] || 0) + (+m[3] || 0) / 60)
}

const SPORTS = {
  STRENGTH_TRAINING: 'Fuerza',
  RUNNING: 'Correr',
  CYCLING: 'Bici',
  WALKING: 'Caminar',
  OTHER_INDOOR: 'Interior',
  OTHER_OUTDOOR: 'Exterior',
  CIRCUIT_TRAINING: 'Circuito',
  CORE: 'Core',
  ROWING: 'Remo',
  INDOOR_ROWING: 'Remo indoor',
  INDOOR_CYCLING: 'Bici indoor',
  TREADMILL_RUNNING: 'Cinta',
  SWIMMING: 'Natación',
}
export const sportName = (e) => SPORTS[e.detailed_sport_info] || SPORTS[e.sport] || (e.sport || 'Entreno').toLowerCase()

async function get(path, token) {
  const r = await fetch(POLAR_WORKER + path, { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 401 || r.status === 403) throw new Error('AUTH')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// Trae entrenos (30 días) y actividad diaria (última semana) y los guarda en data.polar
export async function syncPolar(setData) {
  const p = getPolar()
  if (!p?.token) throw new Error('NO_TOKEN')
  const [ex, act] = await Promise.all([
    get('/exercises', p.token),
    get(`/activities?from=${addDays(todayStr(), -6)}&to=${todayStr()}`, p.token).catch(() => []),
  ])
  const exercises = {}
  for (const e of Array.isArray(ex) ? ex : []) {
    exercises[e.id] = {
      id: e.id,
      date: String(e.start_time || '').slice(0, 10),
      time: String(e.start_time || '').slice(11, 16),
      min: isoMinutes(e.duration),
      kcal: Math.round(e.calories || 0),
      hrAvg: e.heart_rate?.average || null,
      hrMax: e.heart_rate?.maximum || null,
      sport: sportName(e),
      load: e.training_load ? Math.round(e.training_load) : null,
    }
  }
  const days = {}
  for (const a of Array.isArray(act) ? act : []) {
    const d = String(a.date || a.start_time || '').slice(0, 10)
    if (d) days[d] = { kcal: Math.round(a.calories || 0), active: Math.round(a.active_calories || 0), steps: a.steps || 0 }
  }
  setData((d) => ({
    ...d,
    polar: {
      lastSync: new Date().toISOString(),
      exercises: { ...(d.polar?.exercises || {}), ...exercises },
      days: { ...(d.polar?.days || {}), ...days },
    },
  }))
  return { exercises: Object.keys(exercises).length, days: Object.keys(days).length, list: Object.values(exercises) }
}

export const polarExercisesOn = (data, date) =>
  Object.values(data.polar?.exercises || {})
    .filter((e) => e.date === date)
    .sort((a, b) => a.time.localeCompare(b.time))
