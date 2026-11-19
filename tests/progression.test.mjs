// Progreso serie a serie, fatiga por el orden de los ejercicios, foco en glúteo y referencias de mujeres
import assert from 'node:assert/strict'
import { overlap, sessionOrder, preFatigue, liveFatigue, fatigueNote, compareSets, compareTag, compareTxt, setTargets, targetsTxt, exHistory, FATIGUE_GAP } from '../src/progression.js'
import { progressRead, stalled } from '../src/stats.js'
import { buildPlan, buildDay, prescribe, typeFor, DAY_TYPES } from '../src/plans.js'
import { EX_BY_ID } from '../src/data/exercises.js'
import { strengthLevel, levelPrompt } from '../src/aiPlan.js'
import { muscleRanks } from '../src/ranks.js'
import { sexFactor, sexOf } from '../src/sex.js'

const S = (w, r, extra = {}) => ({ w: String(w), r: String(r), drops: [], ...extra })
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const INCL = 'Incline_Dumbbell_Press'
const PUSH = 'Triceps_Pushdown'
const CURL = 'Dumbbell_Bicep_Curl'

// --- cuánto cansa un ejercicio a otro ---
assert.equal(overlap(BENCH, BENCH), 1)
assert.equal(overlap(INCL, BENCH), 1) // mismo músculo principal
assert.equal(overlap(BENCH, PUSH), 0.5) // el tríceps trabaja de rebote en el press
assert.equal(overlap(CURL, 'Barbell_Squat'), 0) // nada que ver

// --- orden de un entreno ---
const plan = [{ id: 'd1', name: 'Pecho', items: [{ ex: BENCH }, { ex: INCL }, { ex: PUSH }] }]
const ses = (date, entries, extra = {}) => ({ id: date, date, dayId: 'd1', entries, ...extra })
// sin `order`: el del día del plan (aunque las claves vengan desordenadas, como en la nube)
assert.deepEqual(sessionOrder(ses('2026-11-01', { [PUSH]: [S(20, 10)], [BENCH]: [S(60, 8)] }), plan), [BENCH, PUSH])
// con `order`: el real
assert.deepEqual(sessionOrder(ses('2026-11-01', { [BENCH]: [S(60, 8)], [PUSH]: [S(20, 10)] }, { order: [PUSH, BENCH] }), plan), [PUSH, BENCH])
// ejercicios que no están en el día y sin `order`: no se sabe
assert.equal(sessionOrder(ses('2026-11-01', { [BENCH]: [S(60, 8)], [CURL]: [S(10, 10)] }), plan), null)

// --- fatiga previa ---
const tri1 = ses('2026-11-03', { [BENCH]: [S(60, 8), S(60, 8), S(60, 7)], [INCL]: [S(20, 10), S(20, 10)], [PUSH]: [S(25, 12), S(25, 11)] })
assert.equal(preFatigue(tri1, BENCH, plan), 0)
assert.equal(preFatigue(tri1, INCL, plan), 3)
assert.equal(preFatigue(tri1, PUSH, plan), 2.5) // 3 de banca + 2 de inclinado, de rebote (×0,5)
const benchLast = ses('2026-11-05', { [INCL]: [S(20, 10), S(20, 10), S(20, 10)], [BENCH]: [S(60, 6), S(60, 6), S(60, 5)] }, { order: [INCL, BENCH] })
assert.equal(preFatigue(benchLast, BENCH, plan), 3)
assert.ok(fatigueNote(3, 0).more)
assert.equal(fatigueNote(1, 0), null)
assert.equal(fatigueNote(0, 3).more, false)
assert.equal(fatigueNote(null, 0), null)
// hoy, en directo: antes de empezar cuenta lo previsto antes en la lista; ya empezado, lo que de verdad hiciste antes
const items = [{ ex: BENCH, sets: 3 }, { ex: INCL, sets: 3 }, { ex: PUSH, sets: 3 }]
assert.equal(liveFatigue(items, {}, {}, INCL), 3)
assert.equal(liveFatigue(items, { [INCL]: [S(20, 10)] }, { [INCL]: 1 }, INCL), 0) // empezó por el inclinado
assert.equal(liveFatigue(items, { [BENCH]: [S(60, 8), S(60, 8)], [INCL]: [S(20, 10)] }, { [BENCH]: 1, [INCL]: 2 }, INCL), 2)

