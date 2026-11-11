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

// recomendaciones en día de descanso
import { restDayTips } from '../src/coach.js'
{
  const base = { goals: { steps: 7000 }, plan: [], sessions: [] }
  const today = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` })()
  assert.match(restDayTips(base)[0], /Sal a andar/)
  assert.match(restDayTips(base)[1], /corre suave/)
  const some = { ...base, polar: { days: { [today]: { steps: 3000 } } } }
  assert.match(restDayTips(some)[0], /Te faltan 4\.000: unos 40 minutos/)
  const knee = { ...base, sessions: [{ checkin: { feel: 2, pain: { zone: 'Rodilla', level: 'leve' } } }] }
  assert.match(restDayTips(knee)[1], /mejor andar que correr/)
  const done = { ...base, polar: { days: { [today]: { steps: 9000 } } } }
  assert.equal(restDayTips(done).length, 1)
  console.log('rest tips ok')
}

// sueño: lectura de Polar y análisis
import { sleepAnalysis, hm } from '../src/stats.js'
import { parseNights } from '../src/polar.js'
{
  const p = parseNights({ nights: [
    { date: '2026-11-10', sleep_start_time: '2026-11-10T00:30:00+01:00', sleep_end_time: '2026-11-10T07:00:00+01:00', total_interruption_duration: 1800, sleep_score: 70, heart_rate_samples: { a: 1 } },
    { date: '2026-11-11', sleep_start_time: '2026-11-10T23:00:00+01:00', sleep_end_time: '2026-11-11T07:00:00+01:00', light_sleep: 14400, deep_sleep: 5400, rem_sleep: 6000, unrecognized_sleep_stage: 0, total_interruption_duration: 600 },
  ] })
  assert.deepEqual(p['2026-11-10'], { start: '00:30', end: '07:00', total: 360, interr: 30, score: 70 }) // sin fases: duración menos interrupciones
  assert.equal(p['2026-11-11'].total, 430) // con fases: suma de fases
  assert.equal(p['2026-11-11'].deep, 90)
  assert.equal(hm(430), '7 h 10 min')
  const now = new Date('2026-11-11T10:00')
  const nights = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    nights[k] = { start: i % 2 ? '02:00' : '23:00', end: '07:00', total: i < 3 ? 330 : 400, interr: 40 }
  }
  const a = sleepAnalysis(nights, null, now)
  assert.equal(a.lastIsToday, true)
  assert.equal(a.avg, Math.round((330 * 3 + 400 * 4) / 7))
  assert.ok(a.tips.some((t) => t.startsWith('Duermes de media')))
  assert.ok(a.tips.some((t) => t.startsWith('3 noches de menos de 6 h')))
  assert.ok(a.tips.some((t) => t.includes('horas muy distintas')))
  assert.ok(a.tips.some((t) => t.includes('despierto por noche')))
  assert.equal(a.bed, '00:17') // media de 23:00 y 02:00 cruzando medianoche
  assert.equal(sleepAnalysis({}, null, now), null)
  console.log('sleep ok')
}
