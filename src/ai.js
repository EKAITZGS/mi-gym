// Reconocimiento de alimentos por foto con la API de Groq (modelo con visión).
// La clave se guarda aparte en localStorage (no entra en las copias de seguridad).
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

const PROMPT = `Mira la foto e identifica el alimento o plato principal.
Responde SOLO con un JSON con estas claves, sin texto extra:
{"nombre": "nombre corto en español (indica si es crudo o cocinado)", "kcal_100g": numero, "proteina_100g": numero, "hidratos_100g": numero, "grasa_100g": numero, "confianza": "alta|media|baja"}
Usa valores medios aproximados por cada 100 g del alimento tal como se ve. Si hay varios alimentos, elige el principal. Si no hay comida en la foto, pon kcal_100g en 0.`

export async function analyzeFood(file) {
  const { key, model } = getAi()
  if (!key) throw new Error('NO_KEY')
  const dataUri = await resizeImage(file)
  let res
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_completion_tokens: 500,
      }),
    })
  } catch {
    throw new Error('No se pudo conectar con Groq (¿sin conexión?)')
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('La clave de Groq no es válida')
    if (res.status === 429) throw new Error('Has llegado al límite de Groq. Prueba más tarde')
    if (res.status === 404 || res.status === 400) throw new Error(`Groq rechazó la petición (${res.status}). Revisa el nombre del modelo en Ajustes`)
    throw new Error(`Error de Groq (${res.status})`)
  }
  const j = await res.json()
  let txt = j.choices?.[0]?.message?.content || ''
  txt = txt.replace(/<think>[\s\S]*?<\/think>/g, '')
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
  const n = (v) => Math.max(0, Number(v) || 0)
  const out = {
    name: String(o.nombre || 'Alimento').slice(0, 80),
    kcal: n(o.kcal_100g),
    p: n(o.proteina_100g),
    c: n(o.hidratos_100g),
    f: n(o.grasa_100g),
    conf: o.confianza || 'media',
  }
  if (out.kcal <= 0) throw new Error('No he reconocido comida en la foto, prueba otra')
  return out
}

const LABEL_PROMPT = `Esta foto es la tabla de información nutricional de un producto envasado.
Lee los valores POR 100 g (o por 100 ml). Si solo aparece por ración, conviértelos a 100 g usando el tamaño de la ración.
Responde SOLO con JSON: {"kcal": numero, "proteina": numero, "hidratos": numero, "azucares": numero, "grasa": numero, "saturadas": numero, "racion_g": numero o null}
Si no ves una tabla nutricional, pon kcal en -1.`

export async function analyzeLabel(file) {
  const { key, model } = getAi()
  if (!key) throw new Error('NO_KEY')
  const dataUri = await resizeImage(file, 1280)
  let res
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: [{ type: 'text', text: LABEL_PROMPT }, { type: 'image_url', image_url: { url: dataUri } }] }],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_completion_tokens: 400,
      }),
    })
  } catch {
    throw new Error('No se pudo conectar con Groq (¿sin conexión?)')
  }
  if (!res.ok) throw new Error(res.status === 401 ? 'La clave de Groq no es válida' : res.status === 429 ? 'Has llegado al límite de Groq. Prueba más tarde' : `Error de Groq (${res.status})`)
  const j = await res.json()
  const txt = (j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '')
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
