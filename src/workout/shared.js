// Utilidades comunes de las pantallas de entreno.
import { num, pad, setTxt } from '../store'

export const ORDER = [1, 2, 3, 4, 5, 6, 0] // lunes primero
export const restTxt = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s} s`)
// Entradas numéricas: peso con decimales (coma o punto) y repeticiones enteras
export const kgIn = (v) => v.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1').slice(0, 6)
export const repIn = (v) => v.replace(/\D/g, '').slice(0, 3)
// Cambios sin guardar en el editor de día (App lo consulta antes de cambiar de pestaña)
export const editGuard = { dirty: false }
export const setsVol = (sets) =>
  sets.reduce((t, s) => t + num(s.w) * num(s.r) + (s.drops || []).reduce((q, x) => q + num(x.w) * num(x.r), 0), 0)
export const setsTxt = (sets) => sets.map(setTxt).join(', ')
