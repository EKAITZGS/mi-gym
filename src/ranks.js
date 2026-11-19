// Rangos por músculo (tipo videojuego) a partir de tu fuerza real, no de fotos.
// Para cada ejercicio hay una referencia de nivel intermedio (1RM estimado / peso corporal; en mancuernas, por mancuerna),
// de tablas tipo Strength Level. En los de peso corporal se usan repeticiones máximas en una serie.
// El rango de un músculo no sale de un solo ejercicio: es la media de tus 3 mejores ejercicios de ese músculo, los de
// aislamiento (abductores, extensiones, elevaciones…) cuentan la mitad donde hay básicos, y para los rangos altos hacen
// falta varios ejercicios y algún básico. Todo a la vez: con 40 kg en una máquina de aislamiento no se llega a Diamante.
import { EX_BY_ID, GROUPS } from './data/exercises'
import { ISOLATION } from './data/mechanic'

// Grupos del maniquí (los de la biblioteca + antebrazo, que solo se trabaja como secundario)
export const RANK_GROUPS = [...new Set([...GROUPS, 'Antebrazo'])]
// Nombre del músculo en los datos del ejercicio → grupo
const TO_GROUP = {
  Pecho: 'Pecho', Dorsales: 'Espalda', 'Espalda media': 'Espalda', Lumbar: 'Espalda', Trapecio: 'Espalda', Hombros: 'Hombro',
  'Bíceps': 'Bíceps', 'Tríceps': 'Tríceps', 'Cuádriceps': 'Pierna', Femorales: 'Pierna', 'Glúteos': 'Pierna', Gemelos: 'Pierna',
  Abdominales: 'Core', Antebrazo: 'Antebrazo', Aductores: 'Pierna', Abductores: 'Pierna',
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
  if (!ex || !GROUPS.includes(ex.group)) return [] // cardio y estiramientos no suman a ningún músculo
  const main = ex.group
  const sec = new Set([...(ex.sec || []).map((m) => TO_GROUP[m]), ...(EXTRA_SEC[id] || [])].filter((g) => g && g !== main))
  return [{ g: main, main: true }, ...[...sec].map((g) => ({ g, main: false }))]
}
import { e1rm, num, todayStr, addDays } from './store'
import { sexOf, sexFactor } from './sex'

// f = fuerza / referencia intermedia: Oro ≈ cerca de intermedio, Platino por encima, Diamante ≈ avanzado
export const RANKS = [
  { id: 'hierro', name: 'Hierro', min: 0, color: '#8a8f99' },
  { id: 'bronce', name: 'Bronce', min: 0.4, color: '#cd7f32' },
  { id: 'plata', name: 'Plata', min: 0.6, color: '#d7dee8' },
  { id: 'oro', name: 'Oro', min: 0.85, color: '#f5c542' },
  { id: 'platino', name: 'Platino', min: 1.1, color: '#4fe3cf' },
  { id: 'diamante', name: 'Diamante', min: 1.4, color: '#7fb2ff' },
]
const MIN = Object.fromEntries(RANKS.map((r) => [r.id, r.min]))
// cuántos ejercicios entran en la nota de un músculo y cuánto pesa cada tipo
const TOP_N = 3
const W_COMPOUND = 1
const W_ISO = 0.5 // aislamiento en un músculo que tiene básicos (pecho, espalda, hombro, pierna)
const W_SEC = 0.35 // cuando el músculo trabaja de secundario
// músculos con ejercicios básicos (multiarticulares); en bíceps, tríceps, core y antebrazo casi todo es aislamiento y cuenta entero
const HAS_COMPOUND = new Set(['Pecho', 'Espalda', 'Hombro', 'Pierna'])
export const isIsolation = (id) => ISOLATION.has(id)

