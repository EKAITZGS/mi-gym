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
export const isoSeconds = (d) => {
  const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/)
  if (!m) return 0
  return Math.round((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0))
}
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

// Curva de pulso (muestras tipo 0, en ppm) reducida a un punto cada 15 s, y tiempo en cada zona
const STEP = 15
function hrDetail(e) {
  const out = {}
  const pick = (o, ...ks) => ks.map((k) => o?.[k]).find((v) => v != null)
  const nums = (d) => (Array.isArray(d) ? d : String(d || '').split(',')).map(Number)
  const samples = Array.isArray(e.samples) ? e.samples : []
  const typeOf = (x) => String(pick(x, 'sample-type', 'sample_type', 'sampleType', 'type') ?? '').toUpperCase()
  // muestra de pulso: tipo 0 / HEART_RATE; si Polar no dice el tipo, la que tenga valores típicos de pulso
  let hs = samples.find((x) => ['0', 'HEART_RATE', 'HR'].includes(typeOf(x)) || typeOf(x).includes('HEART'))
  if (!hs) {
    hs = samples.find((x) => {
      const v = nums(x.data).filter((n) => n > 0)
      if (v.length < 10) return false
      const sorted = [...v].sort((a, b) => a - b)
      const med = sorted[Math.floor(sorted.length / 2)]
      const rising = v.every((n, i) => !i || n >= v[i - 1])
      return med >= 55 && med <= 200 && !rising
    })
  }
  if (hs?.data) {
    const rate = Number(pick(hs, 'recording-rate', 'recording_rate', 'recordingRate')) || 1
    const vals = nums(hs.data)
    const per = Math.max(1, Math.round(STEP / rate))
    const v = []
    for (let i = 0; i < vals.length; i += per) {
      const chunk = vals.slice(i, i + per).filter((n) => n > 30 && n < 230)
      v.push(chunk.length ? Math.round(chunk.reduce((a, b) => a + b, 0) / chunk.length) : 0)
    }
    if (v.some((n) => n > 0)) out.hr = { step: per * rate, v }
  }
  const z = pick(e, 'heart_rate_zones', 'heart-rate-zones', 'heartRateZones')
  if (Array.isArray(z) && z.length)
    out.zones = z
      .map((x, k) => ({
        i: Number(pick(x, 'index', 'zone_index')) || k + 1,
        lo: Number(pick(x, 'lower-limit', 'lower_limit', 'lowerLimit')) || 0,
        hi: Number(pick(x, 'upper-limit', 'upper_limit', 'upperLimit')) || 0,
        s: isoSeconds(pick(x, 'in-zone', 'in_zone', 'inZone')),
      }))
      // Polar a veces numera desde 0: se ordenan por límite y se numeran 1–5
      .sort((a, b) => a.lo - b.lo || a.i - b.i)
      .map((z, k) => ({ ...z, i: k + 1 }))
  return out
}

function loadPrevEx() {
  try {
    return JSON.parse(localStorage.getItem('migym.v1') || '{}').polar?.exercises || {}
  } catch {
    return {}
  }
}

async function get(path, token) {
  const r = await fetch(POLAR_WORKER + path, { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 401 || r.status === 403) throw new Error('AUTH')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// Sueño (Polar Sleep Plus / Sleep Plus Stages): duraciones en segundos -> minutos; sin hipnograma ni pulso para no llenar el móvil
const mins = (v) => (v == null || isNaN(Number(v)) ? null : Math.round(Number(v) / 60))
export function parseNights(json) {
  const out = {}
  const list = Array.isArray(json) ? json : json?.nights || []
  for (const n of list) {
    const date = String(n.date || '').slice(0, 10)
    if (!date) continue
    const st = String(n.sleep_start_time || ''), en = String(n.sleep_end_time || '')
    const light = mins(n.light_sleep), deep = mins(n.deep_sleep), rem = mins(n.rem_sleep), unrec = mins(n.unrecognized_sleep_stage)
    const staged = (light || 0) + (deep || 0) + (rem || 0) + (unrec || 0)
    const span = st && en ? Math.round((new Date(en) - new Date(st)) / 60000) : 0
    const interr = mins(n.total_interruption_duration) || 0
    const total = staged || Math.max(0, span - interr)
    if (!total) continue
    out[date] = {
      start: st.slice(11, 16), end: en.slice(11, 16), total, interr,
      ...(staged ? { light, deep, rem } : {}),
      ...(n.sleep_score != null ? { score: Math.round(n.sleep_score) } : {}),
      ...(n.continuity != null ? { cont: Number(n.continuity) } : {}),
      ...(n.sleep_rating != null ? { rating: Number(n.sleep_rating) } : {}),
      ...(n.sleep_cycles != null ? { cycles: Number(n.sleep_cycles) } : {}),
      ...(n.sleep_goal ? { goal: mins(n.sleep_goal) } : {}),
    }
  }
  return out
}
export function parseRecharge(json) {
  const out = {}
  for (const r of Array.isArray(json) ? json : json?.recharges || []) {
    const date = String(r.date || '').slice(0, 10)
    if (!date) continue
    out[date] = {
      hrv: r.heart_rate_variability_avg ?? null, hr: r.heart_rate_avg ?? null,
      status: r.nightly_recharge_status ?? null, ans: r.ans_charge ?? null, breath: r.breathing_rate_avg ?? null,
    }
  }
  return out
}
// se guardan como mucho 120 noches
const lastN = (obj, n = 120) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-n))

