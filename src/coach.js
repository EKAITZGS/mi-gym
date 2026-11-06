import { EXERCISES, EX_BY_ID } from './data/exercises'
import { getAi } from './ai'
import { uid, todayStr, addDays } from './store'

export const FEELINGS = [
  { id: 1, label: 'Muy fácil', emoji: '😴' },
  { id: 2, label: 'Bien', emoji: '🙂' },
  { id: 3, label: 'Duro', emoji: '😤' },
  { id: 4, label: 'Muy duro', emoji: '🥵' },
  { id: 5, label: 'Fatal', emoji: '😵' },
]

// Zona de molestia -> grupos y ejercicios concretos que la cargan
export const ZONES = [
  { id: 'Hombro', groups: ['Hombro', 'Pecho'] },
  { id: 'Codo', groups: ['Tríceps', 'Bíceps'] },
  { id: 'Muñeca', groups: ['Bíceps', 'Tríceps', 'Pecho'] },
  { id: 'Pecho', groups: ['Pecho'] },
  { id: 'Espalda baja', groups: [], ex: ['Barbell_Deadlift', 'Romanian_Deadlift', 'Bent_Over_Barbell_Row', 'Barbell_Squat', 'Hyperextensions_Back_Extensions', 'Good_Morning'] },
  { id: 'Espalda alta / cuello', groups: ['Espalda'], ex: ['Dumbbell_Shrug', 'Barbell_Shrug'] },
  { id: 'Rodilla', groups: ['Pierna'] },
  { id: 'Otra', groups: [] },
]

const zoneHits = (zone, exId) => {
  const z = ZONES.find((x) => x.id === zone)
  const ex = EX_BY_ID[exId]
  if (!z || !ex) return false
  return z.groups.includes(ex.group) || (z.ex || []).includes(exId)
}

// Molestias de los últimos 14 días
export function recentPains(sessions) {
  const since = addDays(todayStr(), -14)
  const out = []
  for (const s of sessions) {
    const p = s.checkin?.pain
    if (s.date >= since && p?.zone) out.push({ ...p, date: s.date })
  }
  return out
}

export function painFor(sessions, exId) {
  return recentPains(sessions).filter((p) => zoneHits(p.zone, exId)).pop() || null
}

// Dos últimos entrenos con check-in muy duros => descarga
export function needsDeload(sessions) {
  const ck = sessions.filter((s) => s.checkin?.feel).slice(-3)
  const hard = ck.filter((s) => s.checkin.feel >= 4).length
  return ck.length >= 2 && hard >= 2
}

// Consejo justo después del check-in
export function adviceFor(checkin, sessions) {
  const tips = []
  const p = checkin.pain
  if (p?.zone) {
    if (p.level === 'fuerte')
      tips.push({
        tone: 'red',
        text: `Molestia fuerte en ${p.zone.toLowerCase()}: no entrenes esa zona hasta que no duela. Si sigue en 2-3 días, se hincha o pierdes fuerza, que te lo mire un fisio o un médico.`,
      })
    else
      tips.push({
        tone: 'yellow',
        text: `Molestia leve en ${p.zone.toLowerCase()}: la próxima vez baja el peso en los ejercicios que la cargan (te los marcaré) y no llegues al fallo.`,
      })
  }
  if (checkin.feel === 1) tips.push({ tone: 'green', text: 'Te ha resultado fácil: la próxima vez sube un poco el peso o haz 1-2 repeticiones más.' })
  if (checkin.feel === 2) tips.push({ tone: 'green', text: 'Buen entreno. Sigue así y sube peso cuando completes todas las repeticiones.' })
  if (checkin.feel === 3) tips.push({ tone: 'green', text: 'Duro pero bien. Mantén los pesos la próxima vez hasta que te cueste menos.' })
  if (checkin.feel >= 4) {
    const all = [...sessions.slice(0, -1), { checkin }]
    if (needsDeload(all))
      tips.push({
        tone: 'yellow',
        text: 'Llevas varios entrenos muy duros seguidos. Haz una semana de descarga: mismos ejercicios con un 30% menos de peso y sin fallo. Recuperarás y volverás más fuerte.',
      })
    else tips.push({ tone: 'yellow', text: 'Ha sido muy duro. Duerme bien, come proteína y no subas pesos el próximo entreno.' })
  }
  return tips
}

/* ---------------- Entrenador IA ---------------- */

function summarize(data) {
  const plan = data.plan.map((d) => ({
    nombre: d.name,
    dia: d.weekday,
    ejercicios: d.items.map((i) => `${EX_BY_ID[i.ex]?.name || i.ex} ${i.sets}x${i.reps}`),
  }))
  const last = data.sessions.slice(-10).map((s) => ({
    fecha: s.date,
    dia: s.dayName,
    sensacion: s.checkin?.feel ? FEELINGS.find((f) => f.id === s.checkin.feel)?.label : undefined,
    molestia: s.checkin?.pain?.zone ? `${s.checkin.pain.zone} (${s.checkin.pain.level})` : undefined,
    nota: s.checkin?.note || undefined,
    ejercicios: Object.keys(s.entries || {}).length,
  }))
  return { plan, last }
}