// --- serie a serie ---
let c = compareSets([S(40, 10), S(40, 9), S(40, 8)], [S(40, 10), S(40, 10), S(40, 9)])
assert.equal(c.kind, 'up') // misma mejor serie, pero más reps en las de después
assert.equal(c.reps, 2)
assert.equal(compareTag(c), '+2 reps')
assert.equal(compareTxt(c), '2 reps más con el mismo peso')
c = compareSets([S(40, 10), S(40, 10)], [S(42.5, 8), S(42.5, 8)])
assert.equal(c.kind, 'same') // más peso con algo menos de reps = mismo 1RM: paso normal de la progresión
c = compareSets([S(40, 10), S(40, 10)], [S(42.5, 10), S(40, 9)])
assert.equal(c.kind, 'mixed')
c = compareSets([S(40, 10, { warm: true }), S(60, 8)], [S(60, 6)])
assert.equal(c.kind, 'down') // el calentamiento no cuenta
assert.equal(compareSets([], [S(60, 6)]).kind, 'none')

// --- objetivo por serie (doble progresión serie a serie) ---
let t = setTargets([S(40, 10), S(40, 9), S(40, 8)], '8-10', 'Barra')
assert.deepEqual(t.map((x) => [x.w, x.r, x.up]), [[42.5, 8, true], [40, 10, false], [40, 9, false]])
assert.equal(targetsTxt(t), '42,5×8 · 40×10 · 40×9')
assert.equal(targetsTxt(setTargets([S(30, 8), S(30, 8)], '8-12', 'Máquina')), '9 · 9 reps con 30 kg')
// con bastante más fatiga que la otra vez: igualar
t = setTargets([S(40, 10), S(40, 9)], '8-10', 'Barra', { fatigue: fatigueNote(4, 0) })
assert.deepEqual(t.map((x) => [x.w, x.r, x.up]), [[40, 10, false], [40, 9, false]])
// te sobraban 3+ reps: sube aunque no llegaras al tope
assert.ok(setTargets([S(40, 8)], '8-10', 'Barra', { rir: 3 })[0].up)
// mancuernas: salto pequeño
assert.equal(setTargets([S(12, 12)], '10-12', 'Mancuernas')[0].w, 13)
// peso corporal: más reps
assert.equal(setTargets([S('', 10)], '8-10', 'Peso corporal')[0].r, 11)

// --- lectura del progreso con fatiga y serie a serie ---
const benchSes = [
  ses('2026-10-20', { [BENCH]: [S(60, 8), S(60, 8), S(60, 7)] }, { order: [BENCH] }),
  ses('2026-10-23', { [BENCH]: [S(60, 8), S(60, 8), S(60, 8)] }, { order: [BENCH] }),
  ses('2026-10-27', { [BENCH]: [S(62.5, 8), S(62.5, 7), S(62.5, 7)] }, { order: [BENCH] }),
]
// hoy lo hizo tras el inclinado y rindió menos: fatiga, no retroceso
let read = progressRead(exHistory([...benchSes, benchLast], BENCH, plan))
assert.equal(read.kind, 'fatigue')
assert.match(read.text, /no es un retroceso/)
// sin saber el orden, la lectura de siempre
read = progressRead(exHistory([...benchSes, { ...benchLast, order: undefined, dayId: 'x' }], BENCH, plan))
assert.equal(read.kind, 'down')
// mejor serie igual pero más reps en las de después
read = progressRead(exHistory([...benchSes, ses('2026-10-30', { [BENCH]: [S(62.5, 8), S(62.5, 8), S(62.5, 8)] }, { order: [BENCH] })], BENCH, plan))
assert.equal(read.kind, 'sets')
assert.match(read.text, /serie a serie/)

