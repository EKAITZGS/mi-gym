# Auditoría MI-GYM → MI-GYM 2.0

Fecha: 2026-11-14 · Rama de trabajo: `migym-2.0` (desde `main` @ `4ddcd48`). Producción (`main` → GitHub Pages) no se toca hasta validar.

Método: lectura del código real (no del README), `npm ci && npm run build && npm test` en limpio, revisión de `vite.config.js`, workflow de Pages, `supabase/*.sql` y `cloudflare/worker.js`. Lo que no se ha podido verificar por falta de credenciales está marcado como **no verificado**.

---

## 1. Arquitectura actual (real)

| Capa | Qué hay | Estado |
|---|---|---|
| Frontend | React 18 + Vite 5, JSX sin TypeScript, un solo `styles.css` (2035 líneas) con tokens en `:root`. Sin router: pestañas por estado (`App.jsx`), modales por portal. | Funciona. Build OK (3,4 s). |
| PWA | `vite-plugin-pwa` 0.21 (Workbox `generateSW`, `autoUpdate`, `skipWaiting`, `clientsClaim`), `importScripts: push-sw.js`. Precaché 25 entradas (1,8 MB); fotos de ejercicios en runtime cache `ex-fotos` (CacheFirst, 500 entradas). `base: './'`. Splash propio en `index.html`. | Funciona. Icono iOS pendiente de confirmar (caché). |
| Datos locales | `localStorage['migym.v1']` = documento único (`DEFAULT` en `store.js`). Fotos en IndexedDB `migym-photos`. Preferencias de dispositivo fuera del documento: `migym.polar`, `migym.push`, `migym.groqkey/groqmodel`, `migym.rest`, `migym.restOn`, `migym.aisrv`, `migym.cloud`, `migym.sb`, `migym.lastUid`, `migym.dev.<uid>`. | Funciona. **Sin versionado real** (`v: 1` fijo, sin migraciones). |
| Nube | Supabase (`fsantamxmriodlriantf`). Tablas `profiles`, `user_data` (jsonb = todo `migym.v1`), `coach_links`, `coach_messages`, `coach_workouts`. RLS en todas. Trigger `handle_new_user`. Clave *publishable* en el cliente (pública por diseño). | Esquema revisado en SQL. **No verificado** contra el proyecto real (sin acceso). |
| Auth | Supabase Auth email+contraseña, confirmación por email, recuperación de contraseña (`NewPassword`), `AuthGate` obligatorio al abrir. Roles `user`/`trainer`. | Funciona según código. |
| Worker Cloudflare | `mi-gym-polar`: OAuth Polar (`/auth`, `/callback`), proxy AccessLink (`/exercises`, `/exercise`, `/activities`, `/sleep`, `/recharge`, `/polar/off`), Web Push con VAPID en KV (`/push/*`, cron 5 min), proxy IA Groq (`/ai`, 30/día/IP, solo `Origin` de la app). Secretos: `POLAR_CLIENT_SECRET`, `GROQ_KEY`. | Código revisado. **No verificado** desplegado (sin acceso a Cloudflare). Se despliega a mano. |
| IA | Groq (`qwen/qwen3.8-27b` por defecto) vía Worker o clave propia del usuario (solo en el móvil, no en copias). Usos: foto de comida, etiqueta, chat del entrenador, mejorar plan, "Dieta del día". | Funciona si el Worker tiene `GROQ_KEY`. |
| Despliegue | `.github/workflows/deploy.yml`: push a `main` → `npm ci && npm run build` → Pages. | Funciona. |
| Tests | `npm test` (esbuild + node: plans, stats, aim, coach, sleep) → **pasan**. `tests/*.py` Playwright: **rotos** (esperan `.tabbar` sin sesión; desde `AuthGate` obligatorio no se puede entrar sin cuenta; rutas de Chrome/capturas de otro entorno). Sin lint. | Parcial. |

---

## 2. Inventario funcional

