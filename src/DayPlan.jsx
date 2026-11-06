import { useMemo, useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { FOODS } from './data/foods'
import { macros, todayStr, addDays, uid } from './store'
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
export function buildDay(data) {
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
    if (t.p >= data.goals.protein * 0.95) break
    if (!F[id] || Object.values(plan).flat().some((e) => e.name === F[id].name)) continue
    const meal = plan.Merienda.length <= plan.Cena.length ? 'Merienda' : 'Cena'
    plan[meal].push(fromFood(F[id], g))
    t = totals()
  }
  // ajusta raciones de lo que no es proteína para acercarse a las calorías
  const target = data.goals.kcal
  for (let i = 0; i < 4 && Math.abs(t.kcal - target) > 120; i++) {
    const flex = Object.values(plan).flat().filter((e) => e.p * 4 < e.kcal * 0.3 && !e.unitG)
    const flexK = flex.reduce((a, e) => a + macros(e).kcal, 0)
    if (flexK < 50) break
    const k = Math.max(0.5, Math.min(1.8, 1 + (target - t.kcal) / flexK))
    for (const e of flex) e.grams = Math.round((e.grams * k) / 10) * 10
    t = totals()
  }
  return { plan, kcal: Math.round(t.kcal), p: Math.round(t.p), removed }
}

export default function DayPlanModal({ data, setData, onClose }) {
  const day = useMemo(() => buildDay(data), [data])
  const [done, setDone] = useState('')
  const copy = (date) => {
    const add = MEALS.flatMap((m) => day.plan[m].map((e) => ({ ...e, id: uid(), meal: m })))
    setData((d) => ({ ...d, food: { ...d.food, [date]: [...(d.food[date] || []), ...add] } }))
    setDone(date === todayStr() ? 'Añadido a hoy.' : 'Añadido a mañana.')
  }
  return (
    <Modal title="Día tipo sugerido" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Hecho con lo que sueles comer y ajustado a tus {data.goals.kcal} kcal y {data.goals.protein} g de proteína. Úsalo de guía.
      </p>
      <div className="polar-sum">
        <div>
          <b>{day.kcal}</b>
          <span>kcal</span>
        </div>
        <div>
          <b>{day.p}</b>
          <span>g proteína</span>
        </div>
      </div>
      {day.removed.length > 0 && (
        <div className="advice yellow sm">He quitado lo marcado en rojo: {day.removed.map((n) => n.replace(/ \(.*\)/, '')).join(', ')}.</div>
      )}
      {MEALS.map((m) => {
        const k = Math.round(day.plan[m].reduce((a, e) => a + macros(e).kcal, 0))
        return (
          <div key={m} className="dp-meal">
            <div className="dp-head">
              <b>{m}</b>
              <span className="muted small">{k} kcal</span>
            </div>
            {day.plan[m].map((e, i) => (
              <div className="small dp-item" key={i}>
                {e.name.replace(/ \(.*\)/, '')} <span className="muted">· {e.grams} g · {Math.round(macros(e).p)} g prot</span>
              </div>
            ))}
          </div>
        )
      })}
      <div className="btns">
        <button className="btn primary" onClick={() => copy(addDays(todayStr(), 1))}>
          <Icon name="calendar" size={15} /> Usar mañana
        </button>
        <button className="btn" onClick={() => copy(todayStr())}>
          Añadir a hoy
        </button>
      </div>
      {done && <p className="toast small">{done} Puedes cambiar o quitar cosas en Dieta.</p>}
    </Modal>
  )
}
