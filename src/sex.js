// Sexo (opcional, en data.prefs.sex: 'm' | 'f'). Solo sirve para comparar la fuerza con referencias adecuadas
// (rangos de «Tu personaje» y nivel automático) y para que el entrenador IA lo tenga en cuenta. Sin indicar = referencias de hombre.
import { EX_BY_ID } from './data/exercises'

export const sexOf = (data) => {
  const s = data?.prefs?.sex
  return s === 'f' || s === 'm' ? s : null
}

const GLUTE = /Hip_Thrust|Glute|Kickback|Pull_Through|Thigh_Abductor/
// Referencias de mujeres respecto a las de hombres (fuerza relativa al peso corporal, tablas habituales tipo Strength Level):
// tren superior ~60 %, pierna ~75 %, glúteo ~85 % (hip thrust y puentes es donde menos diferencia hay).
// En peso corporal (repeticiones) la diferencia arriba es mayor: dominadas o flexiones ~40 %.
export function sexFactor(id, sex, reps = false) {
  if (sex !== 'f') return 1
  const ex = EX_BY_ID[id]
  if (GLUTE.test(id) || ex?.main?.includes('Glúteos') || ex?.main?.includes('Abductores')) return reps ? 0.9 : 0.85
  if (ex?.group === 'Pierna') return reps ? 0.8 : 0.75
  if (ex?.group === 'Core') return 0.85
  return reps ? 0.4 : 0.6
}

// Para el entrenador IA
export function sexPrompt(data) {
  const s = sexOf(data)
  if (s === 'f')
    return 'Es MUJER. Mismos principios que para un hombre (fuerza, progresión, básicos; nada de pesos "de chica" ni solo cardio): sus pesos se comparan con referencias de mujeres; suele recuperar antes entre series y tolerar algo más de volumen. Si quiere glúteo o pierna, prioriza hip thrust, peso muerto rumano, búlgaras/zancadas, abducción y patada en polea, glúteo 2-3 días por semana. No supongas objetivos: sigue los que diga.'
  if (s === 'm') return 'Es hombre.'
  return ''
}
