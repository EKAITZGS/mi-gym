import { uid } from './store'
import { EXERCISES, EX_BY_ID } from './data/exercises'

export const LEVELS = [
  { id: 'beginner', label: 'Principiante', hint: 'Empiezas o vuelves tras un parón', days: 3, range: '3 días (máx. 4)' },
  { id: 'intermediate', label: 'Intermedio', hint: 'Llevas 6-12 meses entrenando con constancia', days: 4, range: '4 días (3 a 5)' },
  { id: 'advanced', label: 'Avanzado', hint: 'Más de un año entrenando en serio', days: 5, range: '5 días (4 a 6)' },
]

export const EQUIP = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal']
// Objetivo de la rutina: cambia reps, descanso, RIR y series de los multiarticulares
export const GOALS = [
  { id: 'hyper', label: 'Hipertrofia', hint: 'Ganar músculo: 6-15 reps, cerca del fallo' },
  { id: 'strength', label: 'Fuerza', hint: 'Más kilos en los básicos: 3-6 reps y descansos largos' },
  { id: 'recomp', label: 'Recomposición', hint: 'Perder grasa manteniendo músculo: como hipertrofia, cuidando la recuperación' },
  { id: 'general', label: 'Salud y forma', hint: 'Entrenar bien sin buscar el límite: 10-15 reps, RIR 3' },
]
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
// exclude: ids que no se meten nunca (excluidos por el usuario o por molestias); prefer: favoritos (pesan ×3, como los clásicos)
export function pickFor(slot, { equip = EQUIP, used = new Set(), avoid = [], exclude = [], prefer = [], rnd = Math.random } = {}) {
  const tries = [slot, { ...slot, c: undefined }, { g: slot.g }]
  const ex = new Set(exclude)
  const fav = new Set(prefer)
  for (const s of tries) {
    const cands = EXERCISES.filter(
      (x) => x.group === s.g && (!s.m || x.main.includes(s.m)) && (s.c == null || multi(x) === !!s.c) && equipOk(x, equip) && !avoid.includes(x.id) && !ex.has(x.id) && !NO_GEN.has(x.id) && !x.more,
    )
    if (!cands.length) continue
    const fresh = cands.filter((x) => !used.has(x.id))
    const pool = (fresh.length ? fresh : cands).flatMap((x) => (fav.has(x.id) ? [x, x, x, x] : STAPLES.has(x.id) ? [x, x, x] : [x]))
    return pool[Math.floor(rnd() * pool.length)]
  }
  return null
}

// Series, reps, intensidad (RIR = reps en reserva) y descanso según nivel y tipo de ejercicio
export function prescribe(x, level, focus, goal = 'hyper') {
  const core = x.group === 'Core'
  const c = multi(x) && !core
  let sets = (level === 'beginner' ? (c ? 3 : 2) : level === 'advanced' ? (c ? 4 : 3) : 3) + (focus === x.group ? 1 : 0)
  let reps = /Plank/.test(x.id) ? '30-45 s' : core ? '12-15' : c ? (level === 'beginner' ? '10-12' : '6-10') : '10-15'
  let rir = level === 'beginner' ? 3 : c ? 2 : 1
  let rest = core ? 60 : c ? 150 : 75
  if (goal === 'strength' && !core) {
    if (c) {
      sets += level === 'beginner' ? 0 : 1
      reps = level === 'beginner' ? '5-8' : '3-6'
      rest = 180
      rir = 2
    } else {
      reps = '6-10'
      rest = 90
    }
  } else if (goal === 'general' && !core) {
    reps = c ? '10-15' : '12-15'
    rir = 3
    rest = c ? 120 : 75
  }
  return { sets, reps, rir, rest }
}

// Minutos estimados de un día: 6 de calentamiento + por serie (descanso + ~40 s de ejecución)
export const dayMinutes = (items = []) =>
  Math.round(6 + items.reduce((t, i) => t + (Number(i.sets) || 0) * ((i.rest || 90) + 40), 0) / 60)

export function buildDay(type, opts, used = new Set()) {
  const n = Math.min(opts.n || 6, opts.level === 'beginner' ? 5 : 8)
  const items = []
  for (const slot of DAY_TYPES[type].slots.slice(0, n)) {
    const x = pickFor(slot, { ...opts, used, avoid: items.map((i) => i.ex) }) // nunca repite en el mismo día
    if (!x) continue
    used.add(x.id)
    items.push({ id: uid(), ex: x.id, drop: false, ...prescribe(x, opts.level, opts.focus, opts.goal), slot })
  }
  return items
}

// days: [{ weekday, type }]. Días e ítems llevan `type`/`slot` para poder regenerarlos; se quitan al guardar (stripSlots).
export function buildPlan({ days, level = 'intermediate', n = 6, equip = EQUIP, focus = null, goal = 'hyper', exclude = [], prefer = [], rnd }) {
  const used = new Set()
  return days.map((d) => ({
    id: uid(),
    name: DAY_TYPES[d.type].name,
    weekday: d.weekday,
    type: d.type,
    items: buildDay(d.type, { level, n, equip, focus, goal, exclude, prefer, rnd }, used),
  }))
}

