# MI-GYM

App web (PWA) de musculación: rutinas, entreno en curso, progresión de cargas, progreso por músculo, dieta y recuperación. Pensada para el iPhone (añadir a pantalla de inicio) y usable también en tablet y escritorio.

Producción: https://ekaitzgs.github.io/mi-gym/ (rama `main` → GitHub Actions → GitHub Pages).
Versión 2.0 en desarrollo en la rama `migym-2.0` (ver `AUDIT_MI_GYM_2_0.md`).

## Qué hace
- **Inicio**: saludo, entreno de hoy y siguiente sesión, botón **Comenzar entrenamiento** (continuar el que está a medias, el programado, otra rutina o uno libre), cifras de la semana (entrenos, tiempo, volumen, racha), último entreno, récords de la semana, sueño, recomendaciones, reloj y dieta de hoy.
- **Entrenamiento**: semana con lo hecho (✓), rutina de hoy, últimos entrenos con detalle (series, RIR, pulso del reloj), entreno libre y chat con el entrenador.
- **Entreno en curso**: peso de referencia de la última vez con las **repeticiones siempre vacías**, series de calentamiento (no cuentan en volumen ni récords), drop sets, unilateral izq/der, series por tiempo/distancia/cardio, notas, cronómetro, descanso con pausar / reanudar / omitir / ±15 s, sugerencia de subir o mantener peso, técnica y músculos de cada ejercicio, estado de guardado. Al terminar: duración, ejercicios, series, kg, récords comprobados contra el histórico, comparación con la última vez y check-in.
- **Rutinas**: tus días (editor con borrador y guardar), **generador paso a paso** (objetivo hipertrofia / fuerza / recomposición / salud, nivel, días —también semanas desiguales—, tiempo, reparto por día, material, músculo a priorizar, molestias y ejercicios a evitar, favoritos con prioridad, «Sorpréndeme») con resumen editable y análisis de volumen efectivo, frecuencia, solapamiento, multiarticulares y duración; biblioteca de 873 ejercicios con fotos, búsqueda, filtros por grupo y material, orden y favoritos; mejorar la rutina con IA.
- **Progreso**: cifras del mes y consistencia, objetivo (definir / recomposición / ganar músculo) con control de peso, cintura y fotos, rangos por músculo («Tu personaje»), **mapa muscular frontal y posterior** por semana / 4 semanas / mes (series directas e indirectas, frecuencia), récords y estancados, sueño, cuerpo e historial por ejercicio con lectura honesta del progreso (más peso, más reps, más volumen, estable, bajón o pocos datos).
- **Perfil**: cuenta, reloj Polar, entrenador / alumnos, ajustes (objetivos, descanso, avisos, IA, copias de seguridad) y tu cuerpo.
- **Dieta** (desde Inicio): calorías y macros por comida, escáner de código de barras (Open Food Facts), foto del plato con IA (opcional), balance con el reloj y «Dieta del día». Los valores marcan si son estimados (≈) o de etiqueta (✓).
- **Reloj Polar** (opcional): entrenos con pulso y zonas, pasos y calorías, sueño y recarga nocturna.
- **Cuentas y nube**: Supabase (email + contraseña). Los datos viven en el móvil y se guardan en la cuenta; se pueden exportar e importar en JSON. Entrenadores: solicitudes, mensajes y entrenos propuestos que el alumno acepta o rechaza.

## Datos y seguridad
- Documento `migym.v1` en `localStorage` (versionado: `v`, migraciones aditivas en `src/migrate.js`; antes de migrar se guarda `migym.v1.pre-<v>`). Fotos de progreso en IndexedDB, solo en el móvil.
- Nube: tabla `user_data` (un JSON por usuario) con RLS. Al sincronizar nunca se pierde un entreno: si hay cambios en los dos sitios, las sesiones se unen por id.
- Secretos (Polar, Groq) solo en el Worker de Cloudflare. La clave *publishable* de Supabase es pública por diseño.

## Desarrollo
```
npm install
npm run dev                      # servidor local
npm run build                    # genera dist/
npm test                         # lógica: generador, estadísticas, migraciones, series, entrenador
VITE_CLOUD=off npm run build && npx vite preview --port 4173   # app sin cuentas para pruebas de navegador
CHROME=/ruta/a/chrome python3 tests/test_session2.py           # entreno activo (Playwright)
CHROME=/ruta/a/chrome python3 tests/test_generator2.py         # generador
CHROME=/ruta/a/chrome python3 tests/shots.py                   # capturas móvil y escritorio en tests/shots/
```

## Despliegue y vuelta atrás
- Publicar: merge a `main` → Actions construye y publica en Pages (~2 min). Base `./`, manifest `manifest-v4.webmanifest`.
- Rollback: `git revert` del merge (o volver a la etiqueta anterior) y push a `main`. Las migraciones de datos son aditivas, así que una versión anterior sigue leyendo los datos; además queda la copia `migym.v1.pre-<v>` en el móvil.

## Créditos
Fotos de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público). Productos de súper: [Open Food Facts](https://world.openfoodfacts.org). Los valores de la lista de alimentos son aproximados.