// --- estancados: más reps en las series de después también es mejorar; los días con mucha más fatiga no cuentan ---
const now = new Date('2026-11-06T12:00:00')
const flatBest = [
  ses('2026-10-16', { [BENCH]: [S(60, 8), S(60, 6), S(60, 5)] }, { order: [BENCH] }),
  ses('2026-10-20', { [BENCH]: [S(60, 8), S(60, 6), S(60, 6)] }, { order: [BENCH] }),
  ses('2026-10-27', { [BENCH]: [S(60, 8), S(60, 7), S(60, 6)] }, { order: [BENCH] }),
  ses('2026-11-03', { [BENCH]: [S(60, 8), S(60, 8), S(60, 7)] }, { order: [BENCH] }),
]
assert.equal(stalled(flatBest, now, plan).length, 0)
const really = flatBest.map((x) => ({ ...x, entries: { [BENCH]: [S(60, 8), S(60, 6), S(60, 5)] } }))
assert.equal(stalled(really, now, plan).length, 1)
// un día peor por fatiga (lo hizo el último) no lo convierte en estancado ni cuenta como comparable
const withTired = [
  ...benchSes.map((x, i) => ({ ...x, date: ['2026-10-13', '2026-10-16', '2026-10-20'][i] })),
  ses('2026-10-27', { [BENCH]: [S(62.5, 8), S(62.5, 8), S(62.5, 7)] }, { order: [BENCH] }),
  ses('2026-11-03', { [INCL]: [S(20, 10), S(20, 10), S(20, 10), S(20, 10)], [BENCH]: [S(55, 6), S(55, 6)] }, { order: [INCL, BENCH] }),
]
assert.equal(stalled(withTired, now, plan).length, 0)
assert.ok(FATIGUE_GAP > 0)

// --- foco en glúteo ---
assert.equal(typeFor('pierna', 'Glúteo'), 'gluteo')
assert.equal(typeFor('full', 'Glúteo'), 'fullg')
assert.equal(typeFor('pierna', 'Pecho'), 'pierna')
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const gp = buildPlan({ days: [{ weekday: 1, type: 'pierna' }, { weekday: 3, type: 'torso' }, { weekday: 5, type: 'full' }], focus: 'Glúteo', rnd })
assert.equal(gp[0].type, 'gluteo')
assert.equal(gp[0].name, DAY_TYPES.gluteo.name)
assert.ok(EX_BY_ID[gp[0].items[0].ex].main.includes('Glúteos')) // empieza por glúteo
assert.ok(gp[0].items.some((i) => EX_BY_ID[i.ex].main.includes('Abductores')))
assert.equal(gp[1].type, 'torso') // el torso no cambia
assert.ok(EX_BY_ID[gp[2].items[0].ex].main.includes('Glúteos'))
// una serie más en los de glúteo
const ht = EX_BY_ID.Barbell_Hip_Thrust
assert.equal(prescribe(ht, 'intermediate', 'Glúteo').sets, prescribe(ht, 'intermediate', null).sets + 1)
assert.equal(prescribe(EX_BY_ID[BENCH], 'intermediate', 'Glúteo').sets, prescribe(EX_BY_ID[BENCH], 'intermediate', null).sets)
// sin foco, el día de glúteo se puede elegir a mano
assert.ok(buildDay('gluteo', { level: 'intermediate', n: 6, rnd }).length >= 5)

// --- mujeres: referencias propias ---
assert.equal(sexOf({ prefs: { sex: 'f' } }), 'f')
assert.equal(sexOf({ prefs: {} }), null)
assert.equal(sexFactor(BENCH, null), 1)
assert.ok(sexFactor(BENCH, 'f') < sexFactor('Barbell_Squat', 'f'))
assert.ok(sexFactor('Barbell_Squat', 'f') < sexFactor('Barbell_Hip_Thrust', 'f'))
const today = new Date('2026-11-10T12:00:00')
const lifter = (sex) => ({
  prefs: sex ? { sex } : {},
  body: { weight: [{ date: '2026-11-01', kg: 60 }] },
  sessions: [{ id: 'a', date: '2026-11-05', entries: { [BENCH]: [S(35, 5)], Barbell_Squat: [S(50, 5)], Romanian_Deadlift: [S(50, 8)] } }],
})
// 35 kg en banca y 50 en sentadilla con 60 kg de peso: principiante con referencias de hombre, intermedia con las de mujer
assert.equal(strengthLevel(lifter(null), today).id, 'beginner')
assert.equal(strengthLevel(lifter('f'), today).id, 'intermediate')
assert.match(levelPrompt(lifter('f')), /MUJER/)
assert.doesNotMatch(levelPrompt(lifter(null)), /MUJER/)
// «Tu personaje»: la misma fuerza da más rango con referencias de mujer
const rk = (sex) => muscleRanks({ ...lifter(sex), sessions: [{ id: 'a', date: new Date().toISOString().slice(0, 10), entries: { [BENCH]: [S(40, 5)] } }] }).groups.Pecho.f
assert.ok(rk('f') > rk(null) * 1.5)

console.log('progress: ok')
