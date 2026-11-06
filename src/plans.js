import { uid } from './store'

// it(ejercicio, series, reps, drop)
const it = (ex, sets = 3, reps = '10', drop = false) => ({ id: uid(), ex, sets, reps, drop })

const TEMPLATES = {
  3: [
    {
      name: 'Cuerpo completo A',
      weekday: 1,
      items: () => [
        it('Dumbbell_Bench_Press', 3, '8-10'),
        it('Wide-Grip_Lat_Pulldown', 3, '10'),
        it('Leg_Press', 3, '12'),
        it('Machine_Shoulder_Military_Press', 3, '10'),
        it('Dumbbell_Bicep_Curl', 2, '12'),
        it('Plank', 3, '30-45 s'),
      ],
    },
    {
      name: 'Cuerpo completo B',
      weekday: 3,
      items: () => [
        it('Incline_Dumbbell_Press', 3, '10'),
        it('Seated_Cable_Rows', 3, '10'),
        it('Goblet_Squat', 3, '12'),
        it('Side_Lateral_Raise', 3, '15'),
        it('Triceps_Pushdown', 2, '12'),
        it('Cable_Crunch', 3, '15'),
      ],
    },
    {
      name: 'Cuerpo completo C',
      weekday: 5,
      items: () => [
        it('Leverage_Chest_Press', 3, '10-12'),
        it('One-Arm_Dumbbell_Row', 3, '10'),
        it('Romanian_Deadlift', 3, '10'),
        it('Dumbbell_Shoulder_Press', 3, '10'),
        it('Hammer_Curls', 2, '12'),
        it('Standing_Calf_Raises', 3, '15'),
      ],
    },
  ],
  4: [
    {
      name: 'Torso A',
      weekday: 1,
      items: () => [
        it('Barbell_Bench_Press_-_Medium_Grip', 3, '8-10'),
        it('Bent_Over_Barbell_Row', 3, '8-10'),
        it('Dumbbell_Shoulder_Press', 3, '10'),
        it('Close-Grip_Front_Lat_Pulldown', 3, '10-12'),
        it('Barbell_Curl', 2, '10-12'),
        it('Triceps_Pushdown_-_Rope_Attachment', 2, '12'),
      ],
    },
    {
      name: 'Pierna A',
      weekday: 2,
      items: () => [
        it('Barbell_Squat', 3, '8-10'),
        it('Romanian_Deadlift', 3, '10'),
        it('Leg_Press', 3, '12'),
        it('Lying_Leg_Curls', 3, '12'),
        it('Standing_Calf_Raises', 3, '15'),
        it('Plank', 3, '30-45 s'),
      ],
    },
    {
      name: 'Torso B',
      weekday: 4,
      items: () => [
        it('Incline_Dumbbell_Press', 3, '10'),
        it('Wide-Grip_Lat_Pulldown', 3, '10'),
        it('Seated_Cable_Rows', 3, '10-12'),
        it('Side_Lateral_Raise', 3, '15'),
        it('Hammer_Curls', 2, '12'),
        it('Lying_Triceps_Press', 2, '10-12'),
      ],
    },
    {
      name: 'Pierna B',
      weekday: 5,
      items: () => [
        it('Leg_Press', 3, '12'),
        it('Barbell_Hip_Thrust', 3, '10'),
        it('Leg_Extensions', 3, '12-15'),
        it('Seated_Leg_Curl', 3, '12'),
        it('Seated_Calf_Raise', 3, '15'),
        it('Cable_Crunch', 3, '15'),
      ],
    },
  ],
  5: [
    {
      name: 'Pecho y tríceps',
      weekday: 1,
      items: () => [
        it('Barbell_Bench_Press_-_Medium_Grip', 3, '8-10'),
        it('Incline_Dumbbell_Press', 3, '10'),
        it('Leverage_Incline_Chest_Press', 3, 'Al fallo', true),
        it('Cable_Crossover', 2, '12-15'),
        it('Triceps_Pushdown', 3, '12'),
      ],
    },
    {
      name: 'Espalda y bíceps',
      weekday: 2,
      items: () => [
        it('Wide-Grip_Lat_Pulldown', 3, '10'),
        it('Seated_Cable_Rows', 3, '10'),
        it('One-Arm_Dumbbell_Row', 3, '10'),
        it('Face_Pull', 2, '15'),
        it('Dumbbell_Bicep_Curl', 3, '12'),
      ],
    },
    {
      name: 'Pierna',
      weekday: 3,
      items: () => [
        it('Barbell_Squat', 3, '8-10'),
        it('Romanian_Deadlift', 3, '10'),
        it('Leg_Press', 3, '12'),
        it('Lying_Leg_Curls', 3, '12'),
        it('Standing_Calf_Raises', 3, '15'),
      ],
    },
    {
      name: 'Hombro y brazos',
      weekday: 4,
      items: () => [
        it('Dumbbell_Shoulder_Press', 3, '10'),
        it('Side_Lateral_Raise', 3, '15'),
        it('Reverse_Machine_Flyes', 2, '15'),
        it('Barbell_Curl', 3, '10'),
        it('Lying_Triceps_Press', 3, '10-12'),
      ],
    },
    {
      name: 'Cuerpo completo y core',
      weekday: 5,
      items: () => [
        it('Dumbbell_Bench_Press', 3, '10'),
        it('Close-Grip_Front_Lat_Pulldown', 3, '10'),
        it('Goblet_Squat', 3, '12'),
        it('Crunches', 3, '15'),
        it('Plank', 3, '30-45 s'),
      ],
    },
  ],
}

