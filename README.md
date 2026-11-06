# Mi Gym

App web (PWA) para planes de entreno, ejercicios con fotos y calorías/proteína.
Sin servidor, sin cuentas: **los datos se guardan en el propio móvil** de cada persona.

## Qué hace
- **Entreno:** plan por días y por día de la semana, totalmente editable. Generador automático de plan (3 a 7 días).
- **Series con peso y reps**, con "última vez" de cada ejercicio y **drop sets** (10 kg → 5 kg al fallo).
- **Progreso:** gráfica de fuerza (1RM estimado) y volumen por ejercicio, aviso de récord al terminar el entreno y resumen en la pantalla Hoy.
- **Sugerencia de subir peso** (doble progresión): si la última vez llegaste al tope de reps en todas las series, te propone el siguiente peso.
- **66 ejercicios con fotos** + ejercicios propios.
- **Dieta:** calorías y proteína por comida, lista de alimentos básicos, **escáner de código de barras con la cámara** (productos de súper vía Open Food Facts, necesita conexión), búsqueda por nombre y alimentos propios. Escaneas, pones los gramos (o raciones) y calcula las calorías.
- **Foto del alimento con IA (opcional, Groq):** haces una foto, la IA propone qué es y sus valores por 100 g, tú los revisas y pones los gramos. Necesita una clave gratuita de Groq (console.groq.com) en Ajustes. La clave se guarda solo en el móvil y no entra en las copias.
- **Copia de seguridad** (exportar/importar JSON). Sin báscula ni pesaje.

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
```

## Créditos
Fotos de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público).
Productos de súper: [Open Food Facts](https://world.openfoodfacts.org). Los valores de la lista de alimentos son aproximados.
