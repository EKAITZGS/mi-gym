import { uid } from './store'
import { EXERCISES } from './data/exercises'

export const LEVELS = [
  { id: 'beginner', label: 'Principiante', hint: 'Empiezas o vuelves tras un parón', days: 3, range: '3 días (máx. 4)' },
  { id: 'intermediate', label: 'Intermedio', hint: 'Llevas 6-12 meses entrenando con constancia', days: 4, range: '4 días (3 a 5)' },
  { id: 'advanced', label: 'Avanzado', hint: 'Más de un año entrenando en serio', days: 5, range: '5 días (4 a 6)' },
]

export const EQUIP = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal']
export const MINUTES = [
  { min: 45, n: 4 },
  { min: 60, n: 6 },
  { min: 90, n: 8 },
]

// Huecos de cada tipo de día, por orden de prioridad: g = grupo, m = músculo principal, c = 1 multiarticular / 0 aislamiento
const S = (g, m, c) => ({ g, m, c })
export const DAY_TYPES = {
  full: { name: 'Cuerpo completo', slots: [S('Pierna', 'Cuádriceps', 1), S('Pecho', 0, 1), S('Espalda', 'Dorsales', 1), S('Hombro', 0, 1), S('Pierna', 'Femorales'), S('Espalda', 'Espalda media', 1), S('Bíceps'), S('Tríceps')] },
  torso: { name: 'Torso', slots: [S('Pecho', 0, 1), S('Espalda', 'Dorsales', 1), S('Hombro', 0, 1), S('Espalda', 'Espalda media', 1), S('Pecho'), S('Hombro', 0, 0), S('Bíceps'), S('Tríceps')] },
  pierna: { name: 'Pierna', slots: [S('Pierna', 'Cuádriceps', 1), S('Pierna', 'Femorales'), S('Pierna', 'Glúteos', 1), S('Pierna', 'Cuádriceps'), S('Pierna', 'Gemelos'), S('Core'), S('Pierna', 'Femorales'), S('Core')] },
  empuje: { name: 'Empuje', slots: [S('Pecho', 0, 1), S('Hombro', 0, 1), S('Pecho'), S('Hombro', 0, 0), S('Tríceps'), S('Pecho'), S('Tríceps'), S('Core')] },
  tiron: { name: 'Tirón', slots: [S('Espalda', 'Dorsales', 1), S('Espalda', 'Espalda media', 1), S('Espalda', 'Dorsales'), S('Bíceps'), S('Hombro', 0, 0), S('Bíceps'), S('Espalda'), S('Core')] },
  pecho: { name: 'Pecho y tríceps', slots: [S('Pecho', 0, 1), S('Pecho', 0, 1), S('Pecho'), S('Tríceps'), S('Pecho'), S('Tríceps'), S('Tríceps'), S('Core')] },
  espalda: { name: 'Espalda y bíceps', slots: [S('Espalda', 'Dorsales', 1), S('Espalda', 'Espalda media', 1), S('Espalda'), S('Bíceps'), S('Espalda'), S('Bíceps'), S('Bíceps'), S('Core')] },
  hombro: { name: 'Hombro y brazos', slots: [S('Hombro', 0, 1), S('Hombro', 0, 0), S('Bíceps'), S('Tríceps'), S('Hombro'), S('Bíceps'), S('Tríceps'), S('Core')] },
  core: { name: 'Core', slots: [S('Core'), S('Core'), S('Core'), S('Espalda', 'Lumbar'), S('Core'), S('Core')] },
}

// Repartos según los días que entrenas; se aplican en ciclo a los días elegidos
export const SPLITS = [
  { id: 'full', label: 'Cuerpo completo', cycle: ['full'], best: [1, 2, 3] },
  { id: 'tp', label: 'Torso / Pierna', cycle: ['torso', 'pierna'], best: [4] },
  { id: 'ppl', label: 'Empuje / Tirón / Pierna', cycle: ['empuje', 'tiron', 'pierna'], best: [6, 7] },
  { id: 'weider', label: 'Un grupo por día', cycle: ['pecho', 'espalda', 'pierna', 'hombro', 'full'], best: [5] },
]
export const DEFAULT_WEEKDAYS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0] }
export const splitFor = (n) => SPLITS.find((s) => s.best.includes(n)) || SPLITS[0]
// el 7.º día seguido es suave (core)
export const typesFor = (split, n) => Array.from({ length: n }, (_, i) => (i === 6 ? 'core' : split.cycle[i % split.cycle.length]))