export async function improvePlan(data, { days, focus, notes }) {
  const { key, model } = getAi()
  if (!key) throw new Error('NO_KEY')
  const catalog = EXERCISES.map((e) => `${e.id}|${e.name}|${e.group}`).join('\n')
  const { plan, last } = summarize(data)
  const prompt = `Eres un entrenador personal. Mejora la rutina de gimnasio de este usuario.
Objetivo: perder grasa y ganar músculo. Días por semana que quiere: ${days}. Enfoque: ${focus || 'equilibrado'}.
Notas del usuario: ${notes || 'ninguna'}.
Rutina actual (dia: 0=domingo,1=lunes...6=sábado): ${JSON.stringify(plan)}
Últimos entrenos con sensaciones y molestias: ${JSON.stringify(last)}

Reglas:
- Respeta lo que ya hace y le funciona; cambia solo lo necesario. Si añades días, mantén los suyos y añade los nuevos con sentido (no entrenar el mismo grupo dos días seguidos).
- Si hay molestias recientes, evita o sustituye ejercicios que carguen esa zona y dilo.
- Si las sensaciones son muy duras, reduce volumen. Cada grupo muscular, 10-16 series por semana aprox.
- 4-6 ejercicios por día, 2-4 series, reps como "8-10" o "12".
- Usa SOLO ids de este catálogo (id|nombre|grupo):
${catalog}

Responde SOLO con JSON:
{"resumen":"2-3 frases de qué cambias y por qué","consejos":["consejo corto",...],"plan":[{"nombre":"...","dia":1,"ejercicios":[{"id":"...","series":3,"reps":"8-10"}]}]}`
  let res
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_completion_tokens: 2500,
      }),
    })
  } catch {
    throw new Error('No se pudo conectar con Groq (¿sin conexión?)')
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('La clave de Groq no es válida')
    if (res.status === 429) throw new Error('Has llegado al límite de Groq. Prueba más tarde')
    throw new Error(`Error de Groq (${res.status})`)
  }
  const j = await res.json()
  let txt = (j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '')
  let o
  try {
    o = JSON.parse(txt)
  } catch {
    try {
      o = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] || '')
    } catch {
      throw new Error('No entendí la respuesta de la IA, inténtalo otra vez')
    }
  }
  const used = new Set()
  const newPlan = (o.plan || [])
    .map((d) => {
      const w = Number.isInteger(d.dia) && d.dia >= 0 && d.dia <= 6 ? d.dia : null
      if (w != null && used.has(w)) return null
      if (w != null) used.add(w)
      const items = (d.ejercicios || [])
        .filter((e) => EX_BY_ID[e.id])
        .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
        .slice(0, 8)
        .map((e) => ({
          id: uid(),
          ex: e.id,
          sets: Math.max(1, Math.min(6, Number(e.series) || 3)),
          reps: String(e.reps || '10').slice(0, 12),
          drop: false,
        }))
      return items.length ? { id: uid(), name: String(d.nombre || 'Día').slice(0, 40), weekday: w, items } : null
    })
    .filter(Boolean)
  if (!newPlan.length) throw new Error('La IA no devolvió una rutina válida, inténtalo otra vez')
  return {
    resumen: String(o.resumen || ''),
    consejos: (o.consejos || []).map(String).slice(0, 6),
    plan: newPlan,
  }
}

/* ---------------- Revisión semanal ---------------- */