const PPL = [
  {
    name: 'Empuje A (pecho, hombro, tríceps)',
    weekday: 1,
    items: () => [
      it('Barbell_Bench_Press_-_Medium_Grip', 3, '8-10'),
      it('Dumbbell_Shoulder_Press', 3, '10'),
      it('Incline_Dumbbell_Press', 3, '10'),
      it('Side_Lateral_Raise', 3, '15'),
      it('Triceps_Pushdown', 3, '12'),
    ],
  },
  {
    name: 'Tirón A (espalda, bíceps)',
    weekday: 2,
    items: () => [
      it('Wide-Grip_Lat_Pulldown', 3, '10'),
      it('Seated_Cable_Rows', 3, '10'),
      it('One-Arm_Dumbbell_Row', 3, '10'),
      it('Face_Pull', 2, '15'),
      it('Barbell_Curl', 3, '10-12'),
    ],
  },
  {
    name: 'Pierna A',
    weekday: 3,
    items: () => [
      it('Barbell_Squat', 3, '8-10'),
      it('Romanian_Deadlift', 3, '10'),
      it('Leg_Press', 3, '12'),
      it('Lying_Leg_Curls', 3, '12'),
      it('Standing_Calf_Raises', 3, '15'),
    ],
  },
  {
    name: 'Empuje B (pecho, hombro, tríceps)',
    weekday: 4,
    items: () => [
      it('Dumbbell_Bench_Press', 3, '10'),
      it('Leverage_Incline_Chest_Press', 3, 'Al fallo', true),
      it('Machine_Shoulder_Military_Press', 3, '10-12'),
      it('Cable_Crossover', 2, '12-15'),
      it('Cable_Rope_Overhead_Triceps_Extension', 3, '12'),
    ],
  },
  {
    name: 'Tirón B (espalda, bíceps)',
    weekday: 5,
    items: () => [
      it('Close-Grip_Front_Lat_Pulldown', 3, '10-12'),
      it('Bent_Over_Barbell_Row', 3, '8-10'),
      it('Reverse_Machine_Flyes', 2, '15'),
      it('Hammer_Curls', 3, '12'),
      it('Alternate_Incline_Dumbbell_Curl', 2, '12'),
    ],
  },
  {
    name: 'Pierna B',
    weekday: 6,
    items: () => [
      it('Leg_Press', 3, '12'),
      it('Barbell_Hip_Thrust', 3, '10'),
      it('Leg_Extensions', 3, '12-15'),
      it('Seated_Leg_Curl', 3, '12'),
      it('Seated_Calf_Raise', 3, '15'),
      it('Cable_Crunch', 3, '15'),
    ],
  },
]
TEMPLATES[6] = PPL
TEMPLATES[7] = [
  ...PPL,
  {
    name: 'Día suave (core y movilidad)',
    weekday: 0,
    items: () => [
      it('Plank', 3, '30-45 s'),
      it('Crunches', 3, '15'),
      it('Hanging_Leg_Raise', 3, '10'),
      it('Hyperextensions_Back_Extensions', 2, '12'),
    ],
  },
]

export const PLAN_OPTIONS = [
  { days: 3, label: '3 días', hint: 'Cuerpo completo (lun, mié, vie)' },
  { days: 4, label: '4 días', hint: 'Torso / Pierna (lun, mar, jue, vie)' },
  { days: 5, label: '5 días', hint: 'Pecho, espalda, pierna, hombro y brazos, cuerpo completo' },
  { days: 6, label: '6 días', hint: 'Empuje / Tirón / Pierna, dos vueltas (lun a sáb)' },
  { days: 7, label: '7 días', hint: 'Igual que 6 + domingo suave de core. Ojo: sin descanso real' },
]

export const LEVELS = [
  { id: 'beginner', label: 'Principiante', hint: 'Empiezas o vuelves tras un parón', days: 3, range: '3 días (máx. 4)' },
  { id: 'intermediate', label: 'Intermedio', hint: 'Llevas 6-12 meses entrenando con constancia', days: 4, range: '4 días (3 a 5)' },
  { id: 'advanced', label: 'Avanzado', hint: 'Más de un año entrenando en serio', days: 5, range: '5 días (4 a 6)' },
]

// Ajusta volumen según el nivel: principiante menos series y sin fallo; avanzado una serie más.
export function generatePlan(days, level = 'intermediate') {
  return TEMPLATES[days].map((t) => ({
    id: uid(),
    name: t.name,
    weekday: t.weekday,
    items: t.items().map((i) => {
      if (level === 'beginner') {
        const reps = i.drop ? '10-12' : i.reps
        return { ...i, sets: Math.max(2, Math.min(3, i.sets)), reps, drop: false }
      }
      if (level === 'advanced') return { ...i, sets: Math.min(5, i.sets + 1) }
      return i
    }).slice(0, level === 'beginner' ? 5 : 6),
  }))
}
