// entrenador de objetivo y control semanal
import assert from 'node:assert/strict'
import { aimPlan, checkStatus } from '../src/aim.js'

const now = new Date('2026-11-14T10:00')
const d = (n) => { const x = new Date(now); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const food = {}
for (let i = 1; i <= 10; i++) food[d(i)] = [{ kcal: 2100, p: 140, c: 0, f: 0, grams: 100 }] // 2100 kcal y 140 g al día
const base = { goals: { kcal: 2200, protein: 150, aim: 'lose' }, sessions: [], food, polar: {}, plan: [] }

// define a −0,6 kg/semana con 80 kg (−0,75 %): ritmo ideal
const good = { ...base, body: { weight: [{ date: d(21), kg: 81.8 }, { date: d(14), kg: 81.2 }, { date: d(7), kg: 80.6 }, { date: d(0), kg: 80 }], waist: [{ date: d(21), cm: 92 }, { date: d(0), cm: 90.5 }] } }
const a = aimPlan(good, 'lose', now)
assert.ok(Math.abs(a.rate + 0.6) < 0.01, `rate ${a.rate}`)
assert.ok(a.items.some((i) => i.tone === 'green' && i.title.startsWith('Ritmo ideal')))
assert.ok(a.items.some((i) => i.title.startsWith('Cintura: −') || i.title.startsWith('Cintura: -')))
// mantenimiento = 2100 + 0,6×7700/7 = 2760 → objetivo definir −500 ≈ 2250
assert.equal(a.maint, 2750)
assert.equal(a.target.kcal, 2250)
assert.equal(a.kcalAvg, 2100)

// baja demasiado rápido (−1,5 kg/semana) → aviso
const fast = { ...base, body: { weight: [{ date: d(14), kg: 84 }, { date: d(7), kg: 82.5 }, { date: d(0), kg: 81 }] } }
assert.ok(aimPlan(fast, 'lose', now).items.some((i) => i.tone === 'yellow' && i.title.startsWith('Bajas muy rápido')))
// ganar músculo sin subir → aviso
const flat = { ...base, body: { weight: [{ date: d(14), kg: 80 }, { date: d(7), kg: 80 }, { date: d(0), kg: 80 }] } }
assert.ok(aimPlan(flat, 'gain', now).items.some((i) => i.tone === 'yellow' && i.title.startsWith('No estás subiendo')))
assert.ok(aimPlan(flat, 'keep', now).items.some((i) => i.tone === 'green' && i.title.startsWith('Ritmo ideal')))
// sin datos: no peta y pide pesarse
const empty = aimPlan({ goals: { kcal: 2000, protein: 120 }, sessions: [], food: {}, body: {} }, 'keep', now)
assert.ok(empty.items[0].title === 'Ritmo de peso')

// control: peso hace 8 días toca, cintura hoy no, fotos nunca
const c = checkStatus({ body: { weight: [{ date: d(8), kg: 80 }], waist: [{ date: d(0), cm: 90 }] } }, [{ id: 'x', date: d(3) }], now)
assert.deepEqual(c.map((r) => [r.key, r.due]), [['weight', true], ['waist', false], ['front', false], ['side', true]])
console.log('aim ok')
