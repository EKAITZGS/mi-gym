// Pulso por serie y por ejercicio con la hora de cada serie y la curva del reloj
import assert from 'node:assert/strict'
import { watchStart, hrBySet, sessionForWatch, watchForSession, hasSetTimes } from '../src/hrsets.js'

const B = 'Barbell_Bench_Press_-_Medium_Grip'
const C = 'Dumbbell_Bicep_Curl'
const Q = 'Barbell_Squat'
// inicio 18:00 hora local de Madrid en invierno (UTC+1)
const watch = { id: 'w1', date: '2026-11-20', time: '18:00', start: '2026-11-20T18:00:00', off: 60, hr: { step: 15, v: Array(240).fill(100) } }
const t0 = Date.parse('2026-11-20T17:00:00Z')
assert.equal(watchStart(watch), t0)
assert.ok(watchStart({ date: '2026-11-20', time: '18:00' }) > 0) // antiguos: con hora y minuto
assert.equal(watchStart({}), null)
// picos de pulso: banca en el min 5-8 (150), curl en el 20-23 (125), sentadilla en el 35-38 (165)
const bump = (min, hr) => { for (let s = -30; s <= 0; s += 15) watch.hr.v[Math.round((min * 60 + s) / 15)] = hr }
const at = (min) => t0 + min * 60000
const S = (min, extra = {}) => ({ w: '40', r: '10', drops: [], t: at(min), ...extra })
for (const m of [5, 6.5, 8]) bump(m, 150)
for (const m of [20, 21.5, 23]) bump(m, 125)
for (const m of [35, 36.5, 38]) bump(m, 165)
const ses = { id: 's1', date: '2026-11-20', entries: { [B]: [S(3, { warm: true }), S(5), S(6.5), S(8)], [C]: [S(20), S(21.5), S(23)], [Q]: [S(35), S(36.5), S(38)] } }
const r = hrBySet(ses, watch)
assert.deepEqual(r.ex.map((x) => x.id), [Q, B, C]) // de más a menos pulso
assert.equal(r.ex[0].avg, 165)
assert.equal(r.ex[1].avg, 150)
assert.equal(r.ex[2].avg, 125)
assert.equal(r.ex[1].n, 3) // el calentamiento no cuenta
assert.equal(r.sets.length, 10)
assert.equal(r.sets[0].sec, 180)
// series apuntadas todas de golpe al final: las horas no sirven
const lump = { ...ses, entries: Object.fromEntries(Object.entries(ses.entries).map(([k, l]) => [k, l.map((x, i) => ({ ...x, t: at(60) + i * 1000 }))])) }
assert.equal(hrBySet(lump, watch), null)
// otro día / otra hora: no encaja
assert.equal(hrBySet({ ...ses, entries: { [B]: [S(-300), S(-290)] } }, watch), null)
// sin horas (entrenos de antes)
const old = { id: 's0', date: '2026-11-20', entries: { [B]: [{ w: '40', r: '10', drops: [] }, { w: '40', r: '10', drops: [] }] } }
assert.equal(hrBySet(old, watch), null)
assert.equal(hasSetTimes(old), false)
assert.equal(hasSetTimes(ses), true)
// en los datos: el entreno del reloj encuentra su entreno apuntado y al revés
const data = { sessions: [old, ses], polar: { exercises: { w1: watch } } }
assert.equal(sessionForWatch(data, watch).session.id, 's1')
assert.equal(watchForSession(data, ses).watch.id, 'w1')
assert.equal(watchForSession(data, old), null)
console.log('hrsets ok')
