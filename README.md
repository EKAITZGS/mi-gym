# Mi Gym

App web (PWA) para planes de entreno, ejercicios con fotos y calorías/proteína.
Sin servidor, sin cuentas: **los datos se guardan en el propio móvil** de cada persona.

## Qué hace
- **Plan automático paso a paso:** nivel, días que vas (los eliges tú), tiempo por entreno, reparto (cuerpo completo, torso/pierna, empuje/tirón/pierna, un grupo por día o el que quieras día a día), material disponible y músculo a priorizar. Cada ejercicio trae series, reps, RIR (reps en reserva) y descanso. Puedes cambiar un ejercicio o rehacer un día antes de guardar, o pulsar *Sorpréndeme*.
- **Entreno en curso:** peso y reps por serie, "última vez" como referencia (nunca copia las reps), drop sets, ejercicios unilaterales (izq/der), notas por ejercicio y temporizador de descanso que no se pierde al cambiar de pestaña.
- **Al terminar:** duración, series, kg movidos, récords, comparación con la última vez y un check-in (sensación, sueño, molestias) que ajusta los consejos.
- **Progreso:** rangos por músculo, series por músculo a la semana, récords del último mes, ejercicios estancados, fuerza por ejercicio (1RM estimado) y cintura/peso como tendencia.
- **Inicio:** entreno del día, racha de semanas, kg y tiempo de la semana, y revisión semanal con propuestas que solo se aplican si las aceptas.
- **Entrenador por chat:** preguntas libres a la IA, que conoce tu plan, tus entrenos, molestias y sueño (orientativo).
- **Biblioteca:** 873 ejercicios con fotos (fuerza, cardio, estiramientos, pliometría, halterofilia y strongman); cada uno se puede medir por peso y reps, tiempo, distancia o km y minutos,, claves de técnica, favoritos y ejercicios propios.
- **Dieta:** calorías y proteína por comida, escáner de código de barras (Open Food Facts), foto del plato con IA (opcional, clave gratis de Groq) y calculadora de objetivos (kcal y proteína) que no guarda tu peso ni tu edad.
- **Reloj Polar (opcional):** pasos, calorías, pulso de tus entrenos y **sueño** (horas, hora de acostarte, regularidad, fases si tu reloj las tiene) con análisis y consejos.
- **Copia de seguridad** (exportar/importar JSON).

## Privacidad
Todo se guarda solo en el móvil de cada persona (localStorage e IndexedDB). No hay cuentas ni servidor propio de datos. Las únicas salidas son las que usas tú: Groq (fotos/IA; sin clave propia pasa por el Worker con un límite diario), Open Food Facts (escáner) y Polar/avisos a través de un Worker de Cloudflare.

## Publicarla gratis (GitHub Pages)
1. Crea un repositorio en GitHub y sube todo este proyecto a la rama `main`.
2. En el repo: **Settings → Pages → Source: GitHub Actions**.
3. Al hacer push se publica sola (workflow incluido). La URL será `https://TU_USUARIO.github.io/NOMBRE_REPO/`.

Otras opciones gratis: Cloudflare Pages o Netlify (comando `npm run build`, carpeta `dist`).

## Instalarla en el iPhone
Abre la URL en **Safari** → botón Compartir → **Añadir a pantalla de inicio**.
Instalada así, iOS no borra los datos por inactividad. Haz copias de seguridad desde Ajustes de vez en cuando.

## Desarrollo
```
npm install
npm run dev      # servidor local
npm run build    # genera dist/
npm test         # pruebas de la lógica (generador, estadísticas)
```

## Créditos
Fotos de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público).
Productos de súper: [Open Food Facts](https://world.openfoodfacts.org). Los valores de la lista de alimentos son aproximados.
