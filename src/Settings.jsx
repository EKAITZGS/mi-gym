import { useEffect, useState } from 'react'
import { todayStr, num } from './store'
import { migrate, validBackup } from './migrate'
import { getAi, setAi, DEFAULT_MODEL, cleanKey, testKey, serverAi } from './ai'
import Coach from './Coach.jsx'
import { PlanMaker } from './workout/Generator'
import Icon from './icons'
import PushCard from './PushCard'
import AccountCard from './Account'
import { MyTrainer, Students } from './Trainers'
import { cloudReady, CLEAN } from './cloud'
import { getPolar, connectPolar, syncPolar, disconnectPolar, polarDiagnose } from './polar'
import { Modal } from './ui'
import LegalModal from './Legal'
import { deleteAccount } from './cloud'
import { calcGoals, ACTIVITY } from './stats'
import { ListRow, miles } from './ds'
import { pushState } from './push'
import { levelOf, levelAuto } from './aiPlan'

// Calcula kcal y proteína; peso, altura y edad no se guardan, solo el resultado y el sexo (prefs.sex) si lo aceptas
export function GoalCalc({ onApply, onClose, skipLabel, sex }) {
  const [f, setF] = useState({ kg: '', cm: '', age: '', male: sex !== 'f', act: 1.375, aim: 'lose' })
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
        <div className="advice green sm mt-3">
          <b>{r.kcal} kcal</b> y <b>{r.protein} g de proteína</b> al día. Es una estimación: si en 2-3 semanas tu peso medio no va
          como quieres, ajusta unas 150-200 kcal.
        </div>
      )}
      <button className="btn primary full" disabled={!r} onClick={() => onApply(r, f.male ? 'm' : 'f')}>
        Usar estos objetivos
      </button>
      {skipLabel && (
        <button className="btn full" onClick={onClose}>
          {skipLabel}
        </button>
      )}
      <p className="muted small">Tu peso, altura y edad no se guardan; solo las kcal, la proteína y si eres hombre o mujer (para comparar tu fuerza con referencias adecuadas; se cambia en Ajustes → Entreno). Es orientativo y no sustituye a un profesional de la salud.</p>
    </Modal>
  )
}