### Implementado y operativo
- **Inicio**: saludo, fecha, entreno del día / "Hecho hoy", descanso con otros días, `SleepLine`, recomendaciones del coach (`WeeklyReview`), entrenos del reloj de hoy, anillos pasos/kcal, proteína que falta, resumen semanal (racha, kg, tiempo, puntos de la semana). Bienvenida (`GoalCalc` → `PlanMaker`).
- **Entreno**: semana con ✓ y `DayModal`; días del plan (`daycard`), editor de día con borrador + guardar + `editGuard`; biblioteca (873 ejercicios, búsqueda, grupos, favoritos, ejercicios propios); generador paso a paso (`Generator`: nivel, días, minutos, reparto por día, material, foco, sorpréndeme, rehacer día/ejercicio, `PlanVolume`); sesión activa (peso de referencia y **reps vacías**, drop sets, unilateral izq/der con desequilibrio, tracks tiempo/distancia/cardio, notas, cambiar/añadir/quitar ejercicio, temporizador de descanso ±15 s persistido en `active.rest`, sugerencia de subir/mantener peso, dolor previo, descarga); fin con check-in (sensación, sueño, RIR por ejercicio, molestia, nota) y resumen (min, series, kg, récords reales, comparación con la última vez, guardar cambios en el plan).
- **Dieta**: comidas, alimentos propios, favoritos, repetir ayer, escáner (zxing + Open Food Facts), foto IA, `EnergyCard` (balance con el reloj), `DayPlan` IA.
- **Progreso**: `AimCard` (objetivo definir/recomposición/ganar), `RankCard` + maniquí por capas, `MuscleSets` (directas + indirectas ×½), récords 30 días y estancados, sueño, cuerpo (peso, cintura, fotos frontal/lateral), fuerza por ejercicio con `TrendChart`, resumen del mes.
- **Cuenta**: menú con inicial, perfil, entrenador/alumnos (`Trainers.jsx`, `CoachTools.jsx`: mensajes, mandar entrenos, proponer cambios con `diffDay`/`applyChanges`, pulso del alumno), ajustes (descanso, objetivos, avisos push, Polar, IA, exportar/importar JSON, borrar).
- **Polar**: conexión, sync automática al abrir/volver/5 min, entrenos con curva de pulso y zonas, pasos/kcal, sueño y recarga; desconexión da de baja en Polar.

### Incompleto o mejorable (sin romper nada)
- Navegación: 4 pestañas + inicial. No existe pestaña "Rutinas" ni "Perfil" (Perfil vive en el menú). Sin layout de escritorio (solo `max-width` 350/360 px).
- Entreno activo: no hay temporizador de descanso con **pausar/reanudar/omitir** (solo ±15 s y cerrar); no hay indicador de estado de guardado/sincronización en pantalla; `active` sin `items` propios en entrenos antiguos (se cubre con `day.items`).
- Generador: no pregunta objetivo (hipertrofia/fuerza), favoritos/excluidos ni limitaciones; permite reparto por día (sí semanas asimétricas), pero el análisis es solo volumen (sin frecuencia/solapamiento/duración estimada).
- Progreso: no hay mapa muscular **frontal y posterior** con filtro semana/mes (el maniquí es una sola vista de rangos); no hay historial por ejercicio con filtros; "estancado" = 3 entrenos sin mejorar 1RM (no distingue variación normal).
- Biblioteca: fichas sin errores frecuentes/variantes (hay técnica por patrón de id en `technique.js`); no hay ordenación.
- Entrenador IA: el contexto es un resumen (`summarize`), no responde con cifras exactas de "cuántas veces entrené pecho esta semana" salvo que el modelo lo infiera.
- Copias: `load()` valida la forma pero **no versiona ni migra**; `{...DEFAULT, ...obj}` hace merge superficial (objetos anidados como `goals` se sustituyen enteros).

### Roto / deuda
- `tests/*.py` no pueden pasar (AuthGate) y usan rutas de otra máquina.
- Sin `lint`, sin TypeScript, sin pruebas de UI.
- `exercises.js` (15 579 líneas, 676 kB minificado / 180 kB gz) entra en el bundle principal → aviso de chunk > 500 kB.
- `README.md` describe la versión sin cuentas ("Sin servidor, sin cuentas"); desactualizado frente a Supabase/AuthGate.
- Estilos inline dispersos (`style={{…}}` ×~70) y clases de pantalla sin sistema de componentes documentado.

---

## 3. Modelo y ubicación de datos

