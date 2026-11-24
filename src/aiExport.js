// Llevar tus entrenos a Claude o ChatGPT: texto listo para pegar (plan, cómo voy o último entreno) y lectura
// de su respuesta para aplicar la rutina que proponga (mismo formato que las propuestas del entrenador IA:
// se enseña qué cambia y el usuario decide). Puro (sin React ni red) para probarlo con npm test.
import { EXERCISES, EX_BY_ID } from './data/exercises'
import { WEEKDAYS, fmtDate, addDays, parseDate, num, fmtKg, workSets, dayTotals } from './store'
import { exHistory } from './progression'
import { progressRead, stalled, muscleLoad, nightsOf } from './stats'
import { groupsOf, bodyWeight } from './ranks'
import { FEELINGS } from './coach.js'
import { GOALS, MINUTES } from './plans'
import { levelOf, planForAi, catalogForAi, buildProposal } from './aiPlan'
import { sexOf } from './sex'

export const AX_KINDS = { plan: 'Un plan', progress: 'Cómo voy', last: 'Último entreno' }
const AIMS = { lose: 'definir (perder grasa)', keep: 'recomposición (mantener peso)', gain: 'ganar músculo' }
const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const exOf = (id, data) => EX_BY_ID[id] || (data.myExercises || []).find((x) => x.id === id)
const nameOf = (data) => (id) => exOf(id, data)?.name || id
const dayLbl = (s) => `${WD[parseDate(s).getDay()]} ${s.slice(8)}-${s.slice(5, 7)}`
const kg = (v) => (num(v) > 0 ? fmtKg(num(v)) : 'PC')
const r1 = (n) => fmtKg(Math.round(n * 10) / 10)
const restOf = (sec) => (sec >= 60 ? (sec % 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec / 60} min`) : `${sec} s`)

// Una serie en texto corto: 60×10, PC×12, 20×10/9 (izq/der), 40 kg × 45 s, 2 km · 12 min; drops detrás
function setLine(s) {
  let t
  if (s.km || s.min) t = `${s.km || '?'} km · ${s.min || '?'} min`
  else if (s.s) t = `${num(s.w) > 0 ? fmtKg(num(s.w)) + ' kg × ' : ''}${s.s} s`
  else if (s.m) t = `${num(s.w) > 0 ? fmtKg(num(s.w)) + ' kg × ' : ''}${s.m} m`
  else if (s.rl || s.rr) t = `${kg(s.w)}×${s.rl || '?'}/${s.rr || '?'}`
  else t = `${kg(s.w)}×${s.r || '?'}`
  const drops = (s.drops || []).filter((d) => num(d.r) > 0)
  return drops.length ? `${t} + drop ${drops.map((d) => `${kg(d.w)}×${d.r}`).join(' + ')}` : t
}

// Un entreno entero: cabecera (fecha, día, minutos, sensación, molestia) y una línea por ejercicio
function sessionBlock(s, data) {
  const nm = nameOf(data)
  const ck = s.checkin || {}
  const feel = FEELINGS.find((f) => f.id === ck.feel)?.label
  const head = [
    `### ${dayLbl(s.date)} · ${(s.dayName || 'Entreno libre').trim()}`,
    s.min ? `${s.min} min` : null,
    feel ? `sensación: ${feel.toLowerCase()}` : null,
    ck.sleep ? `durmió ${['', 'mal', 'normal', 'bien'][ck.sleep]}` : null,
    ck.pain?.zone ? `molestia: ${ck.pain.zone.toLowerCase()}${ck.pain.level ? ' ' + ck.pain.level : ''}` : null,
  ].filter(Boolean)
  const order = Array.isArray(s.order) ? [...s.order, ...Object.keys(s.entries || {}).filter((id) => !s.order.includes(id))] : Object.keys(s.entries || {})
  const lines = order
    .filter((id) => s.entries?.[id])
    .map((id) => {
      const sets = s.entries[id]
      const work = workSets(sets).filter((x) => x.r || x.rl || x.rr || x.s || x.m || x.km || x.min)
      if (!work.length) return null
      const warm = sets.length - workSets(sets).length
      const uni = work.some((x) => x.rl || x.rr)
      const extra = [
        uni ? 'izq/der' : null,
        ck.rir?.[id] != null ? `RIR ${ck.rir[id]} al final` : null,
        warm ? `+${warm} de calentamiento` : null,
      ].filter(Boolean)
      const note = s.notes?.[id] ? ` — nota: ${String(s.notes[id]).trim()}` : ''
      return `- ${nm(id)}: ${work.map(setLine).join(', ')}${extra.length ? ` (${extra.join(', ')})` : ''}${note}`
    })
    .filter(Boolean)
  const note = ck.note ? [`Comentario: ${ck.note}`] : []
  return [head.join(' · '), ...lines, ...note].join('\n')
}

