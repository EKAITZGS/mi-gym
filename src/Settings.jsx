import { useState } from 'react'
import { DEFAULT, todayStr, num } from './store'
import { getAi, setAi, DEFAULT_MODEL, cleanKey, testKey } from './ai'
import Setup from './Setup'
import Coach from './Coach.jsx'
import { Generator } from './Workout'
import { generatePlan } from './plans'
import Icon from './icons'
import PushCard from './PushCard'
import { getPolar, setPolar, connectPolar, syncPolar } from './polar'

export default function Settings({ data, setData }) {
  const [msg, setMsg] = useState('')
  const [paste, setPaste] = useState('')
  const [ai, setAiState] = useState(getAi())
  const [kt, setKt] = useState({ loading: false, res: null })
  const [setup, setSetup] = useState(false)
  const [gen, setGen] = useState(false)
  const [coach, setCoach] = useState(false)
  const [polar, setPolarState] = useState(getPolar())
  const [ps, setPs] = useState({ loading: false, msg: '' })
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

      <h4>Entrenamiento</h4>
      <div className="card">
        <button className="row nob li" onClick={() => setSetup(true)}>
          <span className="rest-ic"><Icon name="calendar" size={20} /></span>
          <div className="grow">
            <div className="li-t">Configurar entrenamiento</div>
            <div className="muted small">Qué días entrenas y qué ejercicios haces cada día</div>
          </div>
          <Icon name="right" size={18} />
        </button>
        <button className="row nob li" onClick={() => setCoach(true)}>
          <span className="rest-ic"><Icon name="trend" size={20} /></span>
          <div className="grow">
            <div className="li-t">Mejorar mi rutina con IA</div>
            <div className="muted small">Propone cambios o más días según tus entrenos y molestias</div>
          </div>
          <Icon name="right" size={18} />
        </button>
        <button className="row nob li" onClick={() => setGen(true)}>
          <span className="rest-ic"><Icon name="sparkle" size={20} /></span>
          <div className="grow">
            <div className="li-t">Plan automático</div>
            <div className="muted small">Según tu nivel, con los días que te recomiendo ir</div>
          </div>
          <Icon name="right" size={18} />
        </button>
      </div>
      {setup && <Setup data={data} setData={setData} onClose={() => setSetup(false)} />}
      {coach && <Coach data={data} setData={setData} onClose={() => setCoach(false)} />}
      {gen && (
        <Generator
          onClose={() => setGen(false)}
          onGenerate={(days, level) => {
            setData((d) => ({ ...d, plan: generatePlan(days, level), active: null, setupDone: true }))
            setGen(false)
            flash('Plan creado. Míralo en Entreno.')
          }}
        />
      )}

      <h4>Objetivos diarios</h4>
      <div className="card">
        <label className="lbl">Calorías (kcal)</label>
        <input className="inp" inputMode="numeric" value={data.goals.kcal} onChange={(e) => setGoal('kcal', e.target.value)} />
        <label className="lbl">Proteína (g)</label>
        <input className="inp" inputMode="numeric" value={data.goals.protein} onChange={(e) => setGoal('protein', e.target.value)} />
        <label className="lbl">Pasos al día</label>
        <input className="inp" inputMode="numeric" value={data.goals.steps ?? 7000} onChange={(e) => setGoal('steps', e.target.value)} />
        <p className="muted small">Ponlos tú como quieras. Son solo una guía para las barras de progreso.</p>
      </div>

      <h4>Avisos en el móvil</h4>
      <PushCard data={data} setData={setData} />

      <h4>Reloj Polar</h4>
      <div className="card">
        {polar?.token ? (
          <>
            <div className="row nob">
              <span className="rest-ic"><Icon name="check" size={20} /></span>
              <div className="grow">
                <div className="li-t">Polar conectado</div>
                <div className="muted small">
                  {data.polar?.lastSync
                    ? `Última sincronización: ${new Date(data.polar.lastSync).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${Object.keys(data.polar?.exercises || {}).length} entrenos`
                    : 'Aún sin sincronizar'}
                </div>
              </div>
            </div>
            <div className="btns">
              <button
                className="btn primary"
                disabled={ps.loading}
                onClick={async () => {
                  setPs({ loading: true, msg: '' })
                  try {
                    const r = await syncPolar(setData)
                    setPs({ loading: false, msg: `Sincronizado: ${r.exercises} entrenos (últimos 30 días).` })
                  } catch (e) {
                    setPs({ loading: false, msg: e.message === 'AUTH' ? 'Polar rechazó el acceso: desconecta y vuelve a conectar.' : 'No se pudo sincronizar (¿sin conexión?).' })
                  }
                }}
              >
                {ps.loading ? 'Sincronizando…' : 'Sincronizar'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (!confirm('¿Desconectar Polar de esta app?')) return
                  setPolar(null)
                  setPolarState(null)
                }}
              >
                Desconectar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Trae las calorías y el pulso de tus entrenos del reloj (los que subas a Polar Flow a partir de ahora). Se
              sincroniza solo al abrir la app.
            </p>
            <button className="btn primary full" onClick={connectPolar}>
              Conectar Polar
            </button>
          </>
        )}
        {ps.msg && <div className="advice green sm">{ps.msg}</div>}
      </div>

      <h4>IA (Groq): fotos y entrenador</h4>
      <div className="card">
        <p className="muted small">
          Para reconocer alimentos por foto y para el entrenador que mejora tu rutina. Crea una clave gratis en console.groq.com (API Keys) y pégala aquí. Se
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
            const n = { ...ai, key: cleanKey(e.target.value) }
            setAiState(n)
            setAi(n)
            setKt({ loading: false, res: null })
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
        <button
          className="btn full"
          disabled={kt.loading || !ai.key}
          onClick={async () => {
            setKt({ loading: true, res: null })
            setKt({ loading: false, res: await testKey() })
          }}
        >
          {kt.loading ? 'Probando…' : 'Probar clave'}
        </button>
        {kt.res && <div className={'advice ' + (kt.res.ok ? 'green' : 'yellow') + ' sm'}>{kt.res.msg}</div>}
        {kt.res?.models?.length > 0 && (
          <div className="chips wrap">
            {kt.res.models.slice(0, 5).map((m) => (
              <button
                key={m}
                className="chip sm"
                onClick={() => {
                  const n = { ...ai, model: m }
                  setAiState(n)
                  setAi(n)
                  setKt({ loading: false, res: null })
                }}
              >
                Usar {m}
              </button>
            ))}
          </div>
        )}
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

      <div className="brand">
        <img src="./logo.svg" alt="" width="56" height="56" />
        <b>Mi Gym</b>
        <span className="muted small">Entrena · Come · Progresa</span>
      </div>
      <p className="muted small credits">
        Fotos de ejercicios: free-exercise-db (dominio público). Productos de súper: Open Food Facts. Los valores de
        la lista de alimentos son aproximados.
      </p>
    </div>
  )
}
