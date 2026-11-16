// Entrenador IA: propuestas de cambios en la rutina (se leen, se validan y se aplican solo si el usuario acepta)
import assert from 'node:assert/strict'
import { wantsPlan, planForAi, parseCoachReply, applyAiProposal, proposalTxt, catalogForAi, groupsFor, levelOf, autoLevel, levelPrompt } from '../src/aiPlan.js'

const data = {
  myExercises: [],
  plan: [
    {
      id: 'P1',
      name: 'Hombro ',
      weekday: 2,
      items: [
        { id: 'i1', ex: 'Dumbbell_Shoulder_Press', sets: 3, reps: '8-10', rir: 2, drop: false },
        { id: 'i2', ex: 'Side_Lateral_Raise', sets: 3, reps: '12', drop: false },
        { id: 'i3', ex: 'Triceps_Pushdown', sets: 3, reps: '10', drop: false },
      ],
    },
    { id: 'P2', name: 'Pierna', weekday: 3, items: [{ id: 'j1', ex: 'Barbell_Squat', sets: 4, reps: '6-8', drop: false }] },
  ],
}

// ¿va de la rutina?
assert.ok(wantsPlan('me molesta el hombro, ¿qué cambio?'))
assert.ok(wantsPlan('hazme un día de espalda para el miércoles'))
assert.ok(!wantsPlan('¿qué ceno hoy?'))
assert.ok(wantsPlan('vale, perfecto', [{ role: 'coach', proposal: {} }]))
assert.ok(!wantsPlan('vale, perfecto', [{ role: 'coach', proposal: {}, status: 'ok' }]))

// referencias cortas para la IA
const { view, map } = planForAi(data)
assert.equal(view[0].ref, 'd1')
assert.equal(view[0].nombre, 'Hombro')
assert.deepEqual(view[0].ej[1], ['d1e2', 'Side_Lateral_Raise', 3, '12'])
assert.equal(map.items.d1e1.item.id, 'i1')
// catálogo: solo ids de los de siempre, por grupos; con grupos pedidos, solo esos (Groq limita el tamaño)
const cat = catalogForAi(data)
assert.ok(cat.includes('Machine_Shoulder_Military_Press'))
assert.ok(cat.length < 8000)
const esp = catalogForAi(data, ['Espalda'])
assert.ok(esp.startsWith('Espalda: ') && esp.includes('Wide-Grip_Lat_Pulldown') && !esp.includes('Barbell_Squat'))
assert.ok(esp.length < 1500)
// grupos de la pregunta; una molestia trae también los grupos que cargan esa zona
assert.deepEqual(groupsFor('hazme un día de espalda'), ['Espalda'])
assert.deepEqual(groupsFor('me molesta el hombro').sort(), ['Hombro', 'Pecho', 'Tríceps'].sort())
assert.deepEqual(groupsFor('¿qué ceno?'), [])
// sin decir la zona: la de sus check-in recientes
assert.ok(groupsFor('¿qué cambio por mis molestias?', { sessions: [{ checkin: { pain: { zone: 'Rodilla' } } }] }).includes('Pierna'))

// molestia en el hombro: cambiar press con mancuernas por máquina, quitar laterales, mantener tríceps
// + día nuevo de espalda el miércoles (ese día ya tiene Pierna) + un id inventado que se descarta
const reply = JSON.stringify({
  respuesta: 'Te cambio el press por la máquina y quito laterales.',
  propuesta: {
    resumen: 'Menos carga en el hombro y un día de espalda.',
    dias: [
      { ref: 'd1', nombre: 'Hombro', dia: 2, ejercicios: [
        { ref: 'd1e1', id: 'Machine_Shoulder_Military_Press', series: 3, reps: '10-12' },
        { ref: 'd1e3', id: 'Triceps_Pushdown', series: 3, reps: '10' },
        { ref: null, id: 'Face_Pull', series: 3, reps: '15' },
      ] },
      { ref: null, nombre: 'Espalda', dia: 3, ejercicios: [
        { ref: null, id: 'Wide-Grip_Lat_Pulldown', series: 3, reps: '10' },
        { ref: null, id: 'Seated_Cable_Rows', series: 3, reps: '10' },
        { ref: null, id: 'Ejercicio_Inventado', series: 3, reps: '10' },
      ] },
      { ref: 'd2', nombre: 'Pierna', dia: 3, ejercicios: [{ ref: 'd2e1', id: 'Barbell_Squat', series: 4, reps: '6-8' }] },
    ],
  },
})
const r = parseCoachReply(reply, data, map)
assert.equal(r.text, 'Te cambio el press por la máquina y quito laterales.')
assert.equal(r.proposal.days.length, 2) // el día sin cambios (Pierna) no aparece
const [ed, nw] = r.proposal.days
assert.equal(ed.kind, 'edit')
assert.equal(ed.weekday, undefined) // mismo día de la semana
assert.deepEqual(ed.changes.map((c) => c.t), ['swap', 'add', 'del'])
assert.equal(nw.kind, 'new')
assert.equal(nw.weekday, 3)
assert.deepEqual(nw.items.map((x) => x.ex), ['Wide-Grip_Lat_Pulldown', 'Seated_Cable_Rows'])
assert.ok(proposalTxt(r.proposal, data).includes('día nuevo "Espalda" (Miércoles)'))

