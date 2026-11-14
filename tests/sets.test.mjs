// series de calentamiento (warm): no cuentan en 1RM, volumen, sugerencias ni peso de referencia
import assert from 'node:assert/strict'
import { exStats, prefillSets, suggestion, setTxt, workSets } from '../src/store.js'
import { sessionVol } from '../src/stats.js'

const B = 'Barbell_Bench_Press_-_Medium_Grip'
const ses = [
  { id: 'a', date: '2026-11-01', entries: { [B]: [{ w: '40', r: '10', warm: true, drops: [] }, { w: '80', r: '8', drops: [] }, { w: '80', r: '8', drops: [] }] } },
]
{
  const st = exStats(ses, B)
  assert.equal(st.length, 1)
  assert.equal(st[0].best.w, 80)
  assert.equal(st[0].vol, 80 * 16) // el calentamiento no suma
  assert.equal(sessionVol(ses[0]), 1280)
  assert.equal(workSets(ses[0].entries[B]).length, 2)
}
// peso de referencia: de las series de trabajo, y las reps siempre vacías
{
  const p = prefillSets(ses, B, 3, false)
  assert.deepEqual(p.map((s) => s.w), ['80', '80', '80'])
  assert.deepEqual(p.map((s) => s.r), ['', '', ''])
  assert.equal(p[0].pw, '80')
}
// sugerencia: 8 reps en todas con objetivo 6-8 → subir desde 80, no desde 40
{
  const s = suggestion(ses, B, '6-8', 2, 'Barra')
  assert.equal(s.action, 'up')
  assert.equal(s.from, 80)
}
assert.equal(setTxt({ w: '40', r: '10', warm: true }), 'c·40×10')
assert.equal(setTxt({ w: '80', r: '8' }), '80×8')
// una sesión solo con calentamiento no da récord ni estadística
assert.equal(exStats([{ date: '2026-11-02', entries: { [B]: [{ w: '100', r: '1', warm: true, drops: [] }] } }], B).length, 0)
console.log('sets ok')
