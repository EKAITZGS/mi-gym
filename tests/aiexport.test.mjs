// Llevar los entrenos a Claude o ChatGPT: texto para pegar y lectura de la rutina que devuelvan
import assert from 'node:assert/strict'
import { exportText, readReply, resolveEx } from '../src/aiExport.js'
import { applyAiProposal } from '../src/aiPlan.js'

const B = 'Barbell_Bench_Press_-_Medium_Grip'
const R = 'Seated_Cable_Rows'
const data = {
  v: 2,
  goals: { kcal: 2200, protein: 150, aim: 'lose' },
  prefs: { sex: 'm', gen: { n: 6, equip: ['Barra', 'Máquina'], zones: ['Hombro'] } },
  plan: [
    { id: 'd1', name: 'Pecho', weekday: 1, items: [{ id: 'i1', ex: B, sets: 3, reps: '8-10', rir: 2, rest: 120 }] },
    { id: 'd2', name: 'Espalda', weekday: 3, items: [{ id: 'i2', ex: R, sets: 3, reps: '10' }] },
  ],
  sessions: [
    { id: 'old', date: '2026-06-01', dayId: 'd1', dayName: 'Pecho', entries: { [B]: [{ w: '50', r: '10' }] } },
    {
      id: 's1', date: '2026-11-10', dayId: 'd1', dayName: 'Pecho', min: 50,
      entries: { [B]: [{ w: '40', r: '10', warm: true }, { w: '60', r: '10' }, { w: '60', r: '9', drops: [{ w: '40', r: '8' }] }] },
      checkin: { feel: 3, rir: { [B]: 1 }, pain: { zone: 'Hombro', level: 'leve' }, note: 'bien' },
    },
    { id: 's2', date: '2026-11-17', dayId: 'd1', dayName: 'Pecho', entries: { [B]: [{ w: '62,5', r: '9' }, { w: '20', rl: '10', rr: '9' }] }, notes: { [B]: 'agarre cerrado' } },
  ],
  body: { weight: [{ date: '2026-11-12', kg: '80,5' }], waist: [{ date: '2026-11-12', cm: 85 }] },
  food: { '2026-11-20': [{ grams: 200, kcal: 100, p: 10, c: 1, f: 1 }] },
  polar: { sleep: { '2026-11-20': { start: '23:30', end: '07:00', total: 400 } } },
  myExercises: [],
}
const now = new Date('2026-11-24T10:00:00')

// plan: rutina con referencias e ids, entrenos del periodo (no los de antes), formato y catálogo
const plan = exportText(data, { kind: 'plan', weeks: 4, body: true, ask: 'quiero 4 días' }, now)
assert.match(plan, /Lo que quiero: quiero 4 días/)
assert.match(plan, /d1 · lunes · Pecho\n {2}- d1e1 · Press banca con barra \[Barbell_Bench_Press_-_Medium_Grip\] · 3×8-10 · RIR 2 · descanso 2 min/)
assert.match(plan, /60×10, 60×9 \+ drop 40×8 \(RIR 1 al final, \+1 de calentamiento\)/)
assert.match(plan, /62,5×9, 20×10\/9 \(izq\/der\) — nota: agarre cerrado/)
assert.match(plan, /molestia: hombro leve/)
assert.match(plan, /2 entrenos en 2 semanas \(1 por semana\)/)
assert.match(plan, /Pesajes: jue 12-11 80,5 kg/)
assert.match(plan, /```json/)
assert.match(plan, /## Catálogo de ejercicios/)
assert.ok(!plan.includes('01-06'), 'el entreno de junio no está en 4 semanas')
assert.ok(!/Sueño|Dieta:/.test(plan), 'sueño y dieta solo si se piden')

// cómo voy: sin referencias, sin formato; sueño y dieta si se piden
const prog = exportText(data, { kind: 'progress', weeks: 8, sleep: true, diet: true }, now)
assert.match(prog, /Pecho \(lunes\)\n {2}- Press banca con barra: 3×8-10/)
assert.ok(!prog.includes('d1e1') && !prog.includes('```'))
assert.match(prog, /Sueño \(reloj\): 1 noches|Sueño \(reloj\): 1 noche/)
assert.match(prog, /Dieta: 1 día apuntado, media 200 kcal y 20 g/)
assert.ok(!prog.includes('Pesajes'), 'peso solo si se pide')

// último entreno: el de hoy y la vez anterior del mismo día
const last = exportText(data, { kind: 'last' }, now)
assert.match(last, /## Último entreno[\s\S]*mar 17-11 · Pecho[\s\S]*## La vez anterior[\s\S]*mar 10-11 · Pecho/)
assert.match(last, /Lo que pone mi rutina para ese día\n- Press banca con barra: 3×8-10 · RIR 2/)
assert.match(exportText({ ...data, sessions: [] }, { kind: 'last' }, now), /Todavía no tengo ningún entreno/)

// nombres o ids mal escritos → ids de la app
assert.equal(resolveEx('incline dumbbell press', data), 'Incline_Dumbbell_Press')
assert.equal(resolveEx(B, data), B)
assert.equal(resolveEx('Inventado', data), null)

// respuesta con texto y bloque JSON: cambios en un día y un día nuevo; los ejercicios inventados se quitan
const reply = `Te propongo esto.
\`\`\`json
{"resumen":"Más espalda","dias":[{"ref":"d1","nombre":"Pecho","dia":1,"ejercicios":[{"ref":"d1e1","id":"${B}","series":4,"reps":"6-8","rir":2},{"ref":null,"id":"incline dumbbell press","series":3,"reps":"10-12"},{"ref":null,"id":"Inventado_X","series":3,"reps":"10"}]},{"ref":null,"nombre":"Pierna","dia":5,"ejercicios":[{"ref":null,"id":"Barbell_Squat","series":3,"reps":"8"}]}]}
\`\`\`
¡Suerte!`
const r = readReply(reply, data)
assert.equal(r.error, null)
assert.deepEqual(r.unknown, ['Inventado_X'])
assert.equal(r.proposal.summary, 'Más espalda')
assert.deepEqual(r.proposal.days.map((d) => d.kind), ['edit', 'new'])
const out = applyAiProposal(data.plan, r.proposal)
assert.deepEqual(out.find((d) => d.id === 'd1').items.map((i) => [i.ex, i.sets, i.reps]), [[B, 4, '6-8'], ['Incline_Dumbbell_Press', 3, '10-12']])
assert.equal(out.find((d) => d.name === 'Pierna').weekday, 5)
// comillas tipográficas (al copiar de algunas apps) y {"propuesta": …}
assert.equal(readReply(`{“propuesta”: {“dias”: [{“ref”: null, “nombre”: “Core”, “dia”: 6, “ejercicios”: [{“id”: “Plank”, “series”: 3, “reps”: “30”}]}]}}`, data).error, null)
assert.equal(readReply('Sin bloque', data).error, 'nojson')
assert.equal(readReply('{"dias":[]}', data).error, 'empty')
console.log('aiexport ok')
