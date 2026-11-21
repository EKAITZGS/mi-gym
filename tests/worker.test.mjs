// Worker: la ruta de diagnóstico /polar/check solo lee (GET) y abre una transacción (POST) sin commit ni DELETE
import assert from 'node:assert/strict'
import worker from '../cloudflare/worker.js'

const API = 'https://www.polaraccesslink.com/v3'
const calls = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url, opt = {}) => {
  const m = (opt.method || 'GET').toUpperCase()
  calls.push(`${m} ${url}`)
  const H = { 'Content-Type': 'application/json', 'RateLimit-Usage': '3, 10', 'RateLimit-Limit': '500, 5000' }
  const ok = (b, s = 200) => new Response(b == null ? null : JSON.stringify(b), { status: s, headers: H })
  if (m === 'GET' && url === API + '/exercises') return ok([{ id: 'a1', start_time: '2026-11-16T17:49:00', upload_time: '2026-11-16T18:30:00Z', sport: 'STRENGTH_TRAINING', duration: 'PT45M' }])
  if (m === 'GET' && url === API + '/users/123') return ok({ 'member-id': 'migym-123', 'registration-date': '2026-10-01T10:00:00Z' })
  if (m === 'POST' && url === API + '/users/123/exercise-transactions') return ok({ 'transaction-id': 77, 'resource-uri': API + '/users/123/exercise-transactions/77' }, 201)
  if (m === 'GET' && url === API + '/users/123/exercise-transactions/77') return ok({ exercises: [API + '/users/123/exercise-transactions/77/exercises/9', 'https://evil.example.com/x'] })
  if (m === 'GET' && url === API + '/users/123/exercise-transactions/77/exercises/9') return ok({ id: 9, 'start-time': '2026-11-18T18:06:00', 'upload-time': '2026-11-18T19:00:00Z', sport: 'OTHER' })
  return ok({ error: 'inesperado' }, 500)
}
const req = (path, auth = 'Bearer tok') => new Request('https://mi-gym-polar.example.workers.dev' + path, { headers: auth ? { Authorization: auth } : {} })

{
  const r = await worker.fetch(req('/polar/check?user=123'), {})
  assert.equal(r.status, 200)
  const j = await r.json()
  assert.equal(j.exercises.count, 1)
  assert.equal(j.exercises.list[0].upload_time, '2026-11-16T18:30:00Z')
  assert.equal(j.user.registered, true)
  assert.equal(j.user['registration-date'], '2026-10-01T10:00:00Z')
  assert.equal(j.transaction.status, 201)
  assert.equal(j.transaction.meaning, 'hay entrenos pendientes')
  assert.equal(j.transaction.count, 1) // la URL de otro dominio se descarta
  assert.equal(j.transaction.exercises[0]['start_time'], '2026-11-18T18:06:00')
  assert.equal(j.exercises.rateLimit['ratelimit-usage'], '3, 10')
  // nunca commit (PUT) ni baja (DELETE), y nada fuera de la API de Polar
  assert.ok(calls.every((c) => /^(GET|POST) https:\/\/www\.polaraccesslink\.com\/v3\//.test(c)), calls.join('\n'))
  assert.equal(calls.filter((c) => c.startsWith('POST')).length, 1)
}
// sin token o con usuario raro: no llama a Polar
calls.length = 0
assert.equal((await worker.fetch(req('/polar/check?user=123', ''), {})).status, 401)
assert.equal((await worker.fetch(req('/polar/check?user=12a'), {})).status, 400)
assert.equal(calls.length, 0)
globalThis.fetch = realFetch
console.log('worker ok')
