# Mi Gym — contexto para Claude Code

App personal (PWA) de gimnasio y dieta de Ekaitz para su iPhone. Español en toda la interfaz y las respuestas.
El peso se muestra solo como tendencia (media de los últimos 3 pesajes), nunca pesos sueltos; el usuario se pesa como mucho 1 vez por semana. Datos en `body.weight` = [{date, kg}]. Objetivos de kcal/proteína en `goals`. Reloj Polar.
Prefiere respuestas cortas, directas y sinceras. Las propuestas del coach nunca se aplican solas: él acepta o rechaza.

## Stack
- React 18 + Vite 5 + vite-plugin-pwa (Workbox, `registerType: autoUpdate`, `importScripts: ['push-sw.js']`).
- Datos en `localStorage` clave `migym.v1` (ver `src/store.js` → `DEFAULT`). Fotos de progreso en IndexedDB (`src/photos.js`).
- Despliegue: push a `main` → GitHub Actions → GitHub Pages (https://ekaitzgs.github.io/mi-gym/). `base: './'`.
- **Nunca** cambiar la forma de los datos sin migrar: el usuario tiene datos reales en el móvil.

## Ficheros clave
- `src/App.jsx` pestañas, vuelta automática a entreno en curso, sincronización Polar y de avisos.
- `src/Workout.jsx` biblioteca, editor de día (borrador + Guardar + confirmación al salir, `editGuard`), sesión (unilateral izq/der, drops), check-in.
- `src/Home.jsx` Hoy: entreno del día / "Hecho hoy", reloj Polar (pasos + detalle con curva de pulso), proteína que falta, series por músculo, cintura y fotos.
- `src/Diet.jsx` dieta (escáner, foto IA con Groq, repetir de ayer, comidas favoritas).
- `src/coach.js` revisión semanal (propone, nunca aplica solo) + IA; usa datos del reloj (`polarWeek`).
- `src/polar.js` + `src/PolarSession.jsx` Polar AccessLink vía el Worker. Polar devuelve campos en snake_case (`sample_type`, `heart_rate_zones` con `lower_limit`, índices de zona desde 0): el parser acepta ambos formatos.
- `src/push.js` + `src/PushCard.jsx` + `public/push-sw.js` avisos Web Push.
- `src/Rank.jsx` + `src/ranks.js` + `src/Mannequin.jsx` "Tu personaje": rangos Hierro→Diamante por músculo (7 grupos + Antebrazo) según fuerza real (1RM est./peso corporal); los músculos secundarios de cada ejercicio cuentan (×0,7 en rangos, ½ en series por músculo; `groupsOf` en ranks.js); simetría izq/der. El maniquí es una imagen generada por IA separada en capas por grupo (`public/body/mask-*.png`, `base.png`, `edge.png`); fuente y script en `assets-src/`.
- `src/store.js` `suggestion()` subida de peso (RIR + doble progresión; en pesos libres máx. ~12 %).

## Cloudflare Worker (`cloudflare/worker.js`)
- URL: https://mi-gym-polar.ekaitzmartinezm.workers.dev (cuenta Cloudflare de Ekaitz, worker `mi-gym-polar`).
- Variables: `POLAR_CLIENT_ID` (texto), `POLAR_CLIENT_SECRET` (secreto, lo pone el usuario). KV binding `PUSH` (namespace `mi-gym-push`). Cron cada 5 min (`scheduled` → `tick`).
- Rutas: `/auth`, `/callback`, `/exercises`, `/exercise?id=`, `/activities`, `/push/key|sync|test|next|off`.
- Push sin payload: el cron manda un "toque" firmado con VAPID (claves generadas por el worker y guardadas en KV) y `push-sw.js` pide el texto a `/push/next`.
- El editor web de Cloudflare no acepta pegar por API (WAF); se despliega escribiendo el código en el editor o con `wrangler deploy` si se configura.

## Forma de trabajar (acordada con el usuario)
Él prueba directamente en el iPhone; no abrir vistas previas en el PC ni pedirle que mire nada ahí. Tras cada cambio:
1. `npm run build`; si falla, arreglar antes de seguir.
2. Prueba rápida si se puede, sin abrir previews.
3. Commit y push a `main` sin preguntar (Actions publica en ~2 min).
4. Decirle en 2–3 líneas qué cambió y que cierre y abra la app en el iPhone.
Si algo falla en el móvil, él manda captura y se arregla igual. **Preguntar antes** si el cambio puede borrar o estropear datos guardados, o si hay que tocar Cloudflare.

## Pruebas
`tests/*.py` (Playwright con Chrome) contra `npx vite preview --port 4173`. Ejecutar las relevantes antes de publicar.
Ojo: los scripts se escribieron en otro entorno; usan `executable_path='/usr/bin/google-chrome'` y guardan capturas en `/home/claude/shots/`. Ajusta rutas si no existen.

## Pendiente / ideas
- Icono del iPhone mostraba "M" (caché de iOS). Último intento: repo `EKAITZGS/EKAITZGS.github.io` con `apple-touch-icon*.png` en la raíz del dominio y un `index.html` que redirige a `/mi-gym/`. Pendiente de que el usuario confirme tras reinstalar la app.
- Versión multiusuario para amigos (Supabase) — más adelante.
