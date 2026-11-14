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
import { sleepAnalysis, hm, nightsOf } from '../src/stats.js'
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
  // M430: todo como profundo, ligero/REM a 0, puntuación 0 e interrupciones cortas + largas
  const m = parseNights([{ date: '2026-11-09', sleep_start_time: '2026-11-08T23:41:00+01:00', sleep_end_time: '2026-11-09T06:19:00+01:00', deep_sleep: 22500, light_sleep: 0, rem_sleep: 0, sleep_score: 0, total_interruption_duration: 0, short_interruption_duration: 900, long_interruption_duration: 480, continuity: 2.6 }])['2026-11-09']
  assert.equal(m.deep, undefined)
  assert.equal(m.score, undefined)
  assert.equal(m.interr, 23)
  assert.equal(m.total, 375)
  assert.equal(m.cont, 2.6)
  const now = new Date('2026-11-11T10:00')
  const nights = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    nights[k] = { start: i % 2 ? '02:00' : '23:00', end: '07:00', total: i < 3 ? 330 : 400, interr: 40 }
  }
  const a = sleepAnalysis(nights, null, now)
  assert.equal(a.lastIsToday, true)
  assert.equal(a.avg, Math.round((480 * 4 + 300 * 3) / 7)) // tiempo de sueño = de dormirse a despertarse, como Polar
  assert.ok(a.tips.some((t) => t.startsWith('Duermes de media')))
  assert.ok(a.tips.some((t) => t.startsWith('3 noches de menos de 6 h')))
  assert.ok(a.tips.some((t) => t.includes('horas muy distintas')))
  assert.ok(a.tips.some((t) => t.includes('despierto por noche')))
  assert.equal(a.bed, '00:17') // media de 23:00 y 02:00 cruzando medianoche
  assert.equal(sleepAnalysis({}, null, now), null)
  // corrección: el reloj contó desde las 22:46 pero se durmió a las 02:30
  const fixed = nightsOf({ polar: { sleep: { '2026-11-12': { start: '22:46', end: '10:17', total: 626, interr: 66, deep: 626 } } }, sleepFix: { '2026-11-12': { start: '02:30', end: '10:17' } } })['2026-11-12']
  assert.equal(fixed.interr, Math.round(66 * 467 / 691))
  assert.equal(fixed.total, 467 - fixed.interr)
  assert.equal(fixed.deep, undefined)
  assert.equal(fixed.fixed, true)
  assert.equal(nightsOf({ polar: { sleep: { a: 1 } } }).a, 1) // sin correcciones, igual
  console.log('sleep ok')
}

// 2.0: periodos, consistencia, carga por músculo y lectura del progreso
import { periodStats, consistency, muscleLoad, progressRead } from '../src/stats.js'
import { groupsOf } from '../src/ranks.js'
import { exStats } from '../src/store.js'
{
  const B = 'Barbell_Bench_Press_-_Medium_Grip'
  const S2 = (date, w, r, extra = {}) => ({ date, min: 40, entries: { [B]: [{ w: String(w), r: String(r), drops: [] }, { w: String(w), r: String(r), drops: [] }] }, ...extra })
  const ses = [S2('2026-11-02', 60, 8), S2('2026-11-04', 60, 8), S2('2026-11-06', 60, 9), S2('2026-11-09', 62.5, 8)]
  const p = periodStats(ses, '2026-11-01', '2026-11-30')
  assert.deepEqual(p, { n: 4, days: 4, min: 160, vol: 4000, sets: 8 })
  assert.equal(periodStats(ses, '2026-11-05').n, 2)
  assert.deepEqual(consistency(ses, 4, new Date('2026-11-11T10:00')), { hit: 2, weeks: 4 })
  const load = muscleLoad(ses, '2026-11-01', groupsOf)
  assert.equal(load.Pecho.direct, 8)
  assert.equal(load.Pecho.freq, 4)
  assert.ok(load['Tríceps'].indirect === 8 && load['Tríceps'].eff === 4)
  // calentamiento no cuenta
  assert.equal(muscleLoad([{ date: '2026-11-02', entries: { [B]: [{ w: '40', r: '10', warm: true }] } }], '2026-11-01', groupsOf).Pecho, undefined)
  // lectura: más peso con reps comparables
  assert.equal(progressRead(exStats(ses, B)).kind, 'weight')
  assert.equal(progressRead(exStats(ses.slice(0, 3), B)).kind, 'reps')
  assert.equal(progressRead(exStats(ses.slice(0, 2), B)).kind, 'few')
  assert.equal(progressRead(exStats([S2('2026-11-02', 60, 8), S2('2026-11-04', 60, 8), S2('2026-11-06', 60, 8)], B)).kind, 'flat')
  assert.equal(progressRead(exStats([S2('2026-11-02', 60, 8), S2('2026-11-04', 60, 8), S2('2026-11-06', 55, 7)], B)).kind, 'down')
  console.log('stats 2.0 ok')
}

// entrenador IA: hechos exactos con periodo
import { coachFacts } from '../src/coach.js'
{
  const B = 'Barbell_Bench_Press_-_Medium_Grip'
  const S3 = (date, w) => ({ date, dayName: 'Pecho', min: 45, entries: { [B]: [{ w: String(w), r: '8', drops: [] }, { w: String(w), r: '8', drops: [] }] } })
  const now = new Date('2026-11-12T10:00') // jueves
  const facts = coachFacts({ sessions: [S3('2026-11-03', 60), S3('2026-11-05', 60), S3('2026-11-10', 62.5)], body: { weight: [{ date: '2026-11-08', kg: 80 }] } }, now)
  assert.equal(facts.esta_semana.desde, '2026-11-09')
  assert.equal(facts.esta_semana.entrenos, 1)
  assert.equal(facts.semana_pasada.entrenos, 2)
  assert.equal(facts.semana_pasada.hasta, '2026-11-08')
  assert.match(facts.esta_semana.series_por_musculo.Pecho, /^2 efectivas/)
  assert.equal(facts.esta_semana.sesiones[0].ejercicios[0], 'Press banca con barra 2 series (mejor 62.5×8)')
  assert.equal(facts.evolucion_por_ejercicio[0].sesiones, 3)
  assert.equal(facts.pesajes[0], '2026-11-08: 80 kg')
  console.log('coach facts ok')
}
