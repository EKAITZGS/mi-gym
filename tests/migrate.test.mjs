// migraciones del documento migym.v1 y fusión móvil/nube sin perder entrenos
import assert from 'node:assert/strict'
import { migrate, needsMigration, mergeData, validBackup, SCHEMA } from '../src/migrate.js'
import { DEFAULT } from '../src/store.js'

// copia real antigua (v1 mínima, como la guardaba la primera versión de la app)
const OLD = {
  v: 1,
  goals: { kcal: 2000, protein: 140 },
  plan: [{ id: 'd1', name: 'Pecho', weekday: 1, items: [{ id: 'i1', ex: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3, reps: '8-10', drop: false }] }],
  active: null,
  sessions: [{ id: 's1', date: '2026-10-01', dayId: 'd1', dayName: 'Pecho', entries: { 'Barbell_Bench_Press_-_Medium_Grip': [{ w: '60', r: '8', drops: [] }] } }],
  food: { '2026-10-01': [{ id: 'f1', meal: 'Comida', name: 'Pollo', grams: 150, kcal: 110, p: 23, c: 0, f: 1 }] },
}

{
  assert.equal(needsMigration(OLD), true)
  const m = migrate(OLD)
  assert.equal(m.v, SCHEMA)
  // nada se pierde ni cambia de id
  assert.deepEqual(m.plan, OLD.plan)
  assert.deepEqual(m.sessions, OLD.sessions)
  assert.deepEqual(m.food, OLD.food)
  assert.equal(m.goals.kcal, 2000)
  assert.equal(m.goals.protein, 140)
  // campos nuevos existen (aditivo)
  assert.ok(Array.isArray(m.myFoods) && Array.isArray(m.myExercises))
  // idempotente
  assert.deepEqual(migrate(m), m)
  assert.equal(needsMigration(m), false)
}

// documento roto a medias (sin plan, sessions null): no explota y queda usable
{
  const m = migrate({ v: 1, sessions: null, goals: null, plan: undefined })
  assert.deepEqual(m.sessions, [])
  assert.deepEqual(m.plan, DEFAULT.plan)
  assert.equal(m.goals.kcal, DEFAULT.goals.kcal)
}

// versión futura: se respeta tal cual (no se "baja")
{
  const fut = { ...OLD, v: SCHEMA + 5, extra: { x: 1 } }
  const m = migrate(fut)
  assert.equal(m.v, SCHEMA + 5)
  assert.deepEqual(m.extra, { x: 1 })
}

// migrate(DEFAULT) es la base limpia versionada
assert.equal(migrate(DEFAULT).v, SCHEMA)
assert.equal(migrate(undefined).v, SCHEMA)

// validación de copias
assert.equal(validBackup(OLD), true)
assert.equal(validBackup({ plan: 'no' }), false)
assert.equal(validBackup({ plan: [], sessions: {} }), false)
assert.equal(validBackup(null), false)

// fusión: gana el móvil, pero el entreno que solo está en la nube se recupera; sin duplicados
{
  const local = { ...OLD, goals: { kcal: 2100, protein: 150 }, sessions: [...OLD.sessions, { id: 's2', date: '2026-10-03', entries: {} }] }
  const cloud = { ...OLD, goals: { kcal: 1900, protein: 130 }, sessions: [...OLD.sessions, { id: 's3', date: '2026-10-02', entries: {} }], myExercises: [{ id: 'c-abc', name: 'Mío', group: 'Pecho' }] }
  const { data, recovered } = mergeData(local, cloud)
  assert.equal(recovered, 1)
  assert.deepEqual(data.sessions.map((s) => s.id), ['s1', 's3', 's2']) // por fecha
  assert.equal(data.goals.kcal, 2100) // lo demás, del ganador
  assert.deepEqual(data.myExercises.map((x) => x.id), ['c-abc']) // ejercicio propio que referencian sus entrenos
  // volver a fusionar no duplica
  assert.equal(mergeData(data, cloud).recovered, 0)
  assert.equal(mergeData(data, cloud).data.sessions.length, 3)
}
// misma sesión en los dos lados: la del ganador manda
{
  const edited = { ...OLD.sessions[0], min: 55 }
  const { data, recovered } = mergeData({ ...OLD, sessions: [edited] }, OLD)
  assert.equal(recovered, 0)
  assert.equal(data.sessions[0].min, 55)
}
console.log('migrate ok')
