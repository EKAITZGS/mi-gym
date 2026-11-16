// Entrenador IA: propuestas de cambios en la rutina (crear un día, cambiar ejercicios por una molestia, mover un día).
// La IA solo propone; el usuario acepta o rechaza en el chat. Puro (sin React ni red) para probarlo con npm test.
import { EXERCISES, EX_BY_ID } from './data/exercises'
import { uid, WEEKDAYS } from './store'
import { clean, norm, diffDay, applyChanges } from './dayDiff'

// ¿La pregunta va de la rutina? Entonces se manda el catálogo y se permite proponer cambios.
const PLAN_RX =
  /(rutina|plan|d[ií]a|ejercicio|cambi|sustitu|quit|mete|meter|añad|hazme|haz |crea|mont|mueve|pasa |molest|dol|duele|lesi|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|espalda|pecho|pierna|hombro|brazo|b[ií]ceps|tr[ií]ceps|gl[uú]teo|core|abdom|gemel|femoral|cu[aá]driceps|series|reps)/i
// también si la última respuesta trae una propuesta sin decidir (p. ej. "vale, pero cámbiame el remo")
export const wantsPlan = (question, history = []) => PLAN_RX.test(question || '') || history.slice(-2).some((m) => m.proposal && !m.status)

const exOf = (id, data) => EX_BY_ID[id] || (data.myExercises || []).find((x) => x.id === id)
export const exNameOf = (data) => (id) => (exOf(id, data)?.name || 'Ejercicio').replace(/ \(.*\)/, '')

// Rutina con referencias cortas (d1, d1e2…) para que la IA diga qué día y qué ejercicio cambia
export function planForAi(data) {
  const days = {}
  const items = {}
  const view = data.plan.map((d, i) => {
    const ref = 'd' + (i + 1)
    days[ref] = d
    return {
      ref,
      nombre: d.name.trim(),
      dia: d.weekday,
      ejercicios: d.items.map((it, k) => {
        const r = `${ref}e${k + 1}`
        items[r] = { dayId: d.id, item: it }
        return { ref: r, id: it.ex, nombre: exNameOf(data)(it.ex), series: it.sets, reps: String(it.reps).trim() }
      }),
    }
  })
  return { view, map: { days, items } }
}

// Catálogo para la IA: los ejercicios de siempre (no los 600 extra), los de su rutina y los suyos propios
export function catalogForAi(data) {
  const inPlan = new Set(data.plan.flatMap((d) => d.items.map((i) => i.ex)))
  const rows = EXERCISES.filter((e) => !e.more || inPlan.has(e.id)).map((e) => `${e.id}|${e.name}|${e.group}`)
  for (const e of data.myExercises || []) rows.push(`${e.id}|${e.name}|${e.group || 'Propio'}`)
  return rows.join('\n')
}

export function planPrompt(data, view) {
  return `PROPUESTAS DE RUTINA: si el usuario pide cambiar su rutina, crear o "hacer" un día, qué ejercicios meter, mover un día, o adaptarla por una molestia, además de responder le preparas una propuesta concreta. Nunca se aplica sola: el usuario la acepta o la rechaza en la app.
Su rutina, con referencias (dia: 0=domingo, 1=lunes … 6=sábado; null = sin día fijo): ${JSON.stringify(view)}
Catálogo de ejercicios (id|nombre|grupo). Usa SOLO estos ids:
${catalogForAi(data)}
Reglas de la propuesta:
- En un día que ya tiene: "ref" del día y TODOS los ejercicios con los que queda, en orden; los que se quedan o se cambian llevan la "ref" del ejercicio original, los nuevos "ref": null.
- Día nuevo: "ref": null, su nombre y "dia" (el que pida; si ese día ya tiene otro entreno, avísalo en la respuesta).
- Si hay molestia en una zona, quita o sustituye lo que más la carga (p. ej. con el hombro: menos press por encima de la cabeza y fondos, más máquina y agarre neutro) y explica por qué. Si es dolor fuerte o no mejora, recomienda ir a un profesional.
- 4-6 ejercicios por día, 2-4 series, reps como "8-10" o "12". No entrenes el mismo grupo dos días seguidos si puedes evitarlo.
- Si no pide cambios, "propuesta": null.
Formato de la propuesta: {"resumen":"1 frase","dias":[{"ref":"d2" o null,"nombre":"...","dia":3,"ejercicios":[{"ref":"d2e1" o null,"id":"id del catálogo","series":3,"reps":"8-10"}]}]}`
}

const intIn = (v, lo, hi) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null
}

