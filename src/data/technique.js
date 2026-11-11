// Claves de técnica por tipo de movimiento (según el id del ejercicio y su grupo). Generales, no sustituyen a un entrenador.
const RULES = [
  [/Hip_Thrust|Glute_Bridge|Butt_Lift/i, 'Barbilla hacia el pecho y empuja con los talones. Aprieta el glúteo 1 s arriba sin arquear la zona lumbar.'],
  [/Deadlift|Good_Morning|Stiff/i, 'Espalda recta todo el recorrido y la barra pegada a las piernas. Lleva la cadera atrás; no redondees la espalda para bajar más.'],
  [/Calf/i, 'Recorrido completo: baja hasta notar el estiramiento y aguanta 1 s arriba. Sin rebotes.'],
  [/Squat|Leg_Press|Lunge|Hack|Step/i, 'Rodillas en la línea de los pies y espalda neutra. Baja hasta donde mantengas la espalda recta y empuja con todo el pie.'],
  [/Leg_Curl|Leg_Extension/i, 'Ajusta la máquina para que la rodilla quede en el eje. Sube controlado, aguanta 1 s y baja despacio.'],
  [/Pulldown|Pull[-_]?Ups?|Chin-Up/i, 'Pecho arriba y hombros lejos de las orejas. Lleva los codos hacia abajo y atrás hasta la parte alta del pecho; sube controlado.'],
  [/Lateral|Front_\w*Raise|Upright/i, 'Codos un poco doblados y fijos. Sube hasta la altura del hombro, sin impulso, y baja controlado.'],
  [/Row|Face_Pull|Reverse.*Fl/i, 'Tira con los codos, no con las manos. Junta las escápulas al final y no balancees el tronco.'],
  [/Curl/i, 'Codos quietos pegados al cuerpo. Sube sin balancearte y baja despacio (2-3 s).'],
  [/Push-?Ups?/i, 'Cuerpo en línea recta de la cabeza a los talones y abdomen apretado. Baja hasta casi tocar el suelo con el pecho.'],
  [/Dip/i, 'Hombros abajo y lejos de las orejas. Baja controlado hasta que el brazo quede paralelo al suelo; inclinarte hacia delante trabaja más pecho.'],
  [/Tricep|Pushdown|Skull/i, 'Codos fijos: solo se mueve el antebrazo. Estira del todo sin bloquear de golpe.'],
  [/Kickback/i, 'Sin arquear la lumbar: la pierna sube por el glúteo, no por la espalda. Aguanta 1 s arriba.'],
  [/Fly|Flye|Crossover|Pec_Deck/i, 'Codos un poco doblados y fijos, como abrazando un árbol. Abre hasta notar el estiramiento sin forzar el hombro.'],
  [/Shoulder_Press|Military|Arnold|Overhead_Press/i, 'Abdomen apretado y sin arquear la lumbar. Empuja en vertical hasta casi estirar los brazos.'],
  [/Press/i, 'Escápulas juntas y hacia abajo, pies firmes. Baja controlado hasta el pecho y empuja sin rebotar ni despegar los hombros.'],
]
const BY_GROUP = {
  Core: 'Aprieta el abdomen como si fueran a darte un golpe y no tires del cuello. Movimientos lentos y controlados.',
  Antebrazo: 'Movimiento corto y controlado; aguanta 1 s en la contracción.',
  Estiramientos: 'Aguanta 20–30 s por lado respirando tranquilo. Tensión suave, nunca dolor, y sin rebotes.',
  Cardio: 'La mayor parte a un ritmo en el que puedas hablar. Apunta minutos y distancia para ver cómo mejoras.',
}
const BY_KIND = {
  Halterofilia: 'Movimiento muy técnico: aprende con barra vacía o con un entrenador antes de cargar peso.',
  Pliometría: 'Aterriza suave, con las rodillas alineadas con los pies. Calidad antes que cantidad: para si pierdes la técnica.',
  Strongman: 'Espalda neutra y abdomen apretado todo el rato. Empieza ligero y sube poco a poco.',
}
const GENERAL = 'Controla la bajada (2-3 s), recorrido completo y sin rebotes. Esfuerzo sí, dolor punzante no: si aparece, para.'

// Core va primero: "Leg_Press" no debe ganar a un ejercicio de abdomen, pero sí a un press de pecho
export const techFor = (ex) =>
  (ex &&
    (((ex.group === 'Core' || ex.group === 'Estiramientos' || ex.group === 'Cardio') && BY_GROUP[ex.group]) ||
      BY_KIND[ex.kind] ||
      RULES.find(([re]) => re.test(ex.id))?.[1] ||
      BY_GROUP[ex.group])) ||
  GENERAL