### Documento `migym.v1` (local + `user_data.data`)
```
v: 1
goals: { kcal, protein, steps?, aim? ('lose'|'keep'|'gain'), auto?, today? {date,kcal} }
plan: [ { id, name, weekday (0-6|null), items: [ { id, ex, sets, reps, drop, rir?, rest?, uni?, track? } ], fromTrainer? } ]
active: null | { dayId, name, date, start, items, entries: { exId: [set] }, notes?, rest? {end,item} }
sessions: [ { id, date, dayId, dayName, entries: { exId: [ { w, r, rl?, rr?, s?, m?, km?, min?, drops: [{w,r}] } ] }, notes?, min?, checkin? {feel, rir, pain, note, sleep} } ]
food: { 'YYYY-MM-DD': [ { id, meal, name, grams, kcal, p, c, f, label } ] }
myFoods: [], myExercises: [ { id:'c-…', name, group, track? } ], favEx: [ids], uniEx: { exId: bool }
body: { weight: [{date,kg}], waist: [...], photos: [{id,date,pose}] }   (fotos en IndexedDB)
polar: { lastSync, exercises: {id: {...hr, zones}}, days: {date:{kcal,active,steps}}, sleep: {}, recharge: {}, actErr? }
sleepFix: { date: {start,end} }, pushPrefs: {...}, setupDone: bool
```
- **Identificadores estables**: `ex` = id de free-exercise-db (p. ej. `Barbell_Bench_Press_-_Medium_Grip`) o `c-<uid>` para propios. Nunca se renombran; los históricos (`sessions.entries`) van por ese id. **Se conservan íntegros.**
- **Fuente de verdad**: el móvil (`localStorage`). La nube es copia con "último en escribir gana" por documento completo; el conflicto al entrar lo decide el usuario; los descartes se guardan en `migym.v1.antes-nube` / `migym.v1.nube-anterior` / `migym.v1.borrado` / `migym.v1.bak`.
- **Sincronización**: `useCloudSync`: sube a los 3 s de cada cambio, baja al abrir/volver/online si `updated_at` de la nube es más nuevo y no hay cambios locales sin subir. No hay merge por entidad → **riesgo de pisar un entreno hecho en otro dispositivo** si los dos cambian antes de sincronizar (se guarda copia, pero no se fusiona).
- Entrenos: id `uid()` (7 chars base36, aleatorio); `sessions` es un array → duplicados posibles solo por import manual.

### Fuera del documento (por dispositivo)
`migym.polar` (token Polar), `migym.push`, `migym.groqkey`, `migym.rest*`, `migym.cloud`, `migym.sb` (sesión Supabase), IndexedDB de fotos.

---

## 4. Integraciones y dependencias
- `@supabase/supabase-js` 2.x (carga perezosa), `@zxing/*` (escáner), React 18, Vite 5, `vite-plugin-pwa` 0.21. Fuentes Inter + Montserrat **autohospedadas** (`src/fonts/*.woff2`). Sin librería de gráficos (SVG propio en `ui.jsx`).
- Externas en runtime: Supabase, Worker Cloudflare (Polar, push, IA), Groq directo (si clave propia), Open Food Facts, servicios push de Apple/Google/Mozilla (desde el Worker).
- Node 22 en CI.

---

## 5. Riesgos
| # | Riesgo | Gravedad | Mitigación propuesta |
|---|---|---|---|
| R1 | Cambiar la forma de `migym.v1` sin migración rompe datos reales del iPhone. | Alta | Fase 1: `migrate(data)` versionado e idempotente; todo cambio de esquema aditivo; tests de migración. |
| R2 | Sync "documento entero gana" puede pisar entrenos entre dispositivos. | Media | Fase 1: antes de aplicar la nube, fusionar `sessions`/`body`/`food` por id/fecha (unión), y conservar la política actual para el resto. |
| R3 | Entrenador puede leer **todo** `user_data` del alumno (dieta, sueño, fotos no, peso sí) vía API. | Media (privacidad) | Fase 1 (SQL, requiere aprobación): vista/función `student_view(uid)` que devuelva solo plan, entrenos, cuerpo y pulso; sustituir la policy de lectura. **No se aplica sin tu OK.** |
| R4 | Tests Playwright rotos → regresiones de UI no detectadas. | Media | Fase 1/9: modo `VITE_SB_URL=""` para pruebas sin cuenta (ya soportado por `cloudReady()`), rutas relativas. |
| R5 | Bundle grande (exercises.js en el chunk principal). | Baja | Fase 9: chunk separado / carga perezosa de `more: true`. |
| R6 | `Origin` como única protección del `/ai` del Worker. | Baja (ya limitado por IP/día) | Documentar; opcional token de app. Tocar Cloudflare requiere aprobación. |
| R7 | README desactualizado puede inducir a "simplificar" quitando cuentas. | Baja | Actualizar README (Fase 0/9). |

---

## 6. Deuda técnica
- Sin versionado de esquema ni migraciones; merge superficial con `DEFAULT`.
- Estilos: tokens correctos ya en `:root` (paleta exacta: `#0B0B0B`, `#1A1A1A`, `#2E2E2E`, `#A3FF12`, `#F5F5F5`, `#9CA3AF`; Montserrat/Inter), pero sin capa de componentes documentada; ~70 estilos inline; sin breakpoints de tablet/escritorio.
- `Workout.jsx` (1600 líneas) mezcla biblioteca, generador, editor, check-in y sesión.
- Sin lint ni formateo automatizado.
- Python tests con rutas absolutas de otra máquina.
- `active` antiguo puede no tener `items`/`start` (ya tolerado por el código).

