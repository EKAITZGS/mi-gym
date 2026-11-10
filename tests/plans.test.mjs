// node tests/plans.test.mjs — comprueba el generador de rutinas
import assert from 'node:assert/strict'
import { buildPlan, generatePlan, stripSlots, SPLITS, typesFor, DEFAULT_WEEKDAYS, EQUIP, DAY_TYPES } from '../src/plans.js'
import { EX_BY_ID } from '../src/data/exercises.js'

for (let d = 1; d <= 7; d++) for (const lv of ['beginner', 'intermediate', 'advanced']) {
  const p = generatePlan(d, lv)
  assert.equal(p.length, d)
  for (const day of p) {
    assert.ok(day.items.length >= 3, `${day.name} tiene pocos ejercicios`)
    if (lv === 'beginner') assert.ok(day.items.length <= 5)
    for (const i of day.items) {
      assert.ok(EX_BY_ID[i.ex], i.ex)
      assert.ok(i.sets >= 2 && i.sets <= 5 && i.rest > 0 && i.rir >= 1 && !('slot' in i))
    }
    assert.ok(!('type' in day))
  }
}
// sin repetir ejercicios dentro de un día, con cualquier reparto y material
for (const s of SPLITS) for (const equip of [EQUIP, ['Mancuernas'], []]) {
  const t = typesFor(s, 5)
  const p = buildPlan({ days: DEFAULT_WEEKDAYS[5].map((w, i) => ({ weekday: w, type: t[i] })), equip, n: 8 })
  for (const day of p) {
    const ids = day.items.map((i) => i.ex)
    assert.equal(new Set(ids).size, ids.length, `repetido en ${day.name} (${equip})`)
    assert.ok(ids.length >= (equip.length ? 4 : 3), `${day.name} (${equip}): ${ids.length}`)
  }
}
// foco: una serie más en ese grupo
const f = buildPlan({ days: [{ weekday: 1, type: 'pecho' }], level: 'intermediate', focus: 'Pecho', rnd: () => 0 })
assert.ok(f[0].items.filter((i) => EX_BY_ID[i.ex].group === 'Pecho').every((i) => i.sets >= 4))
assert.ok(Object.keys(DAY_TYPES).length >= 9)
console.log('plans ok')