// Convierte la propuesta de la IA en días que la app sabe enseñar (diff) y aplicar. Descarta ids inventados.
export function buildProposal(p, data, map) {
  if (!p || !Array.isArray(p.dias)) return null
  const days = []
  const used = new Set()
  for (const d of p.dias.slice(0, 7)) {
    const base = d?.ref ? map.days[d.ref] : null
    const wd = intIn(d?.dia, 0, 6)
    const items = []
    const seen = new Set()
    for (const e of d?.ejercicios || []) {
      const ex = e?.id
      if (!exOf(ex, data) || seen.has(ex)) continue
      seen.add(ex)
      const src = base && e.ref && map.items[e.ref]?.dayId === base.id ? map.items[e.ref].item : null
      const it = norm({ ex, sets: Math.max(1, Math.min(6, Number(e.series) || 3)), reps: String(e.reps || '10').slice(0, 12) })
      // si se queda el mismo ejercicio, conserva lo suyo (descanso, RIR, unilateral…)
      items.push(src ? { ...(src.ex === ex ? clean(src) : {}), ...it, fromId: src.id } : it)
      if (items.length >= 10) break
    }
    if (!items.length) continue
    if (base && !used.has(base.id)) {
      used.add(base.id)
      // el nombre solo cambia si de verdad es otro (no por espacios sobrantes)
      const nm = String(d.nombre || '').trim().slice(0, 40)
      const day = { baseId: base.id, baseName: base.name, base: base.items.map((x) => ({ ...clean(x), id: x.id })), name: nm && nm !== base.name.trim() ? nm : base.name, items }
      const changes = diffDay(day)
      const move = wd != null && wd !== base.weekday ? wd : undefined
      if (!changes.length && move === undefined) continue
      days.push({ kind: 'edit', day, weekday: move, changes })
    } else if (!base) {
      days.push({ kind: 'new', name: String(d.nombre || 'Día nuevo').trim().slice(0, 40) || 'Día nuevo', weekday: wd, items })
    }
  }
  return days.length ? { summary: String(p.resumen || '').trim().slice(0, 300), days } : null
}

// Respuesta de la IA (JSON) → texto + propuesta. Si no viene en JSON, se enseña el texto tal cual.
export function parseCoachReply(txt, data, map) {
  const raw = String(txt || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  let o = null
  try {
    o = JSON.parse(raw)
  } catch {
    try {
      o = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '')
    } catch {
      o = null
    }
  }
  if (!o || typeof o !== 'object') return { text: raw, proposal: null }
  const text = String(o.respuesta ?? o.texto ?? o.mensaje ?? '').trim()
  const proposal = map ? buildProposal(o.propuesta, data, map) : null
  return { text: text || (proposal ? proposal.summary : ''), proposal }
}

// Mueve un día a otro día de la semana; el que estuviera ese día se queda sin día (como con el entrenador)
const moveDay = (plan, id, wd) => plan.map((p) => (p.id === id ? { ...p, weekday: wd } : wd != null && p.weekday === wd ? { ...p, weekday: null } : p))

// Aplica la propuesta aceptada. pick = { índice del día nuevo: día de la semana elegido }
export function applyAiProposal(plan, proposal, pick = {}) {
  let out = plan
  proposal.days.forEach((d, i) => {
    if (d.kind === 'edit') {
      out = applyChanges(out, d.day) || out
      if (d.weekday !== undefined) out = moveDay(out, d.day.baseId, d.weekday)
    } else {
      const wd = pick[i] !== undefined ? pick[i] : d.weekday
      const nd = { id: uid(), name: d.name, weekday: wd, items: d.items.map((x) => ({ ...clean(norm(x)), id: uid(), drop: !!x.drop })) }
      out = [...out.map((p) => (wd != null && p.weekday === wd ? { ...p, weekday: null } : p)), nd]
    }
  })
  return out
}

// Resumen corto para la conversación (la IA recuerda qué propuso)
export function proposalTxt(p, data) {
  const nm = exNameOf(data)
  return p.days
    .map((d) =>
      d.kind === 'new'
        ? `día nuevo "${d.name}"${d.weekday != null ? ` (${WEEKDAYS[d.weekday]})` : ''}: ${d.items.map((x) => `${nm(x.ex)} ${x.sets}×${x.reps}`).join(', ')}`
        : `cambios en "${d.day.baseName.trim()}": ${d.changes.map((c) => (c.t === 'swap' ? `${nm(c.from)}→${nm(c.ex)}` : c.t === 'add' ? `+${nm(c.ex)}` : c.t === 'del' ? `−${nm(c.ex)}` : c.t === 'sets' ? `${nm(c.ex)} ${c.sr}` : `nombre ${c.to}`)).join(', ')}${d.weekday !== undefined ? ` y pasar a ${d.weekday == null ? 'sin día' : WEEKDAYS[d.weekday]}` : ''}`
    )
    .join('; ')
}
