// Fusión a tres bandas entre dispositivos: nada se pierde, los borrados viajan y no hay duplicados
import assert from 'node:assert/strict'
import { merge3, canon } from '../src/sync.js'
import { migrate } from '../src/migrate.js'

const B = 'Barbell_Bench_Press_-_Medium_Grip'
const S = (id, date, w = '60') => ({ id, date, dayName: 'Pecho', entries: { [B]: [{ w, r: '8', drops: [] }] } })
const base = migrate({
  v: 2,
  goals: { kcal: 2200, protein: 150 },
  plan: [{ id: 'd1', name: 'Pecho', weekday: 1, items: [{ id: 'i1', ex: B, sets: 3, reps: '8-10' }, { id: 'i2', ex: 'Dips', sets: 3, reps: '10' }] }],
  sessions: [S('s1', '2026-11-01')],
  food: { '2026-11-10': [{ id: 'f1', name: 'Pollo', grams: 150 }, { id: 'f2', name: 'Arroz', grams: 100 }] },
  body: { weight: [{ date: '2026-11-01', kg: 80 }] },
  favEx: ['A', 'B'],
})
const clone = (x) => JSON.parse(JSON.stringify(x))

// 1) cambios distintos en cada móvil: se quedan todos
{
  const local = clone(base)
  local.sessions.push(S('s2', '2026-11-03'))
  local.body.weight.push({ date: '2026-11-08', kg: 79.5 })
  local.goals.kcal = 2100
  const remote = clone(base)
  remote.sessions.push(S('s3', '2026-11-02'))
  remote.food['2026-11-11'] = [{ id: 'f3', name: 'Huevos', grams: 120 }]
  remote.goals.protein = 160
  remote.plan[0].items[1].sets = 4
  const { data, conflicts } = merge3(base, local, remote)
  assert.deepEqual(conflicts, [])
  assert.deepEqual(data.sessions.map((s) => s.id), ['s1', 's3', 's2']) // por fecha, sin duplicados
  assert.equal(data.body.weight.length, 2)
  assert.equal(data.food['2026-11-11'][0].id, 'f3')
  assert.deepEqual(data.goals, { ...base.goals, kcal: 2100, protein: 160 })
  assert.equal(data.plan[0].items[1].sets, 4)
  // idempotente: volver a fusionar con lo ya fusionado no cambia nada (no duplica)
  assert.equal(canon(merge3(data, data, data).data), canon(data))
  assert.equal(canon(merge3(base, data, data).data), canon(data))
  assert.equal(canon(merge3(remote, data, remote).data), canon(data))
}

// 2) los borrados viajan: borrar una comida en un móvil no la resucita el otro
{
  const remote = clone(base)
  remote.food['2026-11-10'] = remote.food['2026-11-10'].filter((f) => f.id !== 'f2')
  remote.favEx = ['A']
  const local = clone(base)
  local.sessions.push(S('s2', '2026-11-03'))
  const { data } = merge3(base, local, remote)
  assert.deepEqual(data.food['2026-11-10'].map((f) => f.id), ['f1'])
  assert.deepEqual(data.favEx, ['A'])
  assert.equal(data.sessions.length, 2)
}

// 3) borrado en un lado y editado en el otro: gana lo editado (no se pierden datos) y se avisa
{
  const local = clone(base)
  local.sessions = []
  const remote = clone(base)
  remote.sessions[0].notes = { [B]: 'buen día' }
  const { data, conflicts } = merge3(base, local, remote)
  assert.equal(data.sessions.length, 1)
  assert.equal(data.sessions[0].notes[B], 'buen día')
  assert.equal(conflicts.length, 1)
}

// 4) el mismo dato cambiado en los dos: gana este móvil y queda anotado
{
  const local = clone(base)
  local.goals.kcal = 2000
  const remote = clone(base)
  remote.goals.kcal = 2500
  const { data, conflicts } = merge3(base, local, remote)
  assert.equal(data.goals.kcal, 2000)
  assert.deepEqual(conflicts, ['goals.kcal'])
}

// 5) favoritos: se suman los de cada lado
{
  const local = clone(base)
  local.favEx = ['A', 'B', 'C']
  const remote = clone(base)
  remote.favEx = ['B', 'D']
  assert.deepEqual(merge3(base, local, remote).data.favEx, ['B', 'C', 'D'])
}

// 6) sin base (primera vez tras actualizar): se junta todo sin borrar nada
{
  const local = clone(base)
  local.sessions.push(S('s2', '2026-11-03'))
  const remote = clone(base)
  remote.sessions.push(S('s3', '2026-11-04'))
  remote.body.weight.push({ date: '2026-11-09', kg: 79 })
  const { data } = merge3(null, local, remote)
  assert.deepEqual(data.sessions.map((s) => s.id), ['s1', 's2', 's3'])
  assert.equal(data.body.weight.length, 2)
}

// 7) Postgres reordena claves: mismo contenido = sin cambios
{
  const rev = (v) => (Array.isArray(v) ? v.map(rev) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, rev(v[k])])) : v)
  const reordered = rev(base)
  const { data, conflicts } = merge3(base, base, reordered)
  assert.deepEqual(conflicts, [])
  assert.equal(canon(data), canon(base))
}

// 8) series de un entreno (lista sin id): se tratan como un todo, nunca se mezclan a medias
{
  const local = clone(base)
  local.sessions[0].entries[B] = [{ w: '62,5', r: '8', drops: [] }]
  const remote = clone(base)
  remote.sessions[0].entries[B] = [{ w: '60', r: '9', drops: [] }]
  const { data, conflicts } = merge3(base, local, remote)
  assert.deepEqual(data.sessions[0].entries[B], local.sessions[0].entries[B])
  assert.equal(conflicts.length, 1)
}
console.log('sync ok')