// Trae entrenos (30 días), actividad diaria (última semana) y sueño (28 noches) y los guarda en data.polar
export async function syncPolar(setData) {
  const p = getPolar()
  if (!p?.token) throw new Error('NO_TOKEN')
  let actErr = null
  const [ex, act, slp, rch] = await Promise.all([
    get('/exercises?samples=true&zones=true', p.token),
    // si falla la actividad diaria no se pierden los entrenos, pero el fallo se guarda para enseñarlo en Ajustes
    get(`/activities?from=${addDays(todayStr(), -6)}&to=${todayStr()}`, p.token).catch((e) => ((actErr = e.message), [])),
    // el sueño y la recarga nocturna son opcionales (no todos los relojes los tienen)
    get('/sleep', p.token).catch(() => null),
    get('/recharge', p.token).catch(() => null),
  ])
  const sleep = slp ? parseNights(slp) : {}
  const recharge = rch ? parseRecharge(rch) : {}
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
      ...hrDetail(e),
    }
  }
  // Si la lista no trae la curva de pulso, se pide el detalle de cada entreno (solo los que aún no la tienes)
  const prev = loadPrevEx()
  for (const e of Object.values(exercises).slice(-10)) {
    if ((e.hr && e.zones?.some((z) => z.s)) || (prev[e.id]?.hr && prev[e.id]?.zones?.some((z) => z.s))) continue
    try {
      const det = await get(`/exercise?id=${encodeURIComponent(e.id)}`, p.token)
      Object.assign(e, hrDetail(Array.isArray(det) ? det[0] || {} : det))
    } catch (err) {
      if (err.message === 'AUTH') throw err
    }
  }
  const days = {}
  // Polar puede devolver la lista suelta o dentro de un objeto, y los campos con _ o con -
  for (const a of Array.isArray(act) ? act : act?.activities || act?.['activity-log'] || []) {
    const d = String(a.date || a.start_time || a['start-time'] || '').slice(0, 10)
    const n = (...ks) => Math.round(Number(ks.map((k) => a[k]).find((v) => v != null)) || 0)
    if (d) days[d] = { kcal: n('calories'), active: n('active_calories', 'active-calories'), steps: n('steps', 'active-steps', 'active_steps') }
  }
  setData((d) => ({
    ...d,
    polar: {
      lastSync: new Date().toISOString(),
      ...(actErr ? { actErr } : {}),
      exercises: Object.fromEntries(
        Object.entries({ ...(d.polar?.exercises || {}), ...exercises }).map(([k, e]) => {
          const old = d.polar?.exercises?.[k]
          return [k, old?.hr && !e.hr ? { ...e, hr: old.hr, zones: e.zones || old.zones } : e]
        })
      ),
      days: { ...(d.polar?.days || {}), ...days },
      ...(Object.keys(sleep).length || d.polar?.sleep ? { sleep: lastN({ ...(d.polar?.sleep || {}), ...sleep }) } : {}),
      ...(Object.keys(recharge).length || d.polar?.recharge ? { recharge: lastN({ ...(d.polar?.recharge || {}), ...recharge }) } : {}),
    },
  }))
  return { exercises: Object.keys(exercises).length, days: Object.keys(days).length, list: Object.values(exercises) }
}

export const polarExercisesOn = (data, date) =>
  Object.values(data.polar?.exercises || {})
    .filter((e) => e.date === date)
    .sort((a, b) => a.time.localeCompare(b.time))

// Baja en Polar (best effort: si falla, igual se desconecta en el móvil)
export async function disconnectPolar() {
  const p = getPolar()
  if (p?.token && p.user) {
    try {
      await fetch(`${POLAR_WORKER}/polar/off?user=${encodeURIComponent(p.user)}`, { headers: { Authorization: `Bearer ${p.token}` } })
    } catch {}
  }
  setPolar(null)
}
