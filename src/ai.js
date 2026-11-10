import { POLAR_WORKER } from './polar'

// IA con Groq. Con clave propia (Ajustes) se llama directo; sin clave, a través del Worker
// (la clave vive allí como secreto, con límite diario por persona).
// La clave propia se guarda aparte en localStorage (no entra en las copias de seguridad).
const KEY = 'migym.groqkey'
const MODEL = 'migym.groqmodel'
export const DEFAULT_MODEL = 'qwen/qwen3.8-27b'

export const getAi = () => {
  try {
    return { key: localStorage.getItem(KEY) || '', model: localStorage.getItem(MODEL) || DEFAULT_MODEL }
  } catch {
    return { key: '', model: DEFAULT_MODEL }
  }
}
// Quita espacios, saltos de línea, comillas y caracteres invisibles que se cuelan al copiar en el móvil
export const cleanKey = (k) => String(k || '').replace(/[\s\u200B-\u200D\uFEFF"'“”‘’]/g, '')

export const setAi = ({ key, model }) => {
  try {
    localStorage.setItem(KEY, cleanKey(key))
    localStorage.setItem(MODEL, (model || '').trim() || DEFAULT_MODEL)
  } catch {}
}

const SRV = 'migym.aisrv'
export const serverAi = () => {
  try {
    return localStorage.getItem(SRV) === '1'
  } catch {
    return false
  }
}
export const hasAi = () => !!getAi().key || serverAi()
// Al abrir la app: ¿el Worker tiene la IA activada? (se recuerda para no preguntar en cada pantalla)
export async function checkServerAi() {
  try {
    const j = await (await fetch(POLAR_WORKER + '/ai')).json()
    localStorage.setItem(SRV, j.ok ? '1' : '0')
  } catch {}
}

// Una llamada de chat; devuelve el texto de la respuesta sin el bloque <think>
export async function groqChat(body) {
  const { key, model } = getAi()
  if (!key && !serverAi()) throw new Error('NO_KEY')
  let res
  try {
    res = key
      ? await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, ...body }),
        })
      : await fetch(POLAR_WORKER + '/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('No se pudo conectar con la IA (¿sin conexión?)')
  }
  if (!res.ok) {
    if (key && res.status === 401) throw new Error('La clave de Groq no es válida')
    if (res.status === 429)
      throw new Error(key ? 'Has llegado al límite de Groq. Prueba más tarde' : 'Has usado mucho la IA hoy. Vuelve mañana o pon tu propia clave gratis de Groq en Ajustes')
    if (key && (res.status === 404 || res.status === 400)) throw new Error(`Groq rechazó la petición (${res.status}). Revisa el nombre del modelo en Ajustes`)
    if (!key && res.status === 503) {
      try {
        localStorage.setItem(SRV, '0')
      } catch {}
      throw new Error('NO_KEY')
    }
    throw new Error(`Error de la IA (${res.status})`)
  }
  const j = await res.json()
  return (j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '')
}

async function resizeImage(file, max = 768) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}

const PROMPT = (portion) => `Eres un nutricionista que analiza fotos de comida para calcular calorías y macros.

PASOS
1. Identifica cada alimento de la foto y estima su peso o volumen total.
2. Lee cuánto se ha comido el usuario realmente (dato PORCIÓN). Puede venir como porcentaje (50%), fracción (la mitad), gramos, unidades ("12 pipas") o una frase ("me dejé un cuarto").
3. Calcula SOLO sobre lo comido: total estimado × porción.
4. Si no hay dato de porción, asume que se ha comido todo y dilo explícitamente en "supuestos".
5. Si el envase tiene etiqueta nutricional visible, usa esos valores por encima de tu estimación.

REGLAS
- No inventes datos: si algo no se ve claro, dilo en "supuestos".
- Para envases (pipas, galletas...) distingue entre peso del paquete y peso comestible (sin cáscara).
- Para un paquete, calcula por lo que falta del paquete, no por lo que contiene al inicio.
- kcal y macros de cada alimento son los de la cantidad COMIDA (comido_g), no por 100 g.
- Nombres cortos en español, indicando crudo o cocinado si importa.

PORCIÓN: ${portion ? portion : 'no indicada'}

Responde SOLO con este JSON, sin texto extra:
{"alimentos": [{"nombre": "", "total_g": 0, "comido_g": 0, "kcal": 0, "proteina_g": 0, "carbos_g": 0, "grasa_g": 0}], "total_kcal": 0, "supuestos": "", "confianza": "alta|media|baja"}
Si no hay comida en la foto, devuelve "alimentos": [].`

