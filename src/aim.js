import { dayTotals, fmtDate } from './store'
import { RANK_GROUPS, groupsOf } from './ranks'
import { sleepAnalysis, nightsOf, stalled, recentPRs } from './stats'
import { macroPlan, aimOf } from './energy'

// Entrenador de objetivo. Usa el mismo objetivo que Dieta (goals.aim: lose = definir, keep = recomposición, gain = ganar músculo).
// Todo sale de tus datos: peso y cintura, lo que comes, series por músculo, fuerza y sueño.
export const AIMS = [
  { id: 'lose', label: 'Definir', hint: 'Perder grasa manteniendo el músculo' },
  { id: 'keep', label: 'Recomposición', hint: 'Perder grasa y ganar músculo a la vez, sin cambiar mucho de peso' },
  { id: 'gain', label: 'Ganar músculo', hint: 'Subir de peso poco a poco con el mínimo de grasa' },
]
// ritmo de peso semanal (% del peso), proteína (g/kg) y ajuste sobre el mantenimiento (kcal/día)
const RULES = {
  lose: { lo: -1, hi: -0.5, delta: -500 },
  keep: { lo: -0.3, hi: 0.1, delta: 0 },
  gain: { lo: 0.25, hi: 0.5, delta: 300 },
}
const KCAL_PER_KG = 7700 // energía aproximada de 1 kg de peso corporal

const daysAgo = (now, n) => {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return fmtDate(d)
}
const dayNum = (s) => Math.round(new Date(s + 'T12:00').getTime() / 86400000)
// pendiente por regresión lineal (unidades por día); necesita al menos 2 puntos separados 10 días
function slope(points) {
  if (points.length < 2 || points[points.length - 1].x - points[0].x < 10) return null
  const n = points.length
  const mx = points.reduce((a, p) => a + p.x, 0) / n
  const my = points.reduce((a, p) => a + p.y, 0) / n
  const den = points.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  return den ? points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den : null
}
const r50 = (v) => Math.round(v / 50) * 50
export const fmt1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',')