// Alternativas que suelen cargar menos cada zona (de -> a)
const SWAPS = {
  Hombro: {
    'Barbell_Bench_Press_-_Medium_Grip': 'Dumbbell_Bench_Press',
    'Barbell_Incline_Bench_Press_-_Medium_Grip': 'Leverage_Incline_Chest_Press',
    Incline_Dumbbell_Press: 'Leverage_Incline_Chest_Press',
    Barbell_Shoulder_Press: 'Machine_Shoulder_Military_Press',
    Dumbbell_Shoulder_Press: 'Machine_Shoulder_Military_Press',
    'Dips_-_Chest_Version': 'Cable_Crossover',
    'Dips_-_Triceps_Version': 'Triceps_Pushdown',
    Bench_Dips: 'Triceps_Pushdown',
    Dumbbell_Flyes: 'Butterfly',
    Front_Dumbbell_Raise: 'Face_Pull',
  },
  Pecho: {
    'Barbell_Bench_Press_-_Medium_Grip': 'Leverage_Chest_Press',
    'Barbell_Incline_Bench_Press_-_Medium_Grip': 'Leverage_Incline_Chest_Press',
    'Dips_-_Chest_Version': 'Butterfly',
    Dumbbell_Flyes: 'Butterfly',
    Pushups: 'Leverage_Chest_Press',
  },
  Codo: {
    Lying_Triceps_Press: 'Triceps_Pushdown_-_Rope_Attachment',
    'Close-Grip_Barbell_Bench_Press': 'Triceps_Pushdown',
    Standing_Dumbbell_Triceps_Extension: 'Triceps_Pushdown_-_Rope_Attachment',
    Cable_Rope_Overhead_Triceps_Extension: 'Triceps_Pushdown_-_Rope_Attachment',
    'Dips_-_Triceps_Version': 'Triceps_Pushdown',
    Bench_Dips: 'Triceps_Pushdown',
    Barbell_Curl: 'Hammer_Curls',
    'EZ-Bar_Curl': 'Hammer_Curls',
    Preacher_Curl: 'Hammer_Curls',
  },
  Muñeca: {
    Barbell_Curl: 'Hammer_Curls',
    'EZ-Bar_Curl': 'Standing_Biceps_Cable_Curl',
    'Barbell_Bench_Press_-_Medium_Grip': 'Leverage_Chest_Press',
    Lying_Triceps_Press: 'Triceps_Pushdown_-_Rope_Attachment',
    Pushups: 'Leverage_Chest_Press',
  },
  'Espalda baja': {
    Barbell_Deadlift: 'Seated_Cable_Rows',
    Romanian_Deadlift: 'Lying_Leg_Curls',
    Bent_Over_Barbell_Row: 'Seated_Cable_Rows',
    Barbell_Squat: 'Leg_Press',
    Good_Morning: 'Lying_Leg_Curls',
    Hyperextensions_Back_Extensions: 'Plank',
  },
  'Espalda alta / cuello': {
    Barbell_Shrug: 'Face_Pull',
    Dumbbell_Shrug: 'Face_Pull',
    Bent_Over_Barbell_Row: 'Seated_Cable_Rows',
  },
  Rodilla: {
    Barbell_Squat: 'Barbell_Hip_Thrust',
    Hack_Squat: 'Barbell_Hip_Thrust',
    Dumbbell_Lunges: 'Barbell_Hip_Thrust',
    Goblet_Squat: 'Barbell_Hip_Thrust',
    Leg_Extensions: 'Seated_Leg_Curl',
  },
}

export const weekStart = () => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const propKey = (p) => `${weekStart()}|${p.type}|${p.dayId}|${p.itemId}|${p.to ?? p.delta}`

export function weeklyReview(data) {
  const since = addDays(todayStr(), -7)
  const week = data.sessions.filter((s) => s.date >= since && s.checkin)
  if (!week.length) return null
  const findings = []
  const props = []
  const pains = week.filter((s) => s.checkin.pain?.zone)
  for (const s of pains) findings.push(`${s.dayName}: molestia ${s.checkin.pain.level} en ${s.checkin.pain.zone.toLowerCase()}`)
  const avg = week.reduce((n, s) => n + (s.checkin.feel || 0), 0) / week.length
  const hard = week.filter((s) => s.checkin.feel >= 4).length
  if (hard >= 2) findings.push(`${hard} de ${week.length} entrenos fueron muy duros`)

  const zones = {}
  for (const s of pains) {
    const z = s.checkin.pain
    if (!zones[z.zone] || z.level === 'fuerte') zones[z.zone] = z.level
  }
  for (const [zone, level] of Object.entries(zones)) {
    const map = SWAPS[zone] || {}
    for (const d of data.plan) {
      for (const it of d.items) {
        const to = map[it.ex]
        if (to && EX_BY_ID[to] && !d.items.some((x) => x.ex === to)) {
          props.push({
            type: 'swap', dayId: d.id, dayName: d.name, itemId: it.id, from: it.ex, to,
            motivo: `Molestia ${level} en ${zone.toLowerCase()}: ${EX_BY_ID[to].name.toLowerCase()} suele cargarla menos.`,
          })
        } else if (!to && level === 'fuerte' && zoneHits(zone, it.ex) && it.sets > 2) {
          props.push({
            type: 'sets', dayId: d.id, dayName: d.name, itemId: it.id, from: it.ex, delta: -1,
            motivo: `Molestia fuerte en ${zone.toLowerCase()}: bajar a ${it.sets - 1} series mientras se recupera.`,
          })
        }
      }
    }
  }
  if (hard >= 2) {
    for (const d of data.plan) {
      const big = d.items.filter((i) => i.sets >= 4)
      for (const it of big)
        props.push({
          type: 'sets', dayId: d.id, dayName: d.name, itemId: it.id, from: it.ex, delta: -1,
          motivo: 'Semana muy dura: una serie menos para recuperar mejor.',
        })
    }
  }
  const decided = data.reviews || {}
  const pending = props.map((p) => ({ ...p, key: propKey(p) })).filter((p) => !decided[p.key])
  return {
    findings,
    avg,
    count: week.length,
    pending,
    summary:
      !pains.length && hard < 2
        ? `Semana sin incidentes (${week.length} entrenos). Sigue así y ve subiendo pesos poco a poco.`
        : null,
  }
}

