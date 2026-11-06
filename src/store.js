import { useEffect, useState } from 'react'

const KEY = 'migym.v1'

export const pad = (n) => String(n).padStart(2, '0')
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayStr = () => fmtDate(new Date())
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (s, n) => {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return fmtDate(d)
}
export const uid = () => Math.random().toString(36).slice(2, 9)

// weekday: 0 = domingo ... 6 = sábado (como Date.getDay()). null = sin día fijo.
export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export const DEFAULT = {
  v: 1,
  goals: { kcal: 2200, protein: 150 },
  plan: [
    {
      id: 'd1',
      name: 'Pecho y tríceps',
      weekday: 1,
      items: [
        { id: 'i1', ex: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3, reps: '8-10', drop: false },
        { id: 'i2', ex: 'Incline_Dumbbell_Press', sets: 3, reps: '10', drop: false },
        { id: 'i3', ex: 'Leverage_Incline_Chest_Press', sets: 3, reps: 'Al fallo', drop: true },
        { id: 'i4', ex: 'Machine_Triceps_Extension', sets: 3, reps: '12', drop: false },
      ],
    },
    {
      id: 'd2',
      name: 'Espalda y bíceps',
      weekday: 2,
      items: [
        { id: 'i5', ex: 'Wide-Grip_Lat_Pulldown', sets: 3, reps: '10', drop: false },
        { id: 'i6', ex: 'Seated_Cable_Rows', sets: 3, reps: '10', drop: false },
        { id: 'i7', ex: 'One-Arm_Dumbbell_Row', sets: 3, reps: '10', drop: false },
        { id: 'i8', ex: 'Dumbbell_Bicep_Curl', sets: 3, reps: '12', drop: false },
      ],
    },
    {
      id: 'd3',
      name: 'Pierna',
      weekday: 4,
      items: [
        { id: 'i9', ex: 'Barbell_Squat', sets: 3, reps: '8-10', drop: false },
        { id: 'i10', ex: 'Leg_Press', sets: 3, reps: '12', drop: false },
        { id: 'i11', ex: 'Lying_Leg_Curls', sets: 3, reps: '12', drop: false },
        { id: 'i12', ex: 'Standing_Calf_Raises', sets: 3, reps: '15', drop: false },
      ],
    },
    {
      id: 'd4',
      name: 'Hombro y brazos',
      weekday: 5,
      items: [
        { id: 'i13', ex: 'Dumbbell_Shoulder_Press', sets: 3, reps: '10', drop: false },
        { id: 'i14', ex: 'Side_Lateral_Raise', sets: 3, reps: '15', drop: false },
        { id: 'i15', ex: 'Barbell_Curl', sets: 3, reps: '10', drop: false },
        { id: 'i16', ex: 'Triceps_Pushdown', sets: 3, reps: '12', drop: false },
      ],
    },
  ],
  active: null, // entreno en curso
  sessions: [], // entrenos terminados
  food: {}, // 'YYYY-MM-DD' -> [{id, meal, name, grams, kcal, p, c, f, label}]  (kcal/p/c/f por 100 g)
  myFoods: [],
  myExercises: [], // ejercicios propios {id, name, group}
}

export function useStore() {
  const [data, setData] = useState(() => {
    try {
      const s = localStorage.getItem(KEY)
      if (s) return { ...DEFAULT, ...JSON.parse(s) }
    } catch {}
    return DEFAULT
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {}
  }, [data])
  useEffect(() => {
    try {
      navigator.storage?.persist?.()
    } catch {}
  }, [])
  return [data, setData]
}

// Última vez que se hizo un ejercicio (series de la sesión más reciente que lo tenga)
export function lastSets(sessions, exId) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sets = sessions[i].entries?.[exId]
    if (sets && sets.some((s) => s.w || s.r)) return { date: sessions[i].date, sets }
  }
  return null
}

export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export const macros = (e) => {
  const k = (e.grams || 0) / 100
  return { kcal: e.kcal * k, p: e.p * k, c: e.c * k, f: e.f * k }
}

export const dayTotals = (entries = []) =>
  entries.reduce(
    (t, e) => {
      const m = macros(e)
      return { kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, f: t.f + m.f }
    },
    { kcal: 0, p: 0, c: 0, f: 0 }
  )

/* ---------- Progreso ---------- */
export const fmtKg = (n) => String(Math.round(n * 100) / 100).replace('.', ',')

// 1RM estimado (fórmula de Epley)
export const e1rm = (w, r) => {
  w = num(w)
  r = num(r)
  if (w <= 0 || r <= 0) return 0
  return r === 1 ? w : w * (1 + r / 30)
}

// Por sesión: mejor serie (por 1RM estimado) y volumen total (series + drops)
export function exStats(sessions, exId) {
  const out = []
  for (const s of sessions) {
    const sets = s.entries?.[exId]
    if (!sets) continue
    let best = null
    let vol = 0
    for (const st of sets) {
      const w = num(st.w)
      const r = num(st.r)
      if (w > 0 && r > 0) {
        const e = e1rm(w, r)
        vol += w * r
        if (!best || e > best.e) best = { w, r, e }
      }
      for (const d of st.drops || []) {
        const dw = num(d.w)
        const dr = num(d.r)
        if (dw > 0 && dr > 0) vol += dw * dr
      }
    }
    if (best) out.push({ date: s.date, best, vol })
  }
  return out
}

// Doble progresión: si la última vez llegaste al tope de reps en todas las series, sube peso.
export function suggestion(sessions, exId, repsTarget, setsPlanned, equip) {
  const last = lastSets(sessions, exId)
  if (!last) return null
  const m = String(repsTarget || '').trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
  if (!m) return null
  const lo = Number(m[1])
  const hi = Number(m[2] || m[1])
  const sets = last.sets.filter((s) => num(s.w) > 0 && num(s.r) > 0)
  if (sets.length < Math.max(1, setsPlanned)) return null
  if (!sets.every((s) => num(s.r) >= hi)) return null
  const from = Math.min(...sets.map((s) => num(s.w)))
  const inc = equip === 'Mancuernas' ? (from >= 20 ? 2 : 1) : 2.5
  return { w: Math.round((from + inc) * 100) / 100, reps: lo, hi, from, inc }
}