export default function Settings({ data, setData, cloud, onBack }) {
  const [msg, setMsg] = useState('')
  const [calc, setCalc] = useState(false)
  const [legal, setLegal] = useState(false)
  const [sec, setSec] = useState(null) // categoría abierta: train | goals | push | polar | ai | data
  const lv = levelOf(data)
  // nivel en prefs.gen.level (lo mismo que guarda el generador); vacío = automático según los entrenos
  // sexo en prefs.sex ('m' | 'f'); vacío = sin indicar (referencias de hombre)
  const setSex = (v) =>
    setData((d) => {
      const { sex, ...prefs } = d.prefs || {}
      return { ...d, prefs: v ? { ...prefs, sex: v } : prefs }
    })
  const setLevel = (v) =>
    setData((d) => {
      const { level, ...gen } = d.prefs?.gen || {}
      return { ...d, prefs: { ...(d.prefs || {}), gen: v ? { ...gen, level: v } : gen } }
    })
  useEffect(() => {
    document.querySelector('.main')?.scrollTo(0, 0)
  }, [sec])
  const [delBusy, setDelBusy] = useState(false)
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

  const fmtRest = (v) => (v < 60 ? `${v} segundos` : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min`)
  const SECS = {
    train: { icon: 'dumbbell', title: 'Entreno', sub: `Nivel ${lv.label}${lv.auto ? ' (automático)' : ''} · ${restPref.on ? `descanso de ${fmtRest(restPref.secs)}` : 'sin cuenta atrás'}` },
    goals: { icon: 'flame', title: 'Objetivos diarios', sub: `${miles(data.goals.kcal || 2200)} kcal · ${data.goals.protein || 150} g proteína · ${miles(data.goals.steps || 7000)} pasos` },
    push: { icon: 'clock', title: 'Avisos en el móvil', sub: pushState()?.on ? 'Activados' : 'Desactivados' },
    polar: { icon: 'watch', title: 'Reloj Polar', sub: polar?.token ? 'Conectado' : 'Sin conectar' },
    ai: { icon: 'sparkle', title: 'Inteligencia artificial', sub: ai.key ? 'Con tu propia clave' : serverAi() ? 'Funciona sin clave (límite diario)' : 'Sin configurar' },
    data: { icon: 'cloud', title: 'Copia y datos', sub: cloud?.meta?.uid ? 'Exportar, importar, borrar datos o la cuenta' : 'Exportar, importar o borrar datos' },
  }
  const back = (
    <button className="link" onClick={() => setSec(null)}>
      <Icon name="left" size={18} /> Ajustes
    </button>
  )
  if (sec)
    return (
      <div className="page">
        {back}
        <h1 className="title">{SECS[sec].title}</h1>
        {sec === 'train' && (
          <>
      <div className="card">
        <label className="lbl mt-0">Tu nivel</label>
        <select className="inp" aria-label="Tu nivel" value={data.prefs?.gen?.level || ''} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Automático (ahora: {levelAuto(data).label})</option>
          <option value="beginner">Principiante: empiezas o vuelves tras un parón</option>
          <option value="intermediate">Intermedio: 6-12 meses entrenando con constancia</option>
          <option value="advanced">Avanzado: más de un año entrenando en serio</option>
        </select>
        <p className="muted small mb-0">
          El entrenador IA, «Mejorar con IA» y el generador de rutinas adaptan ejercicios, series, repeticiones e intensidad a tu nivel.
          {lv.auto ? ` En automático sale de los pesos que mueves en los ejercicios básicos y del tiempo que llevas entrenando (ahora: ${lv.whyMe}).` : ''}
        </p>
        <label className="lbl">Sexo</label>
        <select className="inp" aria-label="Sexo" value={data.prefs?.sex || ''} onChange={(e) => setSex(e.target.value)}>
          <option value="">Sin indicar</option>
          <option value="m">Hombre</option>
          <option value="f">Mujer</option>
        </select>
        <p className="muted small mb-0">
          Para comparar tu fuerza con referencias de tu sexo (nivel automático y rangos de «Tu personaje») y que el entrenador IA lo tenga en cuenta. Sin indicar se usan las de hombre.
        </p>
      </div>
      <div className="card">
        <label className="lbl mt-0">Cuenta atrás de descanso al marcar una serie</label>
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

          </>
        )}
        {sec === 'goals' && (
          <>
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
          sex={data.prefs?.sex}
          onClose={() => setCalc(false)}
          onApply={(r, sex) => {
            setData((d) => ({ ...d, goals: { ...d.goals, kcal: r.kcal, protein: r.protein }, prefs: { ...(d.prefs || {}), sex } }))
            setCalc(false)
          }}
        />
      )}

          </>
        )}
        {sec === 'push' && <PushCard data={data} setData={setData} />}
        {sec === 'polar' && (
          <>
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
                  <div className="small hint-warn">
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
                title="Vuelve a dar permiso en Polar sin desconectar (no se pierde nada)"
                onClick={() => {
                  if (!confirm('Vas a entrar en Polar para volver a dar permiso. No se desconecta ni se borra nada. ¿Seguir?')) return
                  connectPolar()
                }}
              >
                Volver a conectar
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
            <p className="muted small mt-0">
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
      {polar?.token && <PolarDiag />}

          </>
        )}
        {sec === 'ai' && (
          <div className="card set-sec">
        <div className="mo-h mt-0">IA con tu propia clave (opcional)</div>
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
      
          </div>
        )}
        {sec === 'data' && (
          <div className="card set-sec">
        <div className="mo-h mt-0">Copia en archivo</div>
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
        {cloud?.meta?.uid && (
          <button
            className="btn danger full"
            disabled={delBusy}
            onClick={async () => {
              if (!confirm('¿Eliminar tu cuenta? Se borran tus datos de la nube, tu perfil, tus entrenadores o alumnos y el usuario. No se puede deshacer.')) return
              if (!confirm('Última confirmación: ¿eliminar la cuenta definitivamente? Si quieres conservar tus datos, exporta antes una copia.')) return
              setDelBusy(true)
              try {
                await deleteAccount()
                location.reload()
              } catch (e) {
                setDelBusy(false)
                alert(e.message)
              }
            }}
          >
            {delBusy ? 'Eliminando…' : 'Eliminar mi cuenta'}
          </button>
        )}
          </div>
        )}
      </div>
    )

  return (
    <div className="page">
      {onBack && (
        <button className="link" onClick={onBack}>
          <Icon name="left" size={18} /> Perfil
        </button>
      )}
      <h1 className="title">Ajustes</h1>

      <div className="card set-list">
        {Object.entries(SECS).map(([k, c]) => (
          <ListRow key={k} icon={c.icon} title={c.title} sub={c.sub} onClick={() => setSec(k)} />
        ))}
        <ListRow icon="info" title="Privacidad y condiciones" sub="Qué datos se guardan y cómo se usan" onClick={() => setLegal(true)} />
      </div>
      {legal && <LegalModal onClose={() => setLegal(false)} />}

      <div className="brand">
        <img src="./logo.svg" alt="" width="56" height="56" />
        <b>MI-GYM</b>
        <span className="muted small">Entrena · Come · Progresa</span>
      </div>
      <p className="muted small credits">
        Fotos de ejercicios: free-exercise-db (dominio público). Productos de súper: Open Food Facts. Los valores de
        la lista de alimentos son aproximados.
      </p>
    </div>
  )
}

// Diagnóstico de Polar: respuesta en bruto de lo que tiene Polar para tu cuenta (sin guardar nada ni enseñar el token)
const fmtPT = (d) => {
  const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/)
  return m ? `${(+m[1] || 0) * 60 + (+m[2] || 0)} min` : ''
}
const fmtT = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '—')
function PolarDiag() {
  const [st, setSt] = useState({ busy: false, out: null, err: '', copied: false })
  const run = async () => {
    setSt({ busy: true, out: null, err: '', copied: false })
    try {
      setSt({ busy: false, out: await polarDiagnose(), err: '', copied: false })
    } catch (e) {
      setSt({ busy: false, out: null, err: String(e.message || e), copied: false })
    }
  }
  const o = st.out
  const ex = o?.exercises
  const ck = o?.check
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(o, null, 2))
      setSt((s) => ({ ...s, copied: true }))
    } catch {}
  }
  return (
    <div className="card">
      <div className="card-h">
        <h3>Diagnóstico de Polar</h3>
      </div>
      <p className="muted small mt-0">Pregunta a Polar qué entrenos tiene para tu cuenta y lo enseña tal cual. No guarda ni cambia nada.</p>
      <button className="btn full" disabled={st.busy} onClick={run}>
        {st.busy ? 'Preguntando a Polar…' : 'Ver lo que devuelve Polar'}
      </button>
      {st.err && <div className="advice yellow sm">{st.err}</div>}
      {ex && (
        <div className="diag">
          <div className="mo-h">Entrenos (/exercises)</div>
          {ex.error ? (
            <p className="small hint-warn">Sin respuesta: {ex.error}</p>
          ) : (
            <p className="small">
              Respuesta {ex.status} · <b>{ex.count ?? '—'}</b> entrenos{ex.body ? ` · ${typeof ex.body === 'string' ? ex.body : JSON.stringify(ex.body)}` : ''}
            </p>
          )}
          {(ex.list || []).map((e) => (
            <div className="diag-row" key={e.id}>
              <b>{fmtT(e.start_time)}</b>
              <span className="muted small">
                subido {fmtT(e.upload_time)} · {e.sport || '?'} · {fmtPT(e.duration)}
              </span>
            </div>
          ))}
          <div className="mo-h">Registro y entrenos pendientes (/polar/check)</div>
          {!ck && <p className="muted small">Sin id de usuario de Polar en este móvil: vuelve a conectar.</p>}
          {ck?.missing && <p className="muted small">Esta prueba aún no está en el servidor (Worker). Cuando esté publicada, saldrá aquí.</p>}
          {ck?.error && <p className="small hint-warn">Sin respuesta: {ck.error}</p>}
          {ck && !ck.missing && !ck.error && (
            <>
              <p className="small">
                Usuario en Polar: {ck.user?.status} {ck.user?.registered ? `· registrado${ck.user['registration-date'] ? ` el ${fmtT(ck.user['registration-date'])}` : ''}` : '· NO registrado'}
              </p>
              <p className="small">
                Transacción: {ck.transaction?.status} {ck.transaction?.meaning ? `· ${ck.transaction.meaning}` : ''}
                {ck.transaction?.count != null ? ` · ${ck.transaction.count} entrenos` : ''}
              </p>
              {(ck.transaction?.exercises || []).map((e, i) => (
                <div className="diag-row" key={i}>
                  <b>{fmtT(e['start-time'])}</b>
                  <span className="muted small">
                    subido {fmtT(e['upload-time'])} · {e.sport || '?'}
                  </span>
                </div>
              ))}
              {ck.exercises?.rateLimit && Object.keys(ck.exercises.rateLimit).length > 0 && (
                <p className="muted small">Límites de Polar: {Object.entries(ck.exercises.rateLimit).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
              )}
            </>
          )}
          <button className="btn full" onClick={copy}>
            {st.copied ? 'Copiado' : 'Copiar resultado'}
          </button>
          <p className="muted small">El resultado no lleva tu token ni tus contraseñas: puedes pegarlo en el chat.</p>
        </div>
      )}
    </div>
  )
}