// Ejercicios clásicos que se prefieren al generar (pesan más en el sorteo)
const STAPLES = new Set('Alternate_Incline_Dumbbell_Curl Barbell_Bench_Press_-_Medium_Grip Barbell_Curl Barbell_Hip_Thrust Barbell_Squat Bent_Over_Barbell_Row Cable_Crossover Cable_Crunch Cable_Rope_Overhead_Triceps_Extension Close-Grip_Front_Lat_Pulldown Crunches Dumbbell_Bench_Press Dumbbell_Bicep_Curl Dumbbell_Shoulder_Press Face_Pull Goblet_Squat Hammer_Curls Hanging_Leg_Raise Hyperextensions_Back_Extensions Incline_Dumbbell_Press Leg_Extensions Leg_Press Leverage_Chest_Press Leverage_Incline_Chest_Press Lying_Leg_Curls Lying_Triceps_Press Machine_Shoulder_Military_Press One-Arm_Dumbbell_Row Plank Reverse_Machine_Flyes Romanian_Deadlift Seated_Cable_Rows Seated_Calf_Raise Seated_Leg_Curl Side_Lateral_Raise Standing_Calf_Raises Triceps_Pushdown Triceps_Pushdown_-_Rope_Attachment Wide-Grip_Lat_Pulldown'.split(' '))

const multi = (x) => x.sec.length > 0
// Avanzados, de técnica difícil o de salto: están en la biblioteca, pero el generador no los mete solo
const NO_GEN = new Set('Handstand_Push-Ups Front_Box_Jump Freehand_Jump_Squat Ring_Dips One-Arm_Medicine_Ball_Slam Zercher_Squats Cuban_Press JM_Press Tate_Press Drag_Curl Rack_Pulls Natural_Glute_Ham_Raise Glute_Ham_Raise Weighted_Pull_Ups Single-Arm_Linear_Jammer Bent_Over_One-Arm_Long_Bar_Row Superman Mountain_Climbers Flutter_Kicks Sumo_Deadlift Barbell_Deadlift Kettlebell_One-Legged_Deadlift One-Arm_Kettlebell_Swings'.split(' '))
const equipOk = (x, equip) =>
  x.equip === 'Peso corporal' || equip.includes(x.equip) || (x.equip === 'Barra Z' && equip.includes('Barra')) || (x.equip === 'Otro' && equip.includes('Máquina'))

// Busca un ejercicio para el hueco; si el material no da, afloja primero el tipo y luego el músculo
export function pickFor(slot, { equip = EQUIP, used = new Set(), avoid = [], rnd = Math.random } = {}) {
  const tries = [slot, { ...slot, c: undefined }, { g: slot.g }]
  for (const s of tries) {
    const cands = EXERCISES.filter(
      (x) => x.group === s.g && (!s.m || x.main.includes(s.m)) && (s.c == null || multi(x) === !!s.c) && equipOk(x, equip) && !avoid.includes(x.id) && !NO_GEN.has(x.id),
    )
    if (!cands.length) continue
    const fresh = cands.filter((x) => !used.has(x.id))
    const pool = (fresh.length ? fresh : cands).flatMap((x) => (STAPLES.has(x.id) ? [x, x, x] : [x]))
    return pool[Math.floor(rnd() * pool.length)]
  }
  return null
}

// Series, reps, intensidad (RIR = reps en reserva) y descanso según nivel y tipo de ejercicio
export function prescribe(x, level, focus) {
  const core = x.group === 'Core'
  const c = multi(x) && !core
  const sets = (level === 'beginner' ? (c ? 3 : 2) : level === 'advanced' ? (c ? 4 : 3) : 3) + (focus === x.group ? 1 : 0)
  const reps = /Plank/.test(x.id) ? '30-45 s' : core ? '12-15' : c ? (level === 'beginner' ? '10-12' : '6-10') : '10-15'
  return { sets, reps, rir: level === 'beginner' ? 3 : c ? 2 : 1, rest: core ? 60 : c ? 150 : 75 }
}

export function buildDay(type, opts, used = new Set()) {
  const n = Math.min(opts.n || 6, opts.level === 'beginner' ? 5 : 8)
  const items = []
  for (const slot of DAY_TYPES[type].slots.slice(0, n)) {
    const x = pickFor(slot, { ...opts, used, avoid: items.map((i) => i.ex) }) // nunca repite en el mismo día
    if (!x) continue
    used.add(x.id)
    items.push({ id: uid(), ex: x.id, drop: false, ...prescribe(x, opts.level, opts.focus), slot })
  }
  return items
}

// days: [{ weekday, type }]. Días e ítems llevan `type`/`slot` para poder regenerarlos; se quitan al guardar (stripSlots).
export function buildPlan({ days, level = 'intermediate', n = 6, equip = EQUIP, focus = null, rnd }) {
  const used = new Set()
  return days.map((d) => ({
    id: uid(),
    name: DAY_TYPES[d.type].name,
    weekday: d.weekday,
    type: d.type,
    items: buildDay(d.type, { level, n, equip, focus, rnd }, used),
  }))
}
export const stripSlots = (plan) => plan.map(({ type, ...d }) => ({ ...d, items: d.items.map(({ slot, ...i }) => i) }))

// Plan rápido (lo usa el entrenador sin IA): reparto recomendado para esos días
export function generatePlan(days, level = 'intermediate') {
  const types = typesFor(splitFor(days), days)
  return stripSlots(buildPlan({ days: DEFAULT_WEEKDAYS[days].map((w, i) => ({ weekday: w, type: types[i] })), level }))
}