---

## 7. Propuesta de migración (segura)
1. **Versionado**: `store.js` gana `SCHEMA = 2` y `migrate(raw)` que aplica pasos `1→2…` idempotentes; cada paso solo **añade** campos (nunca borra ni renombra). Antes de migrar se guarda `migym.v1.pre-<v>` una vez. Lo mismo al importar una copia y al bajar de la nube.
2. **Merge profundo con `DEFAULT`** para `goals` y objetos anidados (sin perder claves nuevas).
3. **Fusión de colecciones al bajar de la nube** cuando hay cambios en ambos lados: unión de `sessions` por `id`, `body.weight/waist` por fecha, `food` por fecha+id; el resto sigue la política actual (y la copia aparte se mantiene).
4. **Copia de seguridad**: exportación ya existe; se añade `schema`, `exportedAt` y validación por versión al importar (acepta copias antiguas y las migra).
5. **Sin cambios en Supabase ni Cloudflare** salvo R3 (propuesta separada, con tu aprobación).
6. Pruebas: migración desde fixtures reales (v1 con/ sin `body`, `polar`, `active` antiguo), import/export ida y vuelta, fusión sin duplicados.

---

## 8. Plan por fases y criterios de aceptación

| Fase | Contenido | Aceptación |
|---|---|---|
| 0 | Auditoría (este documento), rama `migym-2.0`, build y tests en verde. | ✅ Hecho. |
| 1 | Migraciones versionadas, merge profundo, fusión de `sessions`/cuerpo/comida al sincronizar, import con versión, tests de migración y restauración; arreglar tests Playwright (modo sin nube). Propuesta SQL R3 **sin aplicar**. | `npm test` con nuevos tests; copia v1 real se abre sin pérdida; no duplica entrenos. |
| 2 | Sistema de diseño: tokens completos (espaciado, radios, sombras, tipografía), componentes base (`Button`, `Card`, `Field`, `Badge`, `Empty`, `Skeleton`), estados vacío/carga/error/offline; breakpoints tablet/escritorio; reducir inline styles. Logo oficial en splash/ajustes (ya existe). | Sin regresión visual en iPhone; build OK. |
| 3 | Navegación 5 pestañas (Inicio, Entrenamiento, Rutinas, Progreso, Perfil) móvil + barra lateral en escritorio; Dashboard con CTA **COMENZAR ENTRENAMIENTO** (continuar / programado / otra rutina / libre), último entreno, volumen, tiempo, racha, récords, recuperación si hay datos. Biblioteca, dieta, sueño, IA y ajustes accesibles desde Rutinas/Progreso/Perfil. | Todo botón hace algo; sin cifras inventadas. |
| 4 | Entreno activo: cabecera con cronómetro y estado de guardado, temporizador con pausar/reanudar/omitir/añadir, grupo/secundarios/material/técnica en la tarjeta, serie por tipo (normal/drop/calentamiento), resumen final con PR comprobado y comparación. Regla de reps vacías intacta. | Tests de `prefillSets` y `finish`; offline total. |
| 5 | Generador conversacional: objetivo, experiencia, días, minutos, material, prioridades, favoritos/excluidos, limitaciones, "Sorpréndeme"; análisis de volumen, frecuencia, solapamiento, duración; resumen editable antes de guardar; preferencias permanentes separadas (`prefs.gen`). | Tests de `plans.js` ampliados. |
| 6 | Progreso: entrenos/tiempo/volumen semana y mes, historial por ejercicio, mejores marcas, PRs, comparación de sesiones, tendencia con "datos insuficientes"; mapa muscular frontal/posterior con filtro semana/mes y leyenda (directas vs indirectas). | Solo datos reales; método explicado. |
| 7 | Biblioteca (filtros material/tipo, ordenación, fichas), nutrición (estimado vs verificado), sueño/recuperación (medido vs subjetivo), Polar intacto. | Sin cambios en Worker. |
| 8 | Entrenador IA con contexto numérico exacto (semana, volumen por grupo, ejercicios hechos), confirmación antes de cambios; Perfil (datos, objetivos, cuerpo, fotos, cuenta y dispositivos). | Respuestas citan periodo y datos. |
| 9 | Accesibilidad (focus, aria, contraste, áreas táctiles ≥44 px), rendimiento (chunk de ejercicios), tests, README, guía de despliegue y rollback. | Lighthouse a11y ≥ 90 en local; build y tests OK. |

