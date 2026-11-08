// Rangos por músculo (tipo videojuego) a partir de tu fuerza real, no de fotos.
// Para cada ejercicio hay una referencia de nivel "Oro" (intermedio sólido) (1RM estimado / peso corporal; en mancuernas, por mancuerna).
// En los de peso corporal se usan repeticiones máximas en una serie.
import { EX_BY_ID, GROUPS } from './data/exercises'

// Grupos del maniquí (los de la biblioteca + antebrazo, que solo se trabaja como secundario)
export const RANK_GROUPS = [...GROUPS, 'Antebrazo']
// Nombre del músculo en los datos del ejercicio → grupo
const TO_GROUP = {
  Pecho: 'Pecho', Dorsales: 'Espalda', 'Espalda media': 'Espalda', Lumbar: 'Espalda', Trapecio: 'Espalda', Hombros: 'Hombro',
  'Bíceps': 'Bíceps', 'Tríceps': 'Tríceps', 'Cuádriceps': 'Pierna', Femorales: 'Pierna', 'Glúteos': 'Pierna', Gemelos: 'Pierna',
  Abdominales: 'Core', Antebrazo: 'Antebrazo',
}
// Secundarios que faltan en los datos (agarre = antebrazo)
const EXTRA_SEC = {
  Hammer_Curls: ['Antebrazo'], Bent_Over_Barbell_Row: ['Antebrazo'], 'One-Arm_Dumbbell_Row': ['Antebrazo'], Seated_Cable_Rows: ['Antebrazo'],
  Pullups: ['Antebrazo'], Barbell_Shrug: ['Antebrazo'], Dumbbell_Shrug: ['Antebrazo'], Romanian_Deadlift: ['Antebrazo', 'Espalda'], Barbell_Squat: ['Core'],
}
export const SEC_FACTOR = 0.7
// Grupos que trabaja un ejercicio: principal (1) y secundarios (SEC_FACTOR para rangos, 0,5 para contar series)
export function groupsOf(id) {
  const ex = EX_BY_ID[id]
  if (!ex) return []
  const main = ex.group
  const sec = new Set([...(ex.sec || []).map((m) => TO_GROUP[m]), ...(EXTRA_SEC[id] || [])].filter((g) => g && g !== main))
  return [{ g: main, main: true }, ...[...sec].map((g) => ({ g, main: false }))]
}
import { e1rm, num, todayStr, addDays } from './store'

export const RANKS = [
  { id: 'hierro', name: 'Hierro', min: 0, color: '#8a8f99' },
  { id: 'bronce', name: 'Bronce', min: 0.4, color: '#cd7f32' },
  { id: 'plata', name: 'Plata', min: 0.6, color: '#d7dee8' },
  { id: 'oro', name: 'Oro', min: 0.8, color: '#f5c542' },
  { id: 'platino', name: 'Platino', min: 1.0, color: '#4fe3cf' },
  { id: 'diamante', name: 'Diamante', min: 1.25, color: '#7fb2ff' },
]

const REF = {
  'Barbell_Bench_Press_-_Medium_Grip': 1.15, 'Barbell_Incline_Bench_Press_-_Medium_Grip': 0.98, Dumbbell_Bench_Press: 0.43, Incline_Dumbbell_Press: 0.37,
  Leverage_Chest_Press: 1.03, Leverage_Incline_Chest_Press: 0.86, Dumbbell_Flyes: 0.17, Incline_Dumbbell_Flyes: 0.15, Butterfly: 0.69, Cable_Crossover: 0.29,
  'Wide-Grip_Lat_Pulldown': 0.92, 'Close-Grip_Front_Lat_Pulldown': 0.92, Seated_Cable_Rows: 0.92, Bent_Over_Barbell_Row: 0.98, 'One-Arm_Dumbbell_Row': 0.46,
  Leverage_High_Row: 0.98, 'Straight-Arm_Pulldown': 0.4, Barbell_Deadlift: 1.72,
  Barbell_Shoulder_Press: 0.71, Dumbbell_Shoulder_Press: 0.29, Machine_Shoulder_Military_Press: 0.63, Side_Lateral_Raise: 0.18, Front_Dumbbell_Raise: 0.18,
  Reverse_Machine_Flyes: 0.46, Reverse_Flyes: 0.11, Face_Pull: 0.4, Dumbbell_Shrug: 0.52, Barbell_Shrug: 1.15,
  Barbell_Curl: 0.57, 'EZ-Bar_Curl': 0.55, Dumbbell_Bicep_Curl: 0.23, Hammer_Curls: 0.25, Preacher_Curl: 0.46, Concentration_Curls: 0.2,
  Standing_Biceps_Cable_Curl: 0.52, Alternate_Incline_Dumbbell_Curl: 0.2,
  Triceps_Pushdown: 0.57, 'Triceps_Pushdown_-_Rope_Attachment': 0.48, Cable_Rope_Overhead_Triceps_Extension: 0.46, Lying_Triceps_Press: 0.52,
  Standing_Dumbbell_Triceps_Extension: 0.34, Machine_Triceps_Extension: 0.57, 'Close-Grip_Barbell_Bench_Press': 0.98,
  Barbell_Squat: 1.44, Leg_Press: 2.88, Hack_Squat: 1.72, Goblet_Squat: 0.52, Dumbbell_Lunges: 0.34, Romanian_Deadlift: 1.26, Leg_Extensions: 0.86,
  Lying_Leg_Curls: 0.63, Seated_Leg_Curl: 0.69, Barbell_Hip_Thrust: 1.72, Standing_Calf_Raises: 1.49, Seated_Calf_Raise: 1.03, Cable_Crunch: 0.69,
}
// Peso corporal: repeticiones de referencia (nivel Oro) en una serie
const REPS = { Pushups: 30, 'Dips_-_Chest_Version': 15, 'Dips_-_Triceps_Version': 15, Bench_Dips: 25, Pullups: 10, 'Chin-Up': 12, Hyperextensions_Back_Extensions: 20, Crunches: 30, Hanging_Leg_Raise: 12, Plank: 60 }
// Si no conocemos el ejercicio (p. ej. uno propio): referencia genérica según material
const BY_EQUIP = { Barra: 0.8, 'Barra Z': 0.58, Mancuernas: 0.29, Máquina: 0.8, Polea: 0.58, Kettlebell: 0.4 }