// Análisis de una rutina semanal (días con weekday): volumen efectivo por grupo (directas + ½ indirectas),
// frecuencia, solapamiento en días seguidos, parte de multiarticulares y duración. Los umbrales (10-20 series)
// son orientativos: se explican, no se imponen.
export function analyzePlan(days, { minutes = 60 } = {}, groupsOf = defaultGroupsOf) {
  const groups = {}
  const add = (g, k, v) => ((groups[g] ??= { direct: 0, indirect: 0, days: new Set() })[k] += v)
  const byWd = {}
  let sets = 0, multiSets = 0
  const out = { groups: {}, days: [], warnings: [], notes: [] }
  for (const d of days) {
    const its = d.items || []
    const mins = dayMinutes(its)
    const main = new Set()
    for (const it of its) {
      const n = Number(it.sets) || 0
      sets += n
      const ex = EX_BY_ID[it.ex]
      if (ex && multi(ex) && ex.group !== 'Core') multiSets += n
      for (const { g, main: isMain } of groupsOf(it.ex)) {
        add(g, isMain ? 'direct' : 'indirect', n)
        groups[g].days.add(d.weekday ?? d.id)
        if (isMain) main.add(g)
      }
    }
    if (d.weekday != null) byWd[d.weekday] = main
    out.days.push({ id: d.id, name: d.name, weekday: d.weekday, minutes: mins, sets: its.reduce((t, i) => t + (Number(i.sets) || 0), 0), n: its.length })
    if (mins > minutes + 15) out.warnings.push(`${d.name}: unos ${mins} min, más de los ${minutes} que dijiste. Quita un ejercicio o una serie, o acorta descansos.`)
  }
  for (const [g, v] of Object.entries(groups)) {
    const eff = Math.round(v.direct + v.indirect / 2)
    out.groups[g] = { direct: v.direct, indirect: v.indirect, eff, freq: v.days.size }
  }
  const big = ['Pecho', 'Espalda', 'Pierna', 'Hombro']
  const low = big.filter((g) => (out.groups[g]?.eff || 0) < 8)
  const high = Object.entries(out.groups).filter(([g, v]) => g !== 'Antebrazo' && v.eff > 22).map(([g]) => g)
  if (low.length) out.warnings.push(`${low.join(', ')}: menos de 8 series efectivas a la semana. Para crecer suele hacer falta más (10-20 es una referencia habitual, no una ley).`)
  if (high.length) out.warnings.push(`${high.join(', ')}: más de 22 series a la semana. Más no es mejor si no recuperas; vigila sensaciones y sueño.`)
  if (days.length >= 4) {
    const once = big.filter((g) => out.groups[g]?.eff >= 10 && out.groups[g]?.freq === 1)
    if (once.length) out.notes.push(`${once.join(', ')}: todo el volumen en un solo día. Con ${days.length} días podrías repartirlo en dos para rendir mejor en cada serie (si prefieres un día, también vale).`)
  }
  // solapamiento: mismo grupo principal en dos días seguidos
  const wds = Object.keys(byWd).map(Number).sort((a, b) => a - b)
  const seen = new Set()
  for (const w of wds) {
    const next = (w + 1) % 7
    if (!byWd[next]) continue
    for (const g of byWd[w]) if (byWd[next].has(g) && !seen.has(g)) {
      seen.add(g)
      out.notes.push(`${g} se entrena dos días seguidos. Suele ir mejor dejar 48 h entre sesiones del mismo músculo.`)
    }
  }
  if (sets && multiSets / sets < 0.4) out.notes.push('Menos del 40 % de las series son multiarticulares (press, remo, sentadilla…). Son las que más rinden por minuto.')
  out.total = { sets, multiSets, minutes: out.days.reduce((t, d) => t + d.minutes, 0) }
  return out
}
// grupos por ejercicio: principal y secundarios (como en ranks.js, sin importarlo para evitar ciclos)
function defaultGroupsOf(id) {
  const ex = EX_BY_ID[id]
  if (!ex || ex.group === 'Cardio' || ex.group === 'Estiramientos') return []
  const map = { Hombros: 'Hombro', Dorsales: 'Espalda', 'Espalda media': 'Espalda', Lumbar: 'Espalda', Trapecio: 'Espalda', Abdominales: 'Core', Oblicuos: 'Core', Cuádriceps: 'Pierna', Femorales: 'Pierna', Glúteos: 'Pierna', Gemelos: 'Pierna', Aductores: 'Pierna', Abductores: 'Pierna', Antebrazos: 'Antebrazo' }
  const out = [{ g: ex.group, main: true }]
  for (const m of ex.sec || []) {
    const g = map[m] || m
    if (g !== ex.group && !out.some((o) => o.g === g)) out.push({ g, main: false })
  }
  return out
}
export const stripSlots = (plan) => plan.map(({ type, ...d }) => ({ ...d, items: d.items.map(({ slot, ...i }) => i) }))

// Plan rápido (lo usa el entrenador sin IA): reparto recomendado para esos días
export function generatePlan(days, level = 'intermediate') {
  const types = typesFor(splitFor(days), days)
  return stripSlots(buildPlan({ days: DEFAULT_WEEKDAYS[days].map((w, i) => ({ weekday: w, type: types[i] })), level }))
}