**Despliegue**: solo cuando tú lo valides en el iPhone desde la rama (`npm run build` + preview) y lo autorices: merge a `main` → Pages. Rollback: `git revert` del merge (datos no cambian de forma incompatible gracias a migraciones aditivas).

---

## 9. No verificado (sin credenciales)
- Que el esquema real de Supabase coincide con `supabase/*.sql` (orden 01→04 ejecutados).
- Que el Worker desplegado es `cloudflare/worker.js` actual (`v7`) con `GROQ_KEY` y KV `PUSH` configurados.
- Comportamiento de push en iOS (requiere instalación en pantalla de inicio).
- Icono del iPhone.

---

## 10. Estado de la ejecución (rama `migym-2.0`)

| Fase | Estado | Commit |
|---|---|---|
| 0 Auditoría | ✅ | `115ed3d` |
| 1 Datos: migraciones v2, copia previa, fusión de entrenos, import validado, modo sin nube para pruebas | ✅ | `93a4775` |
| 2-3 Sistema de diseño, 5 pestañas, escritorio, Inicio con CTA, hoja de inicio, aviso sin conexión | ✅ | `d0519b7` |
| 4 Entreno activo (cronómetro, descanso con pausa/omitir, badges/técnica, calentamientos, estado de guardado) | ✅ | `8ae2853` |
| 5 Generador conversacional (objetivo, limitaciones, exclusiones, favoritos, resumen editable, análisis) | ✅ | `9db5ea8` |
| 6 Progreso (cifras, mapa muscular frente/espalda, historial y lectura del progreso) | ✅ | `dd0eb9a` |
| 7-8 Biblioteca, dieta (≈/✓), sueño (medido/subjetivo), entrenador IA con hechos exactos, chunk de ejercicios | ✅ | `4daff5b` |
| 9 Accesibilidad (zoom, diálogo, teclado, estados), rendimiento, documentación | ✅ | este commit |

### Pruebas ejecutadas
- `npm test`: 10 suites en verde (plans, plans 2.0, stats, stats 2.0, coach facts, rest tips, sleep, aim, migrate, sets).
- Navegador (Chromium, 390×844 y 1280×860): `tests/test_session2.py` (regla de reps vacías, descanso con pausa/omitir, calentamiento, récord comprobado, guardado sin `active`), `tests/test_generator2.py` (objetivo fuerza, zona a evitar, ejercicio excluido, series ±, guardado con `prefs.gen`), `tests/shots.py` (todas las pestañas + hoja de inicio + sesión). En verde. Los dos errores de consola que aparecen en la nube son `ERR_TUNNEL_CONNECTION_FAILED` al Worker (sin salida a internet en el entorno de pruebas), no fallos de la app.
- **No probado con credenciales reales** (pendiente en el iPhone): Supabase (login, sincronía en dos móviles, fusión real), Polar, push, IA del Worker.

### Lo que no cambia (y no hace falta configurar nada)
- Supabase, Cloudflare Worker, Polar, push, esquema SQL: **sin cambios**. No hay variables ni secretos nuevos.
- Forma de los datos: solo campos aditivos (`v: 2`, `prefs.gen`, `set.warm`, `active.rest.left`, `food[].src`). Una versión anterior de la app sigue leyendo estos datos.

### Riesgos conocidos
- Cambio de navegación: lo que antes estaba en la pestaña Entreno ahora se reparte entre Entrenamiento y Rutinas; Dieta se abre desde Inicio. Es lo que pide el prompt maestro; si en el uso real molesta, se puede devolver Dieta a la barra en 1 línea (`TABS` en App.jsx).
- `mergeData` une entrenos por id al resolver conflictos: nunca borra un entreno, pero tampoco propaga un borrado (hoy la app no permite borrar entrenos, así que no aplica).
- R3 de la auditoría (el entrenador puede leer todo el `user_data` del alumno vía API) sigue pendiente: requiere SQL en Supabase y tu aprobación. Propuesta: vista/función que exponga solo `plan`, `sessions`, `body` y `polar.exercises`.
- Tests Playwright antiguos (`tests/test_*.py` salvo los nuevos) siguen escritos para la UI anterior.

### Despliegue propuesto
1. Probar la rama en el iPhone (p. ej. `npm run build` y servir `dist/`, o un despliegue de prueba) con tu cuenta real.
2. Si todo bien: merge `migym-2.0` → `main` (Actions publica). Antes, exportar una copia desde Perfil → Ajustes.
3. Rollback: `git revert -m 1 <merge>` y push a `main`; los datos no necesitan deshacerse (migraciones aditivas y copia `migym.v1.pre-2` en el móvil).