// aplicar: mismo id y día de la semana; el press conserva su id; el nuevo día entra el miércoles y Pierna se queda sin día
const plan = applyAiProposal(data.plan, r.proposal)
const hombro = plan.find((d) => d.id === 'P1')
assert.equal(hombro.weekday, 2)
assert.deepEqual(hombro.items.map((x) => x.ex), ['Machine_Shoulder_Military_Press', 'Triceps_Pushdown', 'Face_Pull'])
assert.equal(hombro.items[0].id, 'i1')
assert.equal(hombro.items[0].reps, '10-12')
assert.equal(hombro.items[1].id, 'i3')
assert.equal(plan.find((d) => d.id === 'P2').weekday, null)
const espDay = plan.find((d) => d.name === 'Espalda')
assert.equal(espDay.weekday, 3)
assert.equal(espDay.items.length, 2)
assert.ok(espDay.items.every((x) => x.id && x.sets === 3))
// el plan original no se toca
assert.equal(data.plan[1].weekday, 3)

// el usuario elige otro día para el día nuevo (sábado): Pierna sigue el miércoles
const plan2 = applyAiProposal(data.plan, r.proposal, { 1: 6 })
assert.equal(plan2.find((d) => d.name === 'Espalda').weekday, 6)
assert.equal(plan2.find((d) => d.id === 'P2').weekday, 3)

// mover un día existente a otro día
const mv = parseCoachReply(JSON.stringify({ respuesta: 'ok', propuesta: { dias: [{ ref: 'd2', nombre: 'Pierna', dia: 5, ejercicios: [{ ref: 'd2e1', id: 'Barbell_Squat', series: 4, reps: '6-8' }] }] } }), data, map)
assert.equal(mv.proposal.days[0].weekday, 5)
assert.equal(applyAiProposal(data.plan, mv.proposal).find((d) => d.id === 'P2').weekday, 5)

// sin propuesta, texto suelto o JSON roto: solo se enseña el texto
assert.equal(parseCoachReply('{"respuesta":"Cena tortilla.","propuesta":null}', data, map).proposal, null)
assert.equal(parseCoachReply('Hola, esto no es JSON', data, map).text, 'Hola, esto no es JSON')
// propuesta con todo inventado → nada que aplicar
assert.equal(parseCoachReply(JSON.stringify({ respuesta: 'x', propuesta: { dias: [{ ref: null, nombre: 'X', ejercicios: [{ id: 'Nada' }] }] } }), data, map).proposal, null)
// dia: null en un día existente no lo deja "sin día"
const keep = parseCoachReply(JSON.stringify({ respuesta: 'x', propuesta: { dias: [{ ref: 'd2', nombre: 'Pierna', dia: null, ejercicios: [{ ref: 'd2e1', id: 'Barbell_Squat', series: 5, reps: '5' }] }] } }), data, map)
assert.equal(keep.proposal.days[0].weekday, undefined)

// nivel: sale de los entrenos (cuántos y desde cuándo) o lo elige él
const ses = (n, first) => Array.from({ length: n }, (_, i) => ({ id: 's' + i, date: i === 0 ? first : '2026-11-15' }))
const hoy = new Date('2026-11-16T12:00:00')
assert.equal(autoLevel(ses(6, '2026-11-12'), hoy).id, 'beginner')
assert.equal(autoLevel(ses(40, '2026-03-01'), hoy).id, 'intermediate')
assert.equal(autoLevel(ses(200, '2025-01-01'), hoy).id, 'advanced')
assert.equal(autoLevel(ses(30, '2026-10-20'), hoy).id, 'beginner') // muchos entrenos pero menos de 8 semanas
assert.equal(levelOf({ sessions: ses(200, '2025-01-01'), prefs: { gen: { level: 'beginner' } } }, hoy).id, 'beginner')
assert.ok(levelOf({ sessions: ses(6, '2026-11-12') }, hoy).why.includes('6 entrenos registrados, el primero hace 4 días'))
assert.ok(levelPrompt({ sessions: ses(6, '2026-11-12') }).includes('Principiante: 3-5 ejercicios'))
// principiante: series con tope (4) y RIR de su nivel si la IA no lo pone; si lo pone, se respeta
const nov = { ...data, sessions: ses(6, '2026-11-12') }
const pm = planForAi(nov)
const pb = parseCoachReply(JSON.stringify({ respuesta: 'x', propuesta: { dias: [{ ref: null, nombre: 'Espalda', dia: 3, ejercicios: [
  { ref: null, id: 'Wide-Grip_Lat_Pulldown', series: 6, reps: '10-12' },
  { ref: null, id: 'Seated_Cable_Rows', series: 3, reps: '10-12', rir: 2 },
] }] } }), nov, pm.map)
assert.equal(pb.proposal.level, 'beginner')
assert.deepEqual(pb.proposal.days[0].items.map((x) => [x.sets, x.rir]), [[4, 3], [3, 2]])
// avanzado: RIR por defecto 1 y hasta 6 series
const adv = { ...data, sessions: ses(200, '2025-01-01') }
const pa = parseCoachReply(JSON.stringify({ respuesta: 'x', propuesta: { dias: [{ ref: null, nombre: 'E', ejercicios: [{ id: 'Wide-Grip_Lat_Pulldown', series: 6, reps: '8' }] }] } }), adv, planForAi(adv).map)
assert.deepEqual([pa.proposal.days[0].items[0].sets, pa.proposal.days[0].items[0].rir], [6, 1])
// un ejercicio que se queda igual conserva su RIR
const kept = parseCoachReply(JSON.stringify({ respuesta: 'x', propuesta: { dias: [{ ref: 'd1', nombre: 'Hombro', ejercicios: [{ ref: 'd1e1', id: 'Dumbbell_Shoulder_Press', series: 2, reps: '8-10' }, { ref: 'd1e2', id: 'Side_Lateral_Raise', series: 3, reps: '12' }, { ref: 'd1e3', id: 'Triceps_Pushdown', series: 3, reps: '10' }] }] } }), nov, pm.map)
assert.equal(applyAiProposal(nov.plan, kept.proposal).find((d) => d.id === 'P1').items[0].rir, 2)

console.log('aiplan ok')