export async function analyzeFood(file, portion = '') {
  if (!hasAi()) throw new Error('NO_KEY')
  const dataUri = await resizeImage(file)
  const txt = await groqChat({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT(String(portion || '').trim().slice(0, 120)) },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_completion_tokens: 1200,
  })
  let o
  try {
    o = JSON.parse(txt)
  } catch {
    const m = txt.match(/\{[\s\S]*\}/)
    try {
      o = JSON.parse(m?.[0] || '')
    } catch {
      throw new Error('No entendí la respuesta de la IA, prueba otra foto')
    }
  }
  const n = (v) => Math.max(0, Number(String(v).replace(',', '.')) || 0)
  const items = (Array.isArray(o.alimentos) ? o.alimentos : [])
    .map((x) => ({
      name: String(x.nombre || 'Alimento').slice(0, 80),
      total: n(x.total_g),
      g: n(x.comido_g),
      kcal: n(x.kcal),
      p: n(x.proteina_g),
      c: n(x.carbos_g),
      f: n(x.grasa_g),
    }))
    .filter((x) => x.kcal > 0 || x.g > 0)
  if (!items.length) throw new Error('No he reconocido comida en la foto, prueba otra')
  return { items, assumptions: String(o.supuestos || '').slice(0, 400), conf: o.confianza || 'media' }
}

const LABEL_PROMPT = `Esta foto es la tabla de información nutricional de un producto envasado.
Lee los valores POR 100 g (o por 100 ml). Si solo aparece por ración, conviértelos a 100 g usando el tamaño de la ración.
Responde SOLO con JSON: {"kcal": numero, "proteina": numero, "hidratos": numero, "azucares": numero, "grasa": numero, "saturadas": numero, "racion_g": numero o null}
Si no ves una tabla nutricional, pon kcal en -1.`

export async function analyzeLabel(file) {
  if (!hasAi()) throw new Error('NO_KEY')
  const dataUri = await resizeImage(file, 1280)
  const txt = await groqChat({
    messages: [{ role: 'user', content: [{ type: 'text', text: LABEL_PROMPT }, { type: 'image_url', image_url: { url: dataUri } }] }],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_completion_tokens: 400,
  })
  let o
  try {
    o = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] || txt)
  } catch {
    throw new Error('No pude leer la tabla, prueba con otra foto más cerca y con luz')
  }
  if (o.kcal == null || !(Number(o.kcal) >= 0)) throw new Error('No veo una tabla nutricional en la foto')
  const n = (v) => (v == null || v === '' || isNaN(Number(v)) ? '' : String(Math.round(Number(v) * 10) / 10))
  return { kcal: n(o.kcal), p: n(o.proteina), c: n(o.hidratos), s: n(o.azucares), f: n(o.grasa), sf: n(o.saturadas), unitG: n(o.racion_g) }
}

// Comprueba la clave y si el modelo configurado existe
export async function testKey() {
  const { key, model } = getAi()
  if (!key) return { ok: false, msg: 'No hay ninguna clave puesta.' }
  if (!key.startsWith('gsk_')) return { ok: false, msg: 'La clave debe empezar por "gsk_". Parece que has copiado otra cosa (por ejemplo el nombre de la clave).' }
  let res
  try {
    res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } })
  } catch {
    return { ok: false, msg: 'No se pudo conectar con Groq (¿sin conexión?).' }
  }
  if (res.status === 401) return { ok: false, msg: `Groq dice que la clave no es válida. Crea una nueva en console.groq.com → API Keys y pégala entera (empieza por gsk_ y tiene unos ${56} caracteres; la tuya tiene ${key.length}).` }
  if (!res.ok) return { ok: false, msg: `Groq respondió con error ${res.status}. Prueba más tarde.` }
  const j = await res.json()
  const ids = (j.data || []).map((m) => m.id)
  if (!ids.includes(model)) {
    const vision = ids.filter((id) => /vision|qwen|llama-4|scout|maverick|vl/i.test(id))
    return { ok: false, keyOk: true, msg: `La clave funciona, pero el modelo "${model}" no está disponible.${vision.length ? ' Modelos que podrían tener visión: ' + vision.slice(0, 5).join(', ') + '.' : ''}`, models: vision }
  }
  return { ok: true, msg: `Todo bien: la clave funciona y el modelo "${model}" está disponible.` }
}