export function applyProposal(plan, p) {
  return plan.map((d) => {
    if (d.id !== p.dayId) return d
    return {
      ...d,
      items: d.items.map((i) => {
        if (i.id !== p.itemId) return i
        if (p.type === 'swap') return d.items.some((x) => x.ex === p.to) ? i : { ...i, ex: p.to }
        if (p.type === 'sets') return { ...i, sets: Math.max(1, i.sets + p.delta) }
        return i
      }),
    }
  })
}

export async function aiWeeklyReview(data) {
  const { key, model } = getAi()
  if (!key) throw new Error('NO_KEY')
  const since = addDays(todayStr(), -7)
  const week = data.sessions
    .filter((s) => s.date >= since)
    .map((s) => ({
      fecha: s.date,
      dia: s.dayName,
      sensacion: s.checkin?.feel ? FEELINGS.find((f) => f.id === s.checkin.feel)?.label : 'sin datos',
      molestia: s.checkin?.pain?.zone ? `${s.checkin.pain.zone} (${s.checkin.pain.level})` : 'ninguna',
      nota: s.checkin?.note || '',
      hecho: Object.entries(s.entries || {}).map(([id, sets]) => `${EX_BY_ID[id]?.name || id}: ${sets.map((x) => `${x.w || '?'}x${x.r || '?'}`).join(', ')}`),
    }))
  const plan = data.plan.map((d) => ({ dia: d.name, ejercicios: d.items.map((i) => `${i.ex} (${EX_BY_ID[i.ex]?.name}) ${i.sets}x${i.reps}`) }))
  const catalog = EXERCISES.map((e) => `${e.id}|${e.name}|${e.group}`).join('\n')
  const prompt = `Eres un entrenador personal. Revisa la semana de entrenamiento de este usuario (objetivo: perder grasa y ganar músculo).
Plan actual: ${JSON.stringify(plan)}
Entrenos de la última semana: ${JSON.stringify(week)}
Valora cómo ha ido y propone como mucho 4 cambios concretos y prudentes SOLO si hacen falta (molestias, fatiga, estancamiento). Si todo va bien, no propongas cambios.
Cada cambio: sustituir un ejercicio del plan por otro del catálogo, o cambiar el número de series.
Catálogo (id|nombre|grupo):
${catalog}
Responde SOLO con JSON: {"valoracion":"2-3 frases","propuestas":[{"dia":"nombre exacto del día del plan","ejercicio":"id actual","cambiar_por":"id nuevo o vacío","series":número o null,"motivo":"frase corta"}]}`
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.3, max_completion_tokens: 1500 }),
  }).catch(() => {
    throw new Error('No se pudo conectar con Groq (¿sin conexión?)')
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'La clave de Groq no es válida' : res.status === 429 ? 'Has llegado al límite de Groq. Prueba más tarde' : `Error de Groq (${res.status})`)
  const j = await res.json()
  const txt = (j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '')
  let o
  try {
    o = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] || txt)
  } catch {
    throw new Error('No entendí la respuesta de la IA, inténtalo otra vez')
  }
  const props = []
  for (const p of o.propuestas || []) {
    const d = data.plan.find((x) => x.name.toLowerCase() === String(p.dia || '').toLowerCase()) || data.plan.find((x) => x.items.some((i) => i.ex === p.ejercicio))
    const it = d?.items.find((i) => i.ex === p.ejercicio)
    if (!d || !it) continue
    if (p.cambiar_por && EX_BY_ID[p.cambiar_por] && p.cambiar_por !== it.ex && !d.items.some((x) => x.ex === p.cambiar_por))
      props.push({ type: 'swap', dayId: d.id, dayName: d.name, itemId: it.id, from: it.ex, to: p.cambiar_por, motivo: String(p.motivo || ''), ai: true })
    else if (Number.isInteger(p.series) && p.series > 0 && p.series !== it.sets && p.series <= 6)
      props.push({ type: 'sets', dayId: d.id, dayName: d.name, itemId: it.id, from: it.ex, delta: p.series - it.sets, motivo: String(p.motivo || ''), ai: true })
  }
  const decided = data.reviews || {}
  return {
    valoracion: String(o.valoracion || ''),
    props: props.map((p) => ({ ...p, key: propKey(p) })).filter((p) => !decided[p.key]),
  }
}