export const rankOf = (f) => (f == null ? null : [...RANKS].reverse().find((r) => f >= r.min))
export const nextRank = (f) => RANKS.find((r) => r.min > (f ?? -1)) || null

// Peso corporal para los cálculos: media de los últimos 3 pesajes (no se enseña); si no hay, 80 kg
export function bodyWeight(data) {
  const w = data.body?.weight || []
  if (!w.length) return { kg: 80, real: false }
  const last = w.slice(-3)
  return { kg: last.reduce((a, x) => a + num(x.kg), 0) / last.length, real: true }
}

export function muscleRanks(data) {
  const bw = bodyWeight(data).kg
  const since = addDays(todayStr(), -90)
  const best = {} // por ejercicio
  for (const s of data.sessions || []) {
    if (s.date < since) continue
    for (const [id, sets] of Object.entries(s.entries || {})) {
      const ex = EX_BY_ID[id]
      if (!ex) continue
      for (const st of sets) {
        const w = num(st.w)
        const r = num(st.r)
        if (r <= 0) continue
        let f = null
        let val = null
        if (REPS[id]) {
          f = (r / REPS[id]) * (1 + w / bw)
          val = { reps: r, w }
        } else {
          const ref = REF[id] ?? BY_EQUIP[ex.equip]
          if (!ref || w <= 0) continue
          const e = e1rm(w, r)
          f = e / bw / ref
          val = { e, ref }
        }
        for (const { g, main } of groupsOf(id)) {
          const k = g + '|' + id
          const fg = main ? f : f * SEC_FACTOR
          if (!best[k] || fg > best[k].f) best[k] = { id, g, f: fg, main, factor: main ? 1 : SEC_FACTOR, ...val, date: s.date }
        }
      }
    }
  }
  const out = {}
  for (const g of RANK_GROUPS) {
    const list = Object.values(best)
      .filter((b) => b.g === g)
      .sort((a, b) => b.f - a.f)
    if (!list.length) {
      out[g] = { group: g, f: null, rank: null, top: null }
      continue
    }
    const top = list[0]
    const f = top.f
    const nr = nextRank(f)
    // cuánto te falta para el siguiente rango en tu mejor ejercicio de ese músculo
    let need = null
    if (nr && top.ref) need = { rank: nr, e1rm: Math.ceil(((nr.min / top.factor) * top.ref * bw) * 2) / 2 }
    else if (nr && REPS[top.id]) need = { rank: nr, reps: Math.ceil(((nr.min / top.factor) * REPS[top.id]) / (1 + (top.w || 0) / bw)) }
    out[g] = { group: g, f, rank: rankOf(f), top, need, progress: nr ? Math.max(0, Math.min(1, (f - rankOf(f).min) / (nr.min - rankOf(f).min))) : 1 }
  }
  const have = Object.values(out).filter((x) => x.f != null)
  const overall = have.length ? rankOf(have.reduce((a, x) => a + Math.min(x.f, 1.6), 0) / have.length) : null
  return { groups: out, overall, bw: bodyWeight(data) }
}

// Simetría con los ejercicios unilaterales (reps izquierda / derecha) de los últimos 60 días
export function symmetry(data) {
  const since = addDays(todayStr(), -60)
  const acc = {}
  for (const s of data.sessions || []) {
    if (s.date < since) continue
    for (const [id, sets] of Object.entries(s.entries || {})) {
      const g = EX_BY_ID[id]?.group
      if (!g) continue
      for (const st of sets) {
        const l = num(st.rl)
        const r = num(st.rr)
        if (!l || !r) continue
        const w = Math.max(1, num(st.w))
        acc[g] = acc[g] || { l: 0, r: 0, n: 0 }
        acc[g].l += l * w
        acc[g].r += r * w
        acc[g].n++
      }
    }
  }
  return Object.entries(acc).map(([g, v]) => {
    const diff = Math.abs(v.l - v.r) / Math.max(v.l, v.r)
    const weak = v.l < v.r ? 'izquierdo' : 'derecho'
    return { group: g, pct: Math.round(diff * 100), weak, sets: v.n, level: diff < 0.05 ? 'ok' : diff < 0.1 ? 'low' : 'high' }
  })
}