// Rutina actual. Con refs = con referencias e ids (para que la otra IA pueda devolver cambios que la app aplica)
function planBlock(data, refs) {
  if (!data.plan?.length) return 'Aún no tengo rutina.'
  const nm = nameOf(data)
  const { view } = planForAi(data)
  return data.plan
    .map((d, i) => {
      const wd = d.weekday != null ? WEEKDAYS[d.weekday].toLowerCase() : 'sin día fijo'
      const head = refs ? `${view[i].ref} · ${wd} · ${d.name.trim()}` : `${d.name.trim()} (${wd})`
      const items = d.items.map((it, k) => {
        const bits = [
          `${it.sets}×${String(it.reps).trim()}`,
          it.rir != null ? `RIR ${it.rir}` : null,
          it.rest ? `descanso ${restOf(it.rest)}` : null,
          it.drop ? 'con drop set' : null,
          it.uni ? 'unilateral' : null,
        ].filter(Boolean)
        return refs ? `  - ${view[i].ref}e${k + 1} · ${nm(it.ex)} [${it.ex}] · ${bits.join(' · ')}` : `  - ${nm(it.ex)}: ${bits.join(' · ')}`
      })
      return [head, ...(items.length ? items : ['  - (sin ejercicios)'])].join('\n')
    })
    .join('\n')
}

