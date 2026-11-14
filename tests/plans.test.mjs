// node tests/plans.test.mjs — comprueba el generador de rutinas
import assert from 'node:assert/strict'
import { buildPlan, generatePlan, stripSlots, SPLITS, typesFor, DEFAULT_WEEKDAYS, EQUIP } from '../src/plans.js'
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
console.log('plans ok')

// 2.0: objetivo, exclusiones, favoritos y análisis
import { GOALS, prescribe, analyzePlan, dayMinutes, pickFor } from '../src/plans.js'
{
  const bench = EX_BY_ID['Barbell_Bench_Press_-_Medium_Grip']
  const curl = Object.values(EX_BY_ID).find((x) => x.group === 'Bíceps' && !x.sec.length && !x.more) // aislamiento
  assert.equal(GOALS.length, 4)
  assert.equal(prescribe(bench, 'intermediate', null, 'strength').reps, '3-6')
  assert.equal(prescribe(bench, 'intermediate', null, 'strength').rest, 180)
  assert.equal(prescribe(bench, 'intermediate', null, 'strength').sets, 4)
  assert.equal(prescribe(curl, 'intermediate', null, 'strength').reps, '6-10')
  assert.equal(prescribe(bench, 'intermediate', null, 'general').rir, 3)
  assert.equal(prescribe(bench, 'intermediate', null, 'hyper').reps, '6-10')
  // excluido: nunca sale aunque sea el único candidato preferido
  for (let k = 0; k < 30; k++) {
    const x = pickFor({ g: 'Pecho', c: 1 }, { exclude: ['Barbell_Bench_Press_-_Medium_Grip'], rnd: Math.random })
    assert.notEqual(x.id, 'Barbell_Bench_Press_-_Medium_Grip')
  }
  // favorito: con rnd=0 sale el primero del pool; con favorito pesa ×4
  const fav = pickFor({ g: 'Bíceps' }, { prefer: ['Hammer_Curls'], rnd: () => 0.999 })
  assert.ok(fav)
  const plan = buildPlan({ days: [{ weekday: 1, type: 'pecho' }], level: 'intermediate', goal: 'strength', exclude: ['Barbell_Bench_Press_-_Medium_Grip'], rnd: () => 0 })
  assert.ok(plan[0].items.every((i) => i.ex !== 'Barbell_Bench_Press_-_Medium_Grip'))
  assert.ok(dayMinutes(plan[0].items) > 20)
  const an = analyzePlan(plan, { minutes: 60 })
  assert.ok(an.groups.Pecho.eff > 0)
  assert.equal(an.groups.Pecho.freq, 1)
  assert.ok(an.warnings.some((w) => /Espalda/.test(w))) // sin espalda en la semana → aviso de volumen bajo
  // dos días seguidos de pecho → nota de solapamiento
  const two = buildPlan({ days: [{ weekday: 1, type: 'pecho' }, { weekday: 2, type: 'pecho' }], rnd: () => 0 })
  assert.ok(analyzePlan(two).notes.some((w) => /dos días seguidos/.test(w)))
  console.log('plans 2.0 ok')
}