export function aimPlan(data, aim = aimOf(data), now = new Date()) {
  const R = RULES[aim] || RULES.lose
  const label = (AIMS.find((a) => a.id === aim) || AIMS[0]).label.toLowerCase()
  const from28 = daysAgo(now, 28)
  const allW = data.body?.weight || []
  const weights = allW.filter((w) => w.date >= daysAgo(now, 35) && w.kg > 0)
  const kg = allW.length ? allW.slice(-3).reduce((a, w) => a + Number(w.kg), 0) / Math.min(3, allW.length) : null
  const wSlope = slope(weights.map((w) => ({ x: dayNum(w.date), y: Number(w.kg) })))
  const rate = wSlope != null ? wSlope * 7 : null // kg por semana
  const ratePct = rate != null && kg ? (rate / kg) * 100 : null
  const waist = (data.body?.waist || []).filter((w) => w.date >= from28)
  const waistDelta = waist.length >= 2 ? waist[waist.length - 1].cm - waist[0].cm : null

  // comida: media de los días apuntados en las 2 últimas semanas (sin contar hoy ni días a medio apuntar)
  const logged = Object.entries(data.food || {}).filter(([d, e]) => d >= daysAgo(now, 14) && d < fmtDate(now) && e.length)
  const tot = logged.map(([, e]) => dayTotals(e)).filter((t) => t.kcal > 600)
  const kcalAvg = tot.length ? Math.round(tot.reduce((a, t) => a + t.kcal, 0) / tot.length) : null
  const protAvg = tot.length ? Math.round(tot.reduce((a, t) => a + t.p, 0) / tot.length) : null

  // mantenimiento real = lo que comes - lo que cambia tu peso (balance de energía)
  const maint = kcalAvg && rate != null && tot.length >= 5 ? r50(kcalAvg - (rate * KCAL_PER_KG) / 7) : null
  const target = {
    kcal: maint ? r50(maint + R.delta) : null,
    protein: kg ? macroPlan(data, aim, data.goals?.kcal || 2000).protein : null,
    lo: kg ? (kg * R.lo) / 100 : null,
    hi: kg ? (kg * R.hi) / 100 : null,
  }

  const items = []
  // act: qué hacer en pocas palabras (avisos); short: etiqueta corta (lo que va bien)
  const add = (tone, title, text, extra = {}) => items.push({ tone, title, text, ...extra })

  // 1. ritmo de peso
  if (rate == null) add('info', 'Ritmo de peso', 'Pésate 1 vez por semana, mismo día y en ayunas. Con 2-3 semanas de datos te digo si vas al ritmo correcto.')
  else {
    const txt = `${rate >= 0 ? '+' : ''}${fmt1(rate)} kg/semana (${rate >= 0 ? '+' : ''}${fmt1(ratePct)} %)`
    const range = `objetivo: ${fmt1(target.lo)} a ${fmt1(target.hi)} kg/semana`
    if (ratePct < R.lo) {
      if (aim === 'gain') add('yellow', `No estás subiendo: ${txt}`, `Sin superávit no se gana músculo. Añade unas 150-200 kcal al día (${range}).`, { act: '+150-200 kcal/día' })
      else if (aim === 'keep') add('yellow', `Bajas de peso: ${txt}`, `Para recomposición el peso debe quedarse casi igual. Sube unas 100-200 kcal al día (${range}).`, { act: '+100-200 kcal/día' })
      else add('yellow', `Bajas muy rápido: ${txt}`, `Corres el riesgo de perder músculo y fuerza. Sube unas 150-200 kcal al día (${range}).`, { act: '+150-200 kcal/día' })
    }
    else if (ratePct > R.hi) {
      if (aim === 'gain') add('yellow', `Subes demasiado rápido: ${txt}`, `Por encima del 0,5 % semanal casi todo es grasa. Quita unas 150 kcal al día (${range}).`, { act: '−150 kcal/día' })
      else add('yellow', `No estás bajando: ${txt}`, `Quita unas 150-200 kcal al día o suma 2.000-3.000 pasos diarios (${range}).`, { act: '−150 kcal o +2.000 pasos' })
    } else add('green', `Ritmo ideal: ${txt}`, `Estás dentro del rango para ${label} (${range}). Mantén lo que haces.`, { short: 'Ritmo de peso' })
  }
  // 2. cintura
  if (waistDelta != null) {
    if (waistDelta < -0.4) add('green', `Cintura: ${fmt1(waistDelta)} cm en 4 semanas`, aim === 'gain' ? 'Ganas peso sin acumular grasa en la cintura: perfecto.' : 'Estás perdiendo grasa.', { short: `Cintura ${fmt1(waistDelta)} cm` })
    else if (waistDelta > 2 && aim === 'gain') add('yellow', `Cintura: +${fmt1(waistDelta)} cm en 4 semanas`, 'Demasiada grasa para un volumen limpio: baja un poco las calorías.', { act: 'Baja algo las kcal' })
    else if (waistDelta > 1 && aim !== 'gain') add('yellow', `Cintura: +${fmt1(waistDelta)} cm en 4 semanas`, 'Estás ganando grasa: revisa las calorías de los fines de semana y el alcohol.', { act: 'Revisa finde y alcohol' })
  }
  // 3. calorías apuntadas frente al objetivo
  if (kcalAvg && data.goals?.kcal) {
    const diff = kcalAvg - data.goals.kcal
    if (diff > data.goals.kcal * 0.1) add('yellow', `Comes de media ${kcalAvg} kcal`, `Son unas ${diff} kcal más que tu objetivo de ${data.goals.kcal}. Mira qué se te va: picoteo, bebidas, salsas.`, { act: 'Mira picoteo y bebidas' })
    else if (aim === 'lose' && diff < -data.goals.kcal * 0.2) add('yellow', `Comes de media ${kcalAvg} kcal`, 'Muy por debajo de tu objetivo: un déficit tan grande te quita músculo y energía para entrenar.', { act: 'Come algo más' })
    else add('green', `Comes de media ${kcalAvg} kcal`, `Cerca de tu objetivo (${data.goals.kcal}). La constancia es lo que más importa.`, { short: `${kcalAvg} kcal` })
  } else add('info', 'Calorías', 'Apunta lo que comes al menos 5 días para que pueda calcular tu gasto real y ajustarte las calorías.')
  // 4. proteína
  if (protAvg && target.protein) {
    if (protAvg < target.protein * 0.85)
      add('yellow', `Proteína: ${protAvg} de ${target.protein} g`, `Para ${label} te tocan unos ${target.protein} g (${macroPlan(data, aim, data.goals?.kcal || 2000).perKg} g por kg). Añade una fuente en cada comida: huevos, pollo, atún, yogur griego, queso fresco batido.`, { act: `Te faltan ~${target.protein - protAvg} g/día` })
    else add('green', `Proteína: ${protAvg} g de media`, `Bien: tu objetivo son unos ${target.protein} g al día.`, { short: 'Proteína' })
  }
  // 5. entreno: series por músculo en los últimos 7 días
  const week = data.sessions.filter((s) => s.date >= daysAgo(now, 6))
  if (week.length) {
    const sets = Object.fromEntries(RANK_GROUPS.map((g) => [g, 0]))
    for (const s of week)
      for (const [id, ss] of Object.entries(s.entries || {})) for (const { g, main } of groupsOf(id)) sets[g] += main ? ss.length : ss.length / 2
    const low = RANK_GROUPS.filter((g) => g !== 'Antebrazo' && sets[g] < 10)
    if (low.length)
      add('yellow', `Pocas series: ${low.join(', ')}`, `Para ${aim === 'lose' ? 'no perder músculo' : 'ganar músculo'} apunta a ${aim === 'gain' ? 12 : 10}-20 series por músculo y semana.`, { act: `${aim === 'gain' ? 12 : 10}-20 series/semana` })
    else add('green', 'Volumen de entreno', 'Todos los músculos con 10 series o más esta semana.', { short: 'Series' })
  } else add('info', 'Entreno', 'Esta semana aún no has entrenado. Sin pesas no hay músculo que mantener ni que ganar.')
  if (aim === 'lose') add('info', 'Clave al definir', 'No bajes los pesos: entrena pesado (6-12 reps cerca del fallo) para que el cuerpo mantenga el músculo. La grasa se quita con la dieta y los pasos, no con más series.')
  if (aim === 'gain') add('info', 'Clave al ganar músculo', 'Sube peso o repeticiones cada semana (sobrecarga progresiva). Si en 2-3 semanas no subes ni fuerza ni peso, come un poco más.')
  if (aim === 'keep') add('info', 'Clave en recomposición', 'Funciona mejor si llevas poco entrenando o vuelves de un parón. Juzga por cintura, fotos y fuerza, no por la báscula.')
  // 6. fuerza
  const prs = recentPRs(data.sessions, 28, now).length
  const stuck = stalled(data.sessions, now).length
  if (prs && !stuck) add('green', `${prs} ${prs === 1 ? 'récord' : 'récords'} en 4 semanas`, aim === 'lose' ? 'Ganar fuerza mientras defines es la mejor señal de que mantienes el músculo.' : 'Estás progresando.', { short: `${prs} ${prs === 1 ? 'récord' : 'récords'}` })
  else if (stuck) add('yellow', `${stuck} ${stuck === 1 ? 'ejercicio estancado' : 'ejercicios estancados'}`, aim === 'lose' ? 'Normal en déficit si no pierdes fuerza. Si bajas mucho, el déficit es muy grande o duermes poco.' : 'Revisa calorías y sueño, o cambia el rango de repeticiones.', { act: 'Revisa kcal y sueño' })
  // 7. sueño
  const sl = sleepAnalysis(nightsOf(data), data.polar?.recharge, now)
  if (sl?.avg && sl.avg < 420) add('yellow', `Duermes ${Math.floor(sl.avg / 60)} h ${sl.avg % 60} min de media`, 'Con menos de 7 h se pierde más músculo al definir y se gana menos al subir.', { act: 'Apunta a 7 h o más' })

  return { aim, kg, rate, ratePct, waistDelta, kcalAvg, protAvg, logDays: tot.length, maint, target, items, ok: !items.some((i) => i.tone === 'yellow') }
}

// Control semanal: cuándo toca pesarse, medir la cintura y hacer fotos (frontal y lateral)
export function checkStatus(data, photos = [], now = new Date()) {
  const lastOf = (list) => (list.length ? list[list.length - 1].date : null)
  const ago = (d) => (d ? Math.round((dayNum(fmtDate(now)) - dayNum(d)) / 1) : null)
  const pose = (p) => photos.filter((x) => (x.pose || 'frontal') === p).map((x) => x.date).sort().pop() || null
  const row = (key, label, date, every) => ({ key, label, date, days: ago(date), due: date == null || ago(date) >= every })
  return [
    row('weight', 'Peso', lastOf(data.body?.weight || []), 7),
    row('waist', 'Cintura', lastOf(data.body?.waist || []), 7),
    row('front', 'Foto frontal', pose('frontal'), 14),
    row('side', 'Foto lateral', pose('lateral'), 14),
  ]
}
