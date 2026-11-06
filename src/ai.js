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
export const setAi = ({ key, model }) => {
  try {
    localStorage.setItem(KEY, (key || '').trim())
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