function aboutBlock(data, now, sessions) {
  const gen = data.prefs?.gen || {}
  const lv = levelOf(data, now)
  const sex = sexOf(data)
  const days = (data.plan || []).filter((d) => d.weekday != null).sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7))
  const pains = sessions.filter((s) => s.checkin?.pain?.zone).map((s) => `${s.checkin.pain.zone.toLowerCase()} (${dayLbl(s.date)}${s.checkin.pain.level ? ', ' + s.checkin.pain.level : ''})`)
  const nm = nameOf(data)
  return [
    sex ? `- Sexo: ${sex === 'f' ? 'mujer' : 'hombre'}` : null,
    `- Nivel: ${lv.label.toLowerCase()} (${lv.auto ? 'lo calcula la app: ' + String(lv.whyMe || lv.why).replace(/\btus\b/g, 'mis').replace(/\btu\b/g, 'mi') : 'elegido por mí'})`,
    data.goals?.aim ? `- Objetivo: ${AIMS[data.goals.aim] || data.goals.aim}` : null,
    gen.goal ? `- Tipo de entreno que busco: ${(GOALS.find((g) => g.id === gen.goal)?.label || gen.goal).toLowerCase()}` : null,
    days.length ? `- Días con entreno en mi rutina: ${days.length} (${days.map((d) => WD[d.weekday]).join(', ')})` : null,
    gen.n ? `- Tiempo por sesión: unos ${MINUTES.find((m) => m.n === gen.n)?.min || 60} min` : null,
    gen.equip?.length ? `- Material disponible: ${gen.equip.join(', ').toLowerCase()}` : null,
    gen.focus ? `- Quiero priorizar: ${gen.focus.toLowerCase()}` : null,
    gen.zones?.length ? `- Molestias o limitaciones: ${gen.zones.join(', ').toLowerCase()}` : null,
    pains.length ? `- Molestias apuntadas en este periodo: ${pains.join('; ')}` : null,
    gen.exclude?.length ? `- Ejercicios que no quiero: ${gen.exclude.map(nm).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

// Evolución de cada ejercicio en el periodo (los más hechos primero)
function progressBlock(data, from, now) {
  const ses = data.sessions || []
  const nm = nameOf(data)
  const count = {}
  for (const s of ses) if (s.date >= from) for (const id of Object.keys(s.entries || {})) count[id] = (count[id] || 0) + 1
  const rows = Object.keys(count)
    .sort((a, b) => count[b] - count[a])
    .slice(0, 16)
    .map((id) => {
      const all = exHistory(ses, id, data.plan)
      const st = all.filter((x) => x.date >= from)
      if (!st.length) return null
      const best = st.reduce((m, x) => (x.best.e > m.best.e ? x : m), st[0])
      const first = st[0].best.e
      const last = st[st.length - 1].best.e
      const read = progressRead(all)
      return `- ${nm(id)}: ${st.length} ${st.length === 1 ? 'sesión' : 'sesiones'} · mejor serie ${fmtKg(best.best.w)}×${best.best.r} (${dayLbl(best.date)}) · 1RM est. ${st.length > 1 ? `${r1(first)} → ${r1(last)} kg` : `${r1(last)} kg`}${read.kind !== 'few' ? ` · ${read.text}` : ''}`
    })
    .filter(Boolean)
  const stuck = stalled(ses, now, data.plan).map((x) => nm(x.id))
  return [...rows, stuck.length ? `- Sin mejorar en sus 3 últimos entrenos: ${stuck.join(', ')}` : null].filter(Boolean).join('\n')
}

function muscleBlock(data, from, weeks) {
  const load = muscleLoad(data.sessions || [], from, groupsOf)
  const rows = Object.entries(load)
    .filter(([g]) => g !== 'Cardio' && g !== 'Estiramientos')
    .sort((a, b) => b[1].eff - a[1].eff)
    .map(([g, v]) => `- ${g}: ${r1(v.eff / weeks)} series/semana (${v.direct} directas y ${v.indirect} de rebote en total, ${v.freq} días)`)
  return rows.join('\n')
}

function bodyBlock(data, from) {
  const w = (data.body?.weight || []).filter((x) => x.date >= from)
  const c = (data.body?.waist || []).filter((x) => x.date >= from)
  const bw = bodyWeight(data)
  const out = []
  if (w.length) out.push(`- Pesajes: ${w.map((x) => `${dayLbl(x.date)} ${fmtKg(num(x.kg))} kg`).join(', ')}`)
  else if (bw.real) out.push(`- Peso (media de los últimos pesajes): ${r1(bw.kg)} kg`)
  if (c.length) out.push(`- Cintura: ${c.map((x) => `${dayLbl(x.date)} ${fmtKg(num(x.cm))} cm`).join(', ')}`)
  return out.join('\n')
}

function sleepBlock(data, from) {
  const n = Object.entries(nightsOf(data)).filter(([d, x]) => d >= from && x?.total > 0)
  if (!n.length) return ''
  const avg = n.reduce((t, [, x]) => t + x.total, 0) / n.length
  const short = n.filter(([, x]) => x.total < 360).length
  return `- Sueño (reloj): ${n.length} noches, media ${Math.floor(avg / 60)} h ${String(Math.round(avg % 60)).padStart(2, '0')} min de sueño real; ${short} noches por debajo de 6 h`
}

function dietBlock(data, from) {
  const days = Object.entries(data.food || {}).filter(([d, e]) => d >= from && d < fmtDate(new Date()) && e?.length)
  if (!days.length) return ''
  const tot = days.map(([, e]) => dayTotals(e))
  const kcal = tot.reduce((t, x) => t + x.kcal, 0) / tot.length
  const p = tot.reduce((t, x) => t + x.p, 0) / tot.length
  const goal = data.goals || {}
  return `- Dieta: ${days.length} ${days.length === 1 ? 'día apuntado' : 'días apuntados'}, media ${Math.round(kcal)} kcal y ${Math.round(p)} g de proteína al día${goal.kcal ? ` (mis objetivos: ${goal.kcal} kcal y ${goal.protein} g)` : ''}`
}

const ASK = {
  plan: 'Eres un entrenador personal experto en fuerza e hipertrofia. Abajo están mis datos reales exportados de mi app de gimnasio (MI-GYM). Revisa mi rutina con esos números (progreso por ejercicio, series por músculo, estancamientos, molestias, tiempo y material) y hazme un plan para las próximas semanas: qué mantener, qué cambiar y por qué. Sé concreto: ejercicios, series, repeticiones, RIR y descanso. No inventes datos que no estén aquí; si te falta algo importante, pregúntamelo.',
  progress: 'Eres un entrenador personal experto en fuerza e hipertrofia. Abajo están mis datos reales exportados de mi app de gimnasio (MI-GYM). Analiza mi progreso: qué está mejorando, qué está estancado y por qué puede ser, si el volumen por músculo y la frecuencia son adecuados, y dame de 3 a 5 cambios concretos para las próximas semanas. Usa mis números; no inventes datos que no estén aquí.',
  last: 'Eres un entrenador personal experto en fuerza e hipertrofia. Abajo está mi último entreno, exportado de mi app de gimnasio (MI-GYM), y la vez anterior que hice el mismo día. Dime qué tal ha ido comparado con la otra vez (serie a serie) y qué debería intentar la próxima en cada ejercicio (peso y repeticiones).',
}

const FORMAT = (data) => `## Formato para aplicarlo en mi app
Si me propones cambios en la rutina, al final de tu respuesta añade UN bloque \`\`\`json con este formato exacto (la app lo lee y me enseña los cambios antes de aplicarlos):
{"resumen":"1 frase","dias":[{"ref":"d2","nombre":"Espalda y bíceps","dia":2,"ejercicios":[{"ref":"d2e1","id":"Wide-Grip_Lat_Pulldown","series":3,"reps":"8-10","rir":2}]}]}
Reglas del bloque:
- "dia": 0 = domingo, 1 = lunes … 6 = sábado; null = sin día fijo.
- Día que ya tengo: su "ref" (d1, d2…) y TODOS los ejercicios con los que queda, en orden. Los que se quedan o sustituyes llevan la "ref" del original (d1e2…); los nuevos, "ref": null.
- Día nuevo: "ref": null, con "nombre" y "dia". Los días que no cambian no los pongas.
- "id": SOLO ids del catálogo de abajo o de mi rutina, copiados tal cual (en inglés). En tu explicación nómbralos en español.
- "series" de 1 a 6, "reps" como texto ("8-10"), "rir" de 0 a 4. En ejercicios por tiempo, "reps" en segundos con s ("30-45s").
- "drop": true solo en los ejercicios que quieras con drop set; si no lo pones, va sin drop set.
- La app no borra días: si sobra alguno, dímelo en el texto.

## Catálogo de ejercicios (ids por grupo)
${catalogForAi(data)}`

// → texto listo para pegar. opts: { kind: 'plan'|'progress'|'last', weeks, body, sleep, diet, ask }
export function exportText(data, opts = {}, now = new Date()) {
  const kind = AX_KINDS[opts.kind] ? opts.kind : 'plan'
  const ses = data.sessions || []
  const today = fmtDate(now)
  const sec = (title, body) => (body ? `## ${title}\n${body}` : null)
  const legend = 'Series: kg×repeticiones; PC = peso corporal; 20×10/9 = izquierda/derecha; RIR = repeticiones que quedaban en reserva.'
  const ask = String(opts.ask || '').trim()

  if (kind === 'last') {
    const s = ses[ses.length - 1]
    if (!s) return `${ASK.last}\n\nTodavía no tengo ningún entreno guardado.`
    const prev = [...ses.slice(0, -1)].reverse().find((x) => (s.dayId && s.dayId !== 'free' ? x.dayId === s.dayId : (x.dayName || '').trim() === (s.dayName || '').trim()))
    const day = data.plan?.find((d) => d.id === s.dayId)
    const nm = nameOf(data)
    const target = day ? day.items.map((it) => `- ${nm(it.ex)}: ${it.sets}×${String(it.reps).trim()}${it.rir != null ? ` · RIR ${it.rir}` : ''}`).join('\n') : ''
    const from = addDays(today, -28)
    return [
      ASK.last,
      ask ? `\nLo que quiero saber: ${ask}` : null,
      '',
      sec('Sobre mí', aboutBlock(data, now, ses.filter((x) => x.date >= from))),
      opts.body ? sec('Cuerpo', bodyBlock(data, from)) : null,
      sec('Último entreno', `${legend}\n${sessionBlock(s, data)}`),
      prev ? sec('La vez anterior', sessionBlock(prev, data)) : '## La vez anterior\nEs la primera vez que hago este día.',
      target ? sec('Lo que pone mi rutina para ese día', target) : null,
    ]
      .filter((x) => x != null)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
  }

  const weeks = [4, 8, 12].includes(opts.weeks) ? opts.weeks : 8
  const from = addDays(today, -7 * weeks + 1)
  const inP = ses.filter((s) => s.date >= from)
  // semanas reales con datos (si empezó hace 3 semanas, la media por semana es entre 3, no entre 8)
  const first = inP[0]?.date
  const span = first ? Math.max(1, Math.min(weeks, Math.round(((parseDate(today) - parseDate(first)) / 864e5 + 1) / 7))) : weeks
  const extra = [opts.body ? bodyBlock(data, from) : '', opts.sleep ? sleepBlock(data, from) : '', opts.diet ? dietBlock(data, from) : ''].filter(Boolean).join('\n')
  return [
    ASK[kind],
    ask ? `\nLo que quiero: ${ask}` : null,
    '',
    `Datos de ${dayLbl(from)} a ${dayLbl(today)} (${weeks} semanas). Hoy es ${WEEKDAYS[now.getDay()].toLowerCase()} ${dayLbl(today).slice(4)}.`,
    sec('Sobre mí', aboutBlock(data, now, inP)),
    sec(kind === 'plan' ? 'Mi rutina actual (referencias para el formato del final)' : 'Mi rutina actual', planBlock(data, kind === 'plan')),
    sec('Constancia', inP.length ? `- ${inP.length} entrenos en ${span} ${span === 1 ? 'semana' : 'semanas'} (${r1(inP.length / span)} por semana)` : '- Ningún entreno en este periodo.'),
    inP.length ? sec('Evolución por ejercicio', progressBlock(data, from, now)) : null,
    inP.length ? sec('Series por músculo (las de músculo secundario cuentan la mitad)', muscleBlock(data, from, span)) : null,
    extra ? sec('Cuerpo y descanso', extra) : null,
    inP.length ? sec('Entrenos', `${legend}\n\n${inP.map((s) => sessionBlock(s, data)).join('\n\n')}`) : null,
    kind === 'plan' ? FORMAT(data) : null,
  ]
    .filter((x) => x != null)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
}

/* ---------- Respuesta de la otra IA → propuesta de la app ---------- */
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
let INDEX = null
// id escrito a mano o con otro formato, o nombre en español → id del catálogo (o de los ejercicios propios)
export function resolveEx(v, data) {
  if (!v) return null
  if (exOf(v, data)) return v
  if (!INDEX) {
    INDEX = new Map()
    for (const e of EXERCISES) {
      INDEX.set(fold(e.id), e.id)
      if (!INDEX.has(fold(e.name))) INDEX.set(fold(e.name), e.id)
    }
  }
  const k = fold(v)
  const own = (data.myExercises || []).find((x) => fold(x.id) === k || fold(x.name) === k)
  return own?.id || INDEX.get(k) || null
}

function jsonCandidates(raw) {
  const out = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]).reverse()
  const a = raw.indexOf('{')
  const b = raw.lastIndexOf('}')
  if (a >= 0 && b > a) out.push(raw.slice(a, b + 1))
  return out
}

