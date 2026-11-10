// racha, totales de la semana, récords recientes y estancados
import assert from 'node:assert/strict'
import { streakWeeks, weekTotals, recentPRs, stalled, sessionVol, calcGoals } from '../src/stats.js'

const S = (date, w, r = 8, extra = {}) => ({ date, entries: { Bench: [{ w: String(w), r: String(r), drops: [] }] }, ...extra })
const now = new Date('2026-11-11T10:00') // miércoles

assert.equal(sessionVol({ entries: { a: [{ w: '10', r: '5', drops: [{ w: '5', r: '4' }] }] } }), 70)
// semanas: esta (lun 9), la anterior y la de antes; hueco antes de eso
const ses = [S('2026-10-14', 60), S('2026-10-27', 60), S('2026-11-03', 62), S('2026-11-10', 65, 8, { min: 50 })]
assert.equal(streakWeeks(ses, now), 3)
// sin entreno aún esta semana: la racha sigue contando desde la anterior
assert.equal(streakWeeks(ses.slice(0, 3), now), 2)
assert.equal(streakWeeks([], now), 0)
assert.deepEqual(weekTotals(ses, now), { n: 1, min: 50, vol: 520 })

const prs = recentPRs(ses, 30, now)
assert.equal(prs.length, 1)
assert.equal(prs[0].date, '2026-11-10')
assert.equal(prs[0].w, 65)
assert.equal(recentPRs([S('2026-11-10', 60)], 30, now).length, 0) // el primer registro no es récord

const flat = [S('2026-10-20', 70), S('2026-10-27', 68), S('2026-11-03', 70), S('2026-11-10', 69)]
assert.deepEqual(stalled(flat, now).map((x) => x.id), ['Bench'])
assert.equal(stalled([...flat.slice(0, 3), S('2026-11-10', 72)], now).length, 0)
assert.equal(stalled(flat, new Date('2026-12-30')).length, 0) // ya no lo haces
// objetivos: 80 kg, 175 cm, 25 años, hombre, algo activo -> BMR 1774 × 1,375 = 2439; bajar -20 % ≈ 1950
assert.deepEqual(calcGoals({ kg: 80, cm: 175, age: 25, male: true, act: 1.375, aim: 'lose' }), { kcal: 1950, protein: 160 })
assert.equal(calcGoals({ kg: 80, cm: 175, age: 25, male: true, act: 1.375, aim: 'keep' }).protein, 130)
assert.equal(calcGoals({ kg: 0, cm: 175, age: 25 }), null)
console.log('stats ok')
