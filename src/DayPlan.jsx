import { useMemo, useState } from 'react'
import { groqChat, hasAi } from './ai'
import { AIMS, aimOf, aimLabel, targetFor, energy, macroPlan, isTrainDay } from './energy'
import { Modal } from './ui'
import Icon from './icons'
import { FOODS } from './data/foods'
import { macros, todayStr, addDays, uid, parseDate, WEEKDAYS } from './store'
import { rateFood } from './rating'

const F = Object.fromEntries(FOODS.map((f) => [f.id, f]))
const MEALS = ['Desayuno', 'Comida', 'Merienda', 'Cena']
// Opciones de reserva si aún no tienes historial en una comida
const BASE = {
  Desayuno: [['f-avena', 50], ['f-leche', 250], ['f-platano', 100]],
  Comida: [['f-pollo', 160], ['f-arroz-c', 200], ['f-brocoli', 150]],
  Merienda: [['f-griego', 125], ['f-manzana', 180]],
  Cena: [['f-merluza', 200], ['f-patata', 200], ['f-tomate', 150]],
}
const PROTEIN = [['f-skyr', 250], ['f-atun', 80], ['f-pavo', 150], ['f-claras', 200]]

const fromFood = (f, grams) => ({ name: f.name, grams, kcal: f.kcal, p: f.p, c: f.c, f: f.f, s: f.s, sf: f.sf, natural: f.natural, unitG: f.unitG, unitName: f.unitName })
const strip = ({ id, meal, label, quick, ...e }) => e

// Día tipo con lo que tú sueles comer: quita lo rojo, ajusta raciones a tus calorías y completa la proteína
export function buildDay(data, target = data.goals.kcal, protein = data.goals.protein) {
  const since = addDays(todayStr(), -30)
  const freq = {}
  for (const [d, list] of Object.entries(data.food || {})) {
    if (d < since) continue
    for (const e of list) {
      if (e.quick || !MEALS.includes(e.meal) || !e.grams) continue
      const k = e.meal + '|' + e.name
      freq[k] = freq[k] || { n: 0, g: 0, e }
      freq[k].n++
      freq[k].g += e.grams
    }
  }
  const removed = []
  const plan = {}
  for (const m of MEALS) {
    const mine = Object.entries(freq)
      .filter(([k]) => k.startsWith(m + '|'))
      .map(([, v]) => ({ ...strip(v.e), grams: Math.round(v.g / v.n), n: v.n }))
      .sort((a, b) => b.n - a.n)
    const ok = []
    for (const e of mine) {
      if (rateFood(e)?.level === 'red') {
        if (!removed.includes(e.name)) removed.push(e.name)
        continue
      }
      if (ok.length < 3) ok.push(e)
    }
    plan[m] = ok.length ? ok.map(({ n, ...e }) => e) : BASE[m].filter(([id]) => F[id]).map(([id, g]) => fromFood(F[id], g))
  }
  const totals = () => Object.values(plan).flat().reduce((t, e) => {
    const x = macros(e)
    return { kcal: t.kcal + x.kcal, p: t.p + x.p }
  }, { kcal: 0, p: 0 })
  // completa la proteína en merienda y cena
  let t = totals()
  for (const [id, g] of PROTEIN) {
    if (t.p >= protein * 0.95) break
    if (!F[id] || Object.values(plan).flat().some((e) => e.name === F[id].name)) continue
    const meal = plan.Merienda.length <= plan.Cena.length ? 'Merienda' : 'Cena'
    plan[meal].push(fromFood(F[id], g))
    t = totals()
  }
  fitPlan(plan, target)
  t = planTotals(plan)
  return { plan, kcal: Math.round(t.kcal), p: Math.round(t.p), removed }
}

const planTotals = (plan) =>
  Object.values(plan)
    .flat()
    .reduce((t, e) => {
      const x = macros(e)
      return { kcal: t.kcal + x.kcal, p: t.p + x.p }
    }, { kcal: 0, p: 0 })