const REF = {
  'Barbell_Bench_Press_-_Medium_Grip': 1.15, 'Barbell_Incline_Bench_Press_-_Medium_Grip': 0.98, Dumbbell_Bench_Press: 0.5, Incline_Dumbbell_Press: 0.43,
  Leverage_Chest_Press: 1.03, Leverage_Incline_Chest_Press: 0.86, Dumbbell_Flyes: 0.22, Incline_Dumbbell_Flyes: 0.2, Butterfly: 0.95, Cable_Crossover: 0.35,
  'Wide-Grip_Lat_Pulldown': 0.92, 'Close-Grip_Front_Lat_Pulldown': 0.92, Seated_Cable_Rows: 0.92, Bent_Over_Barbell_Row: 0.98, 'One-Arm_Dumbbell_Row': 0.46,
  Leverage_High_Row: 0.98, 'Straight-Arm_Pulldown': 0.4, Barbell_Deadlift: 1.72,
  Barbell_Shoulder_Press: 0.71, Dumbbell_Shoulder_Press: 0.36, Machine_Shoulder_Military_Press: 0.63, Side_Lateral_Raise: 0.21, Front_Dumbbell_Raise: 0.22,
  Reverse_Machine_Flyes: 0.46, Reverse_Flyes: 0.11, Face_Pull: 0.4, Dumbbell_Shrug: 0.52, Barbell_Shrug: 1.15,
  Barbell_Curl: 0.57, 'EZ-Bar_Curl': 0.55, Dumbbell_Bicep_Curl: 0.3, Hammer_Curls: 0.32, Preacher_Curl: 0.46, Concentration_Curls: 0.27,
  Standing_Biceps_Cable_Curl: 0.52, Alternate_Incline_Dumbbell_Curl: 0.26,
  Triceps_Pushdown: 0.57, 'Triceps_Pushdown_-_Rope_Attachment': 0.48, Cable_Rope_Overhead_Triceps_Extension: 0.46, Lying_Triceps_Press: 0.52,
  Standing_Dumbbell_Triceps_Extension: 0.34, Machine_Triceps_Extension: 0.57, 'Close-Grip_Barbell_Bench_Press': 0.98,
  Barbell_Squat: 1.44, Leg_Press: 2.88, Hack_Squat: 1.72, Goblet_Squat: 0.52, Dumbbell_Lunges: 0.34, Romanian_Deadlift: 1.26, Leg_Extensions: 1.05,
  Lying_Leg_Curls: 0.8, Seated_Leg_Curl: 0.85, Barbell_Hip_Thrust: 1.72, Standing_Calf_Raises: 1.65, Seated_Calf_Raise: 1.2, Cable_Crunch: 0.69,
}
// Peso corporal: repeticiones de referencia (nivel Oro) en una serie
const REF_NEW = {
  Smith_Machine_Incline_Bench_Press: 1.0, Smith_Machine_Bench_Press: 1.2, Smith_Machine_Decline_Press: 1.25, Machine_Bench_Press: 1.0, Decline_Barbell_Bench_Press: 1.2,
  Decline_Dumbbell_Bench_Press: 0.43, Hammer_Grip_Incline_DB_Bench_Press: 0.37, Cable_Chest_Press: 0.6, Incline_Cable_Flye: 0.3, Flat_Bench_Cable_Flyes: 0.3, Low_Cable_Crossover: 0.28,
  'Bent-Arm_Dumbbell_Pullover': 0.35, Smith_Machine_Bent_Over_Row: 0.95, 'T-Bar_Row_with_Handle': 0.9, 'Lying_T-Bar_Row': 0.9, Leverage_Iso_Row: 0.5,
  'Seated_One-arm_Cable_Pulley_Rows': 0.45, Elevated_Cable_Rows: 0.85, 'Reverse_Grip_Bent-Over_Rows': 0.95, 'V-Bar_Pulldown': 0.9, Underhand_Cable_Pulldowns: 0.9,
  'Bent-Arm_Barbell_Pullover': 0.5, Stiff_Leg_Barbell_Good_Morning: 0.8, Leverage_Shrug: 1.3, Smith_Machine_Behind_the_Back_Shrug: 1.2,
  Smith_Machine_Overhead_Shoulder_Press: 0.7, Leverage_Shoulder_Press: 0.65, Arnold_Dumbbell_Press: 0.27, Seated_Cable_Shoulder_Press: 0.5, Cable_Seated_Lateral_Raise: 0.12,
  Front_Cable_Raise: 0.15, Cable_Rear_Delt_Fly: 0.12, 'Seated_Bent-Over_Rear_Delt_Raise': 0.12, 'Cable_Rope_Rear-Delt_Rows': 0.45, Upright_Barbell_Row: 0.6,
  Standing_Dumbbell_Upright_Row: 0.25, Smith_Machine_Upright_Row: 0.6, External_Rotation_with_Cable: 0.1, Machine_Preacher_Curls: 0.5, Machine_Bicep_Curl: 0.55,
  Cable_Preacher_Curl: 0.45, 'Cable_Hammer_Curls_-_Rope_Attachment': 0.5, High_Cable_Curls: 0.2, Spider_Curl: 0.45, Zottman_Curl: 0.2, Reverse_Cable_Curl: 0.4,
  'EZ-Bar_Skullcrusher': 0.5, Dip_Machine: 0.9, 'Smith_Machine_Close-Grip_Bench_Press': 1.0, Tricep_Dumbbell_Kickback: 0.12, Cable_One_Arm_Tricep_Extension: 0.25,
  Reverse_Grip_Triceps_Pushdown: 0.45, Smith_Machine_Squat: 1.3, Front_Barbell_Squat: 1.1, Dumbbell_Squat: 0.45, Plie_Dumbbell_Squat: 0.6, Split_Squat_with_Dumbbells: 0.33,
  One_Leg_Barbell_Squat: 0.7, 'Smith_Single-Leg_Split_Squat': 0.75, Barbell_Walking_Lunge: 0.7, Dumbbell_Rear_Lunge: 0.33, Dumbbell_Step_Ups: 0.3, Sumo_Deadlift: 1.7,
  'Stiff-Legged_Dumbbell_Deadlift': 0.5, 'Smith_Machine_Stiff-Legged_Deadlift': 1.2, Standing_Leg_Curl: 0.4, Glute_Ham_Raise: 0.3, Thigh_Abductor: 1.4, Thigh_Adductor: 1.4,
  Smith_Machine_Calf_Raise: 1.4, Calf_Press_On_The_Leg_Press_Machine: 2.0, Standing_Dumbbell_Calf_Raise: 0.5, Barbell_Glute_Bridge: 1.6, 'One-Legged_Cable_Kickback': 0.35,
  Pull_Through: 0.8, Reverse_Hyperextension: 0.6, 'One-Arm_Kettlebell_Swings': 0.35, Ab_Crunch_Machine: 0.8, Standing_Cable_Wood_Chop: 0.4, Dumbbell_Side_Bend: 0.4,
  'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench': 0.5, 'Palms-Down_Wrist_Curl_Over_A_Bench': 0.35, Cable_Wrist_Curl: 0.4, Farmers_Walk: 0.5,
}
Object.assign(REF, REF_NEW)
const REPS = { 'Push-Up_Wide': 30, 'Incline_Push-Up': 40, 'Decline_Push-Up': 25, 'Push-Ups_-_Close_Triceps_Position': 25, Inverted_Row: 15, Butt_Lift_Bridge: 30, Single_Leg_Glute_Bridge: 20, Glute_Kickback: 25, Decline_Crunch: 25, Reverse_Crunch: 25, Mountain_Climbers: 40, Side_Bridge: 45, Dead_Bug: 20, Flat_Bench_Lying_Leg_Raise: 20, Russian_Twist: 30, 'Oblique_Crunches_-_On_The_Floor': 30, Ab_Roller: 15, Weighted_Pull_Ups: 10, Pushups: 30, 'Dips_-_Chest_Version': 15, 'Dips_-_Triceps_Version': 15, Bench_Dips: 25, Pullups: 10, 'Chin-Up': 12, Hyperextensions_Back_Extensions: 20, Crunches: 30, Hanging_Leg_Raise: 12, Plank: 60 }
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
  // mujeres: referencias de mujeres (sexFactor); sin indicar, las de hombre como siempre
  const sex = sexOf(data)
  const since = addDays(todayStr(), -90)
  const best = {} // por ejercicio
  for (const s of data.sessions || []) {
    if (s.date < since) continue
    for (const [id, sets] of Object.entries(s.entries || {})) {
      const ex = EX_BY_ID[id]
      if (!ex) continue
      for (const st of sets) {
        if (st.warm) continue
        const w = num(st.w)
        const r = num(st.r)
        if (r <= 0) continue
        let f = null
        let val = null
        if (REPS[id]) {
          const refReps = REPS[id] * sexFactor(id, sex, true)
          f = (r / refReps) * (1 + w / bw)
          val = { reps: r, w0: w, refReps }
        } else {
          const ref = (REF[id] ?? BY_EQUIP[ex.equip]) * sexFactor(id, sex)
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
      .map((b) => ({ ...b, w: !b.main ? W_SEC : isIsolation(b.id) && HAS_COMPOUND.has(g) ? W_ISO : W_COMPOUND }))
      .sort((a, b) => b.f - a.f)
    if (!list.length) {
      out[g] = { group: g, f: null, rank: null, top: null, used: [] }
      continue
    }
    // nota = media (ponderada por tipo) de tus 3 mejores ejercicios de ese músculo
    const used = list.slice(0, TOP_N)
    const sw = used.reduce((a, x) => a + x.w, 0)
    const raw = used.reduce((a, x) => a + x.w * x.f, 0) / sw
    // todo a la vez: con 1 ejercicio como mucho Oro, con 2 como mucho Platino; Diamante pide 3.
    // Donde hay básicos, solo con aislamiento (sin ningún básico como principal) no pasas de Plata.
    const nMain = list.filter((x) => x.main).length
    const compound = !HAS_COMPOUND.has(g) || list.some((x) => x.main && !isIsolation(x.id))
    let cap = Infinity
    let why = null
    if (nMain < 3) {
      cap = (nMain < 2 ? MIN.platino : MIN.diamante) - 0.001
      why = 'count'
    }
    if (!compound && MIN.oro - 0.001 < cap) {
      cap = MIN.oro - 0.001
      why = 'compound'
    }
    const f = Math.min(raw, cap)
    const rank = rankOf(f)
    const nr = nextRank(f)
    // qué te falta: si el tope es por pocos ejercicios o sin básicos, eso; si no, subir el más flojo de los que cuentan
    let need = null
    if (nr) {
      // el siguiente rango está por encima del tope: lo que falta es eso, no más kilos
      if (nr.min > cap && why === 'count') need = { rank: nr, more: (nMain < 2 ? 2 : 3) - nMain }
      else if (nr.min > cap && why === 'compound') need = { rank: nr, compound: true }
      else {
        // de los que cuentan como principal, el que menos tendrías que subir (en %) para llegar; sin ninguno directo, hacer uno
        const mains = used.filter((x) => x.main)
        if (!mains.length) need = { rank: nr, direct: true }
        else {
          const up = (x) => x.f + ((nr.min - raw) * sw) / x.w
          const pick = mains.reduce((m, x) => (up(x) / x.f < up(m) / m.f ? x : m), mains[0])
          const fNew = up(pick)
          if (pick.ref) need = { rank: nr, id: pick.id, e1rm: Math.ceil((fNew / pick.factor) * pick.ref * bw * 2) / 2 }
          else if (pick.refReps) need = { rank: nr, id: pick.id, reps: Math.ceil(((fNew / pick.factor) * pick.refReps) / (1 + (pick.w0 || 0) / bw)) }
        }
      }
    }
    out[g] = { group: g, f, raw, rank, top: list[0], used, need, progress: nr ? Math.max(0, Math.min(1, (f - rank.min) / (nr.min - rank.min))) : 1 }
  }
  // rango general: los 7 músculos a la vez (el que no entrenas cuenta 0)
  const main7 = RANK_GROUPS.filter((g) => g !== 'Antebrazo')
  const any = main7.some((g) => out[g].f != null)
  const overall = any ? rankOf(main7.reduce((a, g) => a + Math.min(out[g].f || 0, MIN.diamante + 0.1), 0) / main7.length) : null
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
