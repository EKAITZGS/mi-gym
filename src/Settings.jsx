import { useState } from 'react'
import { todayStr, num } from './store'
import { migrate, validBackup } from './migrate'
import { getAi, setAi, DEFAULT_MODEL, cleanKey, testKey, serverAi } from './ai'
import Coach from './Coach.jsx'
import { PlanMaker } from './Workout'
import Icon from './icons'
import PushCard from './PushCard'
import AccountCard from './Account'
import { MyTrainer, Students } from './Trainers'
import { cloudReady, CLEAN } from './cloud'
import { getPolar, connectPolar, syncPolar, disconnectPolar } from './polar'
import { Modal } from './ui'
import { calcGoals, ACTIVITY } from './stats'

// Calcula kcal y proteína; los datos que pide no se guardan, solo el resultado si lo aceptas
export function GoalCalc({ onApply, onClose, skipLabel }) {
  const [f, setF] = useState({ kg: '', cm: '', age: '', male: true, act: 1.375, aim: 'lose' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const r = calcGoals({ ...f, kg: num(f.kg), cm: num(f.cm), age: num(f.age) })
  const numIn = (k, ph) => (
    <input className="inp" inputMode="decimal" placeholder={ph} value={f[k]} onChange={(e) => set(k, e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} />
  )
  return (
    <Modal title="Calcular mis objetivos" onClose={onClose}>
      <div className="seg">
        <button className={f.male ? 'on' : ''} onClick={() => set('male', true)}>Hombre</button>
        <button className={!f.male ? 'on' : ''} onClick={() => set('male', false)}>Mujer</button>
      </div>
      <label className="lbl">Peso (kg)</label>
      {numIn('kg', 'Ej: 75')}
      <label className="lbl">Altura (cm)</label>
      {numIn('cm', 'Ej: 175')}
      <label className="lbl">Edad</label>
      {numIn('age', 'Ej: 25')}
      <label className="lbl">Actividad</label>
      <select className="inp" value={f.act} onChange={(e) => set('act', Number(e.target.value))}>
        {ACTIVITY.map((a) => (
          <option key={a.f} value={a.f}>{a.label}</option>
        ))}
      </select>
      <label className="lbl">Objetivo</label>
      <div className="seg seg3">
        {[['lose', 'Bajar grasa'], ['keep', 'Mantener'], ['gain', 'Ganar músculo']].map(([v, l]) => (
          <button key={v} className={f.aim === v ? 'on' : ''} onClick={() => set('aim', v)}>{l}</button>
        ))}
      </div>
      {r && (
        <div className="advice green sm" style={{ marginTop: 12 }}>
          <b>{r.kcal} kcal</b> y <b>{r.protein} g de proteína</b> al día. Es una estimación: si en 2-3 semanas tu peso medio no va
          como quieres, ajusta unas 150-200 kcal.
        </div>
      )}
      <button className="btn primary full" disabled={!r} onClick={() => onApply(r)}>
        Usar estos objetivos
      </button>
      {skipLabel && (
        <button className="btn full" onClick={onClose}>
          {skipLabel}
        </button>
      )}
      <p className="muted small">Tu peso, altura y edad no se guardan; solo las kcal y la proteína. Es orientativo y no sustituye a un profesional de la salud.</p>
    </Modal>
  )
}

export default function Settings({ data, setData, cloud }) {
  const [msg, setMsg] = useState('')
  const [calc, setCalc] = useState(false)
  // preferencia de este móvil (no va en la copia de seguridad)
  const [restPref, setRestPref] = useState(() => {
    try {
      return { on: localStorage.getItem('migym.restOn') !== '0', secs: Number(localStorage.getItem('migym.rest')) || 90 }
    } catch {
      return { on: true, secs: 90 }
    }
  })
  const saveRest = (p) => {
    const v = { ...restPref, ...p }
    setRestPref(v)
    try {
      localStorage.setItem('migym.restOn', v.on ? '1' : '0')
      localStorage.setItem('migym.rest', String(v.secs))
    } catch {}
  }
  const [paste, setPaste] = useState('')
  const [ai, setAiState] = useState(getAi())
  const [kt, setKt] = useState({ loading: false, res: null })
  const [maker, setMaker] = useState(false)
  const [coach, setCoach] = useState(false)
  const [polar, setPolarState] = useState(getPolar())
  const [ps, setPs] = useState({ loading: false, msg: '' })
  const flash = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }
  // Objetivos: se escribe libre (se puede borrar) y se guarda al salir del campo; vacío o 0 deja el valor anterior
  const [goalDraft, setGoalDraft] = useState({})
  const goalVal = (k, def) => goalDraft[k] ?? String(data.goals[k] ?? def)
  const editGoal = (k, v) => setGoalDraft((g) => ({ ...g, [k]: v.replace(/\D/g, '').slice(0, 6) }))
  const commitGoal = (k) => {
    const v = num(goalDraft[k])
    if (goalDraft[k] != null && v > 0) setData((d) => ({ ...d, goals: { ...d.goals, [k]: v } }))
    setGoalDraft((g) => {
      const { [k]: _, ...rest } = g
      return rest
    })
  }

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
      if (!validBackup(obj)) throw new Error('formato')
      if (!confirm('Esto reemplaza todos los datos actuales por los de la copia. ¿Continuar?')) return
      // lo de ahora se guarda aparte por si la copia no era la buena
      try {
        localStorage.setItem('migym.v1.antes-importar', JSON.stringify(data))
      } catch {}
      setData(migrate(obj))
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
    if (
      !confirm(
        cloud?.meta?.uid
          ? '¿Borrar TODOS los datos (entrenos, comidas, plan)? Como tienes cuenta, también se borran de la nube. No se puede deshacer.'
          : '¿Borrar TODOS los datos de la app (entrenos, comidas, plan)? No se puede deshacer.'
      )
    )
      return
    try {
      localStorage.setItem('migym.v1.borrado', localStorage.getItem('migym.v1') || '')
    } catch {}
    setData({ ...CLEAN })
    flash('Datos borrados')
  }

  return (
    <div className="page">
      <h1 className="title">Ajustes</h1>

      <h4>Entreno</h4>
      <div className="card">
        <label className="lbl" style={{ marginTop: 0 }}>Cuenta atrás de descanso al marcar una serie</label>
        <div className="seg">
          <button className={restPref.on ? 'on' : ''} onClick={() => saveRest({ on: true })}>
            Sí
          </button>
          <button className={!restPref.on ? 'on' : ''} onClick={() => saveRest({ on: false })}>
            No
          </button>
        </div>
        {restPref.on && (
          <>
            <label className="lbl">Tiempo de descanso</label>
            <select className="inp" value={restPref.secs} onChange={(e) => saveRest({ secs: Number(e.target.value) })}>
              {[...new Set([30, 45, 60, 75, 90, 120, 150, 180, 240, 300, restPref.secs])].sort((x, y) => x - y).map((v) => (
                <option key={v} value={v}>
                  {v < 60 ? `${v} segundos` : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min`}
                </option>
              ))}
            </select>
          </>
        )}
        <p className="muted small">
          Al tocar el ✓ de una serie empieza la cuenta atrás. Si un ejercicio tiene su propio descanso (en Editar día), se usa ese.
        </p>
      </div>

      <h4>Objetivos diarios</h4>
      <div className="card">
        <label className="lbl">Calorías (kcal)</label>
        <input className="inp" inputMode="numeric" value={goalVal('kcal', 2200)} onFocus={(e) => e.target.select()} onChange={(e) => editGoal('kcal', e.target.value)} onBlur={() => commitGoal('kcal')} />
        <label className="lbl">Proteína (g)</label>
        <input className="inp" inputMode="numeric" value={goalVal('protein', 150)} onFocus={(e) => e.target.select()} onChange={(e) => editGoal('protein', e.target.value)} onBlur={() => commitGoal('protein')} />
        <label className="lbl">Pasos al día</label>
        <input className="inp" inputMode="numeric" value={goalVal('steps', 7000)} onFocus={(e) => e.target.select()} onChange={(e) => editGoal('steps', e.target.value)} onBlur={() => commitGoal('steps')} />
        <p className="muted small">Ponlos tú como quieras. Son solo una guía para las barras de progreso.</p>
        <button className="btn full" onClick={() => setCalc(true)}>
          <Icon name="sparkle" size={16} /> Calcular por mí
        </button>
      </div>
      {calc && (
        <GoalCalc
          onClose={() => setCalc(false)}
          onApply={(r) => {
            setData((d) => ({ ...d, goals: { ...d.goals, kcal: r.kcal, protein: r.protein } }))
            setCalc(false)
          }}
        />
      )}

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
                {data.polar?.actErr && (
                  <div className="small" style={{ color: 'var(--warn)' }}>
                    Polar no ha devuelto los pasos y calorías del día ({data.polar.actErr}).
                  </div>
                )}
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
                onClick={async () => {
                  if (!confirm('¿Desconectar Polar? La app dejará de recibir datos de tu reloj (lo ya guardado se queda).')) return
                  await disconnectPolar()
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

      <details className="card more-opts">
        <summary>Más opciones</summary>

        <div className="mo-h">IA con tu propia clave (opcional)</div>
        <p className="muted small">
          {serverAi()
            ? 'La IA ya funciona sin hacer nada, con un límite de usos al día. Si quieres usarla sin límite, crea una clave gratis en console.groq.com (API Keys) y pégala aquí.'
            : 'Para reconocer alimentos por foto y para el entrenador que mejora tu rutina. Crea una clave gratis en console.groq.com (API Keys) y pégala aquí.'}{' '}
          Tu clave se guarda solo en este móvil y no entra en las copias de seguridad. Las fotos se envían a Groq para analizarlas.
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
      
        <div className="mo-h">Copia en archivo</div>
        <p className="muted small">Tus datos ya se guardan en tu cuenta. Si quieres, guarda también una copia en un archivo.</p>
        <div className="btns">
          <button className="btn" onClick={exportFile}>
            Exportar
          </button>
          <label className="btn filebtn">
            Importar
            <input type="file" accept="application/json,.json" onChange={importFile} hidden />
          </label>
        </div>
        {msg && <p className="toast">{msg}</p>}

        <div className="mo-h">Borrar</div>
        <button className="btn danger full" onClick={reset}>
          Borrar todos mis datos
        </button>
      </details>

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