// ajusta raciones de lo que no es proteína para acercarse a las calorías
function fitPlan(plan, target) {
  let t = planTotals(plan)
  for (let i = 0; i < 4 && Math.abs(t.kcal - target) > 120; i++) {
    const flex = Object.values(plan).flat().filter((e) => e.p * 4 < e.kcal * 0.3 && !e.unitG)
    const flexK = flex.reduce((a, e) => a + macros(e).kcal, 0)
    if (flexK < 50) break
    const k = Math.max(0.5, Math.min(1.8, 1 + (target - t.kcal) / flexK))
    for (const e of flex) e.grams = Math.max(10, Math.round((e.grams * k) / 10) * 10)
    t = planTotals(plan)
  }
}

// lo que más comes últimamente (para que la IA tire de ahí)
function usualFoods(data) {
  const since = addDays(todayStr(), -30)
  const n = {}
  for (const [d, list] of Object.entries(data.food || {})) if (d >= since) for (const e of list) if (!e.quick) n[e.name] = (n[e.name] || 0) + 1
  return Object.entries(n)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k]) => k.replace(/ \(.*\)/, ''))
}

// Dieta de un día hecha por la IA, con las kcal que salen de lo que gastas
async function aiDay(data, { kcal, protein, fat, carbs, kg, aim, train, weekday, note }) {
  const usual = usualFoods(data)
  const prompt = `Eres un nutricionista deportivo. Diseña la dieta de UN día (${weekday}) para un chico de ${kg || 80} kg que entrena fuerza.
Objetivo: ${aimLabel(aim).toLowerCase()}. Es un día de ${train ? 'entreno (gimnasio): pon más hidratos en las comidas de antes y después de entrenar' : 'descanso: algo menos de hidratos que un día de entreno'}.
Calorías del día: ${kcal} kcal (máximo ±5 %). Proteína: ${protein} g (mínimo). Grasa: unos ${fat} g. Hidratos: unos ${carbs} g.
Comidas: Desayuno, Comida, Merienda y Cena.
${usual.length ? `Usa sobre todo alimentos que ya suele comer: ${usual.join(', ')}.` : ''}
${note ? `Petición del usuario: ${note}` : ''}
Reglas: comida normal de España, fácil de hacer y barata; raciones realistas; gramos indicando si es en crudo o cocinado; poco ultraprocesado; reparte la proteína entre las 4 comidas.
kcal y macros de cada alimento son los de la cantidad indicada (no por 100 g).
Responde SOLO con este JSON:
{"comidas":[{"comida":"Desayuno","alimentos":[{"nombre":"","g":0,"kcal":0,"proteina_g":0,"carbos_g":0,"grasa_g":0}]}],"nota":""}`
  const txt = await groqChat({
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_completion_tokens: 1800,
  })
  let o
  try {
    o = JSON.parse(txt)
  } catch {
    try {
      o = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] || '')
    } catch {
      throw new Error('No entendí la respuesta de la IA, prueba otra vez')
    }
  }
  const num = (v) => Math.max(0, Number(String(v).replace(',', '.')) || 0)
  const plan = Object.fromEntries(MEALS.map((m) => [m, []]))
  for (const c of Array.isArray(o.comidas) ? o.comidas : []) {
    const m = MEALS.find((x) => x.toLowerCase() === String(c.comida || '').trim().toLowerCase())
    if (!m) continue
    for (const a of Array.isArray(c.alimentos) ? c.alimentos : []) {
      const g = num(a.g)
      if (!g || !num(a.kcal)) continue
      // en la app cada alimento va por 100 g + gramos
      plan[m].push({ name: String(a.nombre || 'Alimento').slice(0, 80), grams: Math.round(g), kcal: (num(a.kcal) / g) * 100, p: (num(a.proteina_g) / g) * 100, c: (num(a.carbos_g) / g) * 100, f: (num(a.grasa_g) / g) * 100, ai: true })
    }
  }
  if (!Object.values(plan).flat().length) throw new Error('La IA no devolvió una dieta válida, prueba otra vez')
  fitPlan(plan, kcal)
  const t = planTotals(plan)
  return { plan, kcal: Math.round(t.kcal), p: Math.round(t.p), removed: [], ai: true, note: String(o.nota || '').slice(0, 300) }
}


