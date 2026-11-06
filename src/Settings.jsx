import { useState } from 'react'
import { DEFAULT, todayStr, num } from './store'
import { getAi, setAi, DEFAULT_MODEL } from './ai'

export default function Settings({ data, setData }) {
  const [msg, setMsg] = useState('')
  const [paste, setPaste] = useState('')
  const [ai, setAiState] = useState(getAi())
  const flash = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }
  const setGoal = (k, v) => setData((d) => ({ ...d, goals: { ...d.goals, [k]: num(v) } }))

  const exportFile = async () => {
    const json = JSON.stringify(data)
    const file = new File([json], `mi-gym-${todayStr()}.json`, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Copia de Mi Gym' })
        return flash('Copia compartida')
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = file.name
    a.click()
    flash('Copia descargada')
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data))
      flash('Copia en el portapapeles')
    } catch {
      flash('No se pudo copiar')
    }
  }

  const load = (text) => {
    try {
      const obj = JSON.parse(text)
      if (!obj || !Array.isArray(obj.plan)) throw new Error('formato')
      if (!confirm('Esto reemplaza todos los datos actuales por los de la copia. ¿Continuar?')) return
      setData({ ...DEFAULT, ...obj })
      setPaste('')
      flash('Copia restaurada')
    } catch {
      flash('Ese archivo no es una copia válida')
    }
  }

  const importFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const rd = new FileReader()
    rd.onload = () => load(String(rd.result))
    rd.readAsText(f)
    e.target.value = ''
  }

  const reset = () => {
    if (!confirm('¿Borrar TODOS los datos de la app (entrenos, comidas, plan)? No se puede deshacer.')) return
    setData(DEFAULT)
    flash('Datos borrados')
  }

  return (
    <div className="page">
      <h1 className="title">Ajustes</h1>

      <h4>Objetivos diarios</h4>
      <div className="card">
        <label className="lbl">Calorías (kcal)</label>
        <input className="inp" inputMode="numeric" value={data.goals.kcal} onChange={(e) => setGoal('kcal', e.target.value)} />
        <label className="lbl">Proteína (g)</label>
        <input className="inp" inputMode="numeric" value={data.goals.protein} onChange={(e) => setGoal('protein', e.target.value)} />
        <p className="muted small">Ponlos tú como quieras. Son solo una guía para las barras de progreso.</p>
      </div>

      <h4>IA para fotos (Groq)</h4>
      <div className="card">
        <p className="muted small">
          Para reconocer alimentos por foto. Crea una clave gratis en console.groq.com (API Keys) y pégala aquí. Se
          guarda solo en este móvil y no entra en las copias de seguridad. Las fotos se envían a Groq para analizarlas.
        </p>
        <label className="lbl">Clave de Groq</label>
        <input
          className="inp"
          type="password"
          autoComplete="off"
          placeholder="gsk_…"
          value={ai.key}
          onChange={(e) => {
            const n = { ...ai, key: e.target.value }
            setAiState(n)
            setAi(n)
          }}
        />
        <label className="lbl">Modelo con visión</label>
        <input
          className="inp"
          value={ai.model}
          onChange={(e) => {
            const n = { ...ai, model: e.target.value }
            setAiState(n)
            setAi(n)
          }}
        />
        <p className="muted small">Por defecto: {DEFAULT_MODEL}. Si Groq lo cambia, pon aquí el nombre de otro modelo con visión.</p>
      </div>

      <h4>Copia de seguridad</h4>
      <div className="card">
        <p className="muted small">
          Tus datos se guardan solo en este dispositivo. Haz una copia de vez en cuando por si borras los datos del
          navegador o cambias de móvil.
        </p>
        <button className="btn full" onClick={exportFile}>
          Exportar copia (archivo)
        </button>
        <button className="btn full" onClick={copyText}>
          Copiar copia al portapapeles
        </button>
        <label className="btn full filebtn">
          Importar copia (archivo)
          <input type="file" accept="application/json,.json" onChange={importFile} hidden />
        </label>
        <textarea className="inp" rows={3} placeholder="…o pega aquí una copia" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <button className="btn full" disabled={!paste.trim()} onClick={() => load(paste)}>
          Restaurar desde lo pegado
        </button>
        {msg && <p className="toast">{msg}</p>}
      </div>

      <h4>Zona peligrosa</h4>
      <button className="btn danger full" onClick={reset}>
        Borrar todos los datos
      </button>

      <p className="muted small credits">
        Fotos de ejercicios: free-exercise-db (dominio público). Productos de súper: Open Food Facts. Los valores de
        la lista de alimentos son aproximados.
      </p>
    </div>
  )
}