// → { proposal, unknown: [ids que no existen], error: null | 'nojson' | 'empty' }
export function readReply(text, data) {
  const raw = String(text || '').replace(/[“”]/g, '"')
  let p = null
  for (const c of jsonCandidates(raw)) {
    try {
      const o = JSON.parse(c.trim())
      const q = o?.propuesta && typeof o.propuesta === 'object' ? o.propuesta : o
      if (Array.isArray(q?.dias)) {
        p = q
        break
      }
    } catch {}
  }
  if (!p) return { proposal: null, unknown: [], error: 'nojson' }
  const unknown = []
  const fixed = {
    ...p,
    dias: p.dias.map((d) => ({
      ...d,
      ejercicios: (Array.isArray(d?.ejercicios) ? d.ejercicios : []).map((e) => {
        const id = resolveEx(e?.id, data) || resolveEx(e?.nombre || e?.name, data)
        if (!id) unknown.push(String(e?.id || e?.nombre || '?'))
        // "30-45s" → 30-45 segundos (la serie se apunta por tiempo); sin "drop": true, sin drop set (así lo pide el formato)
        const secs = String(e?.reps ?? '').match(/^\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:s|seg|segs|segundos|")\s*$/i)
        return { ...e, id, drop: e?.drop === true, ...(secs ? { reps: secs[2] ? `${secs[1]}-${secs[2]}` : secs[1], track: 'time' } : {}) }
      }),
    })),
  }
  const { map } = planForAi(data)
  const proposal = buildProposal(fixed, data, map)
  return { proposal, unknown, error: proposal ? null : 'empty' }
}