// objetivo de kcal automático según lo que gastas (lo activa el usuario)
export function AutoGoal({ data, setData }) {
  return (
    <label className="chk-l uni-l">
      <input type="checkbox" checked={!!data.goals.auto} onChange={(e) => setData((d) => ({ ...d, goals: { ...d.goals, auto: e.target.checked } }))} />
      <span>
        Objetivo automático según lo que gasto
        <span className="muted small"> · más los días de entreno</span>
      </span>
    </label>
  )
}


export default function DayPlanModal({ data, setData, onClose }) {
  const aim = aimOf(data)
  const e = useMemo(() => energy(data), [data])
  // para qué día: hoy o mañana; si entrenas lo dice tu plan (días de la semana del Entreno)
  const [when, setWhen] = useState(0)
  const [force, setForce] = useState(null)
  const date = addDays(todayStr(), when)
  const planned = isTrainDay(data, date)
  const train = force ?? planned
  const wd = WEEKDAYS[parseDate(date).getDay()].toLowerCase()
  const tg = targetFor(data, aim, train)
  const mp = macroPlan(data, aim, tg.kcal)
  const protein = mp.protein
  const usual = useMemo(() => buildDay(data, tg.kcal, protein), [data, tg.kcal, protein])
  const [ai, setAi] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState('')
  const day = ai || usual
  const setAim = (v) => {
    setAi(null)
    setData((d) => ({ ...d, goals: { ...d.goals, aim: v } }))
  }
  const makeAi = async () => {
    setBusy(true)
    setErr('')
    try {
      setAi(await aiDay(data, { kcal: tg.kcal, protein, fat: mp.fat, carbs: mp.carbs, kg: mp.kg, aim, train, weekday: wd, note: note.trim().slice(0, 160) }))
    } catch (x) {
      setErr(x.message === 'NO_KEY' ? 'La IA no está activada: ponla en Ajustes.' : x.message)
    }
    setBusy(false)
  }
  const copy = (date) => {
    const add = MEALS.flatMap((m) => day.plan[m].map((x) => ({ ...x, id: uid(), meal: m })))
    setData((d) => ({ ...d, food: { ...d.food, [date]: [...(d.food[date] || []), ...add] } }))
    setDone(date === todayStr() ? 'Añadido a hoy.' : 'Añadido a mañana.')
  }
  const pickDay = (n) => {
    setWhen(n)
    setForce(null)
    setAi(null)
  }
  const delta = tg.kcal - tg.base
  return (
    <Modal title="Dieta del día" onClose={onClose}>
      <label className="lbl" style={{ marginTop: 0 }}>Objetivo</label>
      <div className="seg seg3">
        {AIMS.map(([v, l]) => (
          <button key={v} className={aim === v ? 'on' : ''} onClick={() => setAim(v)}>
            {l}
          </button>
        ))}
      </div>
      <label className="lbl">Para</label>
      <div className="seg">
        {[0, 1].map((n) => {
          const d = addDays(todayStr(), n)
          return (
            <button key={n} className={when === n ? 'on' : ''} onClick={() => pickDay(n)}>
              {n ? 'Mañana' : 'Hoy'} · {isTrainDay(data, d) ? 'entreno' : 'descanso'}
            </button>
          )
        })}
      </div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        {force == null
          ? `Según tu plan, el ${wd} ${planned ? 'entrenas' : 'descansas'}.`
          : `Cambiado a día de ${train ? 'entreno' : 'descanso'}.`}{' '}
        <button className="link" style={{ padding: 0, minHeight: 0, display: 'inline' }} onClick={() => (setForce(!train), setAi(null))}>
          {train ? '¿No vas a entrenar?' : '¿Al final entrenas?'}
        </button>
      </p>
      <div className="dp-target">
        Un día de {train ? 'entreno' : 'descanso'} gastas <b>~{tg.base} kcal</b>{' '}
        {e.watch ? `(media de tu reloj, ${train ? e.typ.nTrain || e.typ.n : e.typ.nRest || e.typ.n} días)` : '(estimado: conecta el reloj para afinarlo)'}.
        {' '}Para {aimLabel(aim).toLowerCase()}: <b>{tg.kcal} kcal</b>
        {delta ? ` (${delta > 0 ? '+' : '−'}${Math.abs(delta)})` : ''}.
        <div className="dp-macros">
          <span>
            <b>{protein} g</b> proteína{mp.kg ? ` (${String(mp.perKg).replace('.', ',')} g/kg)` : ''}
          </span>
          <span>
            <b>{mp.carbs} g</b> hidratos
          </span>
          <span>
            <b>{mp.fat} g</b> grasa
          </span>
        </div>
        {mp.kg ? `Calculado con tu peso medio: ${String(mp.kg).replace('.', ',')} kg.` : 'Pésate para calcular la proteína con tu peso.'}
        {aim === 'lose' && ' Así bajas unos 0,5 kg de grasa por semana sin perder fuerza.'}
        {aim === 'gain' && ' Superávit pequeño para ganar músculo con poca grasa.'}
        <div className="muted" style={{ marginTop: 6 }}>
          {e.cal.ok
            ? `Calibrado con tu peso: lo que marca el reloj ${e.cal.factor < 1 ? `se ha bajado un ${Math.round((1 - e.cal.factor) * 100)} %` : e.cal.factor > 1 ? `se ha subido un ${Math.round((e.cal.factor - 1) * 100)} %` : 'cuadra con tu peso'}.`
            : `El reloj suele pasarse con las calorías: en 3–4 semanas se calibrará con tu peso (${e.cal.why}).`}
        </div>
      </div>
      <AutoGoal data={data} setData={setData} />

      <div className="dp-ai" style={{ marginTop: 12 }}>
        <input className="inp" placeholder="Pídele algo a la IA (opcional): sin pescado, cena rápida…" value={note} onChange={(x) => setNote(x.target.value)} />
      </div>
      <button className="btn full" disabled={busy || !hasAi()} onClick={makeAi}>
        <Icon name="sparkle" size={15} /> {busy ? 'Creando dieta…' : ai ? 'Hacer otra con IA' : 'Crear dieta con IA'}
      </button>
      {!hasAi() && <p className="muted small">Activa la IA en Ajustes para que te haga dietas.</p>}
      {err && <div className="advice yellow sm">{err}</div>}

      <div className="polar-sum" style={{ marginTop: 12 }}>
        <div>
          <b>{day.kcal}</b>
          <span>kcal</span>
        </div>
        <div>
          <b>{day.p}</b>
          <span>g proteína</span>
        </div>
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        {ai ? (
          <span className="dp-tag">
            <Icon name="sparkle" size={13} /> Hecha con IA
          </span>
        ) : (
          'Con lo que sueles comer, ajustado a estas kcal.'
        )}
        {ai && (
          <button className="link" onClick={() => setAi(null)} style={{ marginLeft: 8 }}>
            Ver la de lo que sueles comer
          </button>
        )}
      </p>
      {ai?.note && <p className="muted small">{ai.note}</p>}
      {day.removed.length > 0 && (
        <div className="advice yellow sm">He quitado lo marcado en rojo: {day.removed.map((n) => n.replace(/ \(.*\)/, '')).join(', ')}.</div>
      )}
      {MEALS.map((m) => {
        const k = Math.round(day.plan[m].reduce((a, x) => a + macros(x).kcal, 0))
        return (
          <div key={m} className="dp-meal">
            <div className="dp-head">
              <b>{m}</b>
              <span className="muted small">{k} kcal</span>
            </div>
            {day.plan[m].map((x, i) => (
              <div className="small dp-item" key={i}>
                {x.name.replace(/ \(.*\)/, '')} <span className="muted">· {x.grams} g · {Math.round(macros(x).p)} g prot</span>
              </div>
            ))}
          </div>
        )
      })}
      <button className="btn primary full" onClick={() => copy(date)}>
        <Icon name="calendar" size={15} /> Añadir a {when ? 'mañana' : 'hoy'}
      </button>
      {done && <p className="toast small">{done} Puedes cambiar o quitar cosas en Dieta.</p>}
      {(data.goals.kcal !== tg.kcal || data.goals.protein !== protein) && !data.goals.auto && (
        <button className="btn full" onClick={() => setData((d) => ({ ...d, goals: { ...d.goals, kcal: tg.kcal, protein } }))}>
          Usar {tg.kcal} kcal y {protein} g de proteína como objetivo fijo
        </button>
      )}
    </Modal>
  )
}
