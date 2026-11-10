import { useEffect, useState } from 'react'
import { useStore, todayStr } from './store'
import { setCustomExercises } from './data/exercises'
import Home from './Home'
import Workout, { editGuard } from './Workout'
import Diet from './Diet'
import Settings from './Settings'
import Icon from './icons'
import { readPolarReturn, getPolar, syncPolar } from './polar'
import { syncPush } from './push'

const TABS = [
  { id: 'home', label: 'Hoy', icon: 'home' },
  { id: 'train', label: 'Entreno', icon: 'dumbbell' },
  { id: 'diet', label: 'Dieta', icon: 'food' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
]

export default function App() {
  const [data, setData] = useStore()
  setCustomExercises(data.myExercises || [])
  // Si hay un entreno de hoy a medias (p. ej. la app se recargó por una actualización), vuelve directo a él
  const resume = data.active && data.active.date === todayStr()
  const [tab, setTab] = useState(resume ? 'train' : 'home')
  const [view, setView] = useState(resume ? { name: 'session' } : { name: 'list' })
  const [notice, setNotice] = useState(null)
  const storedPolarEx = () => { try { return JSON.parse(localStorage.getItem('migym.v1') || '{}').polar?.exercises || {} } catch { return {} } }

  // Polar: al volver de dar permiso, y sincronización automática al abrir (cada 30 min como mucho)
  useEffect(() => {
    const ret = readPolarReturn()
    if (ret) {
      setTab('settings')
      setNotice(ret.ok ? 'Polar conectado. Sincronizando…' : `No se pudo conectar Polar (${ret.error}).`)
    }
    let lastTry = 0
    const auto = (force) => {
      const p = getPolar()
      if (!p?.token) return
      if (!force && Date.now() - lastTry < 3 * 60 * 1000) return
      lastTry = Date.now()
      const before = new Set(Object.keys(storedPolarEx()))
      const hadSync = (() => { try { return !!JSON.parse(localStorage.getItem('migym.v1') || '{}').polar?.lastSync } catch { return false } })()
      syncPolar(setData)
        .then((r) => {
          if (ret?.ok && force) return setNotice(`Polar conectado: ${r.exercises} entrenos de los últimos 30 días.`)
          const fresh = r.list.filter((e) => !before.has(String(e.id)))
          if (fresh.length && hadSync) {
            const e = fresh.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))[0]
            setNotice(`Entreno del reloj recibido: ${e.min} min · ${e.kcal} kcal${e.hrAvg ? ` · ${e.hrAvg} ppm` : ''}`)
          }
        })
        .catch((e) => ret && setNotice(e.message === 'AUTH' ? 'Polar ha rechazado el acceso. Vuelve a conectar.' : 'No se pudo sincronizar con Polar ahora.'))
    }
    auto(!!ret?.ok)
    // Al volver a la app (iOS la deja dormida en segundo plano) vuelve a mirar si hay entreno nuevo
    const onVis = () => document.visibilityState === 'visible' && auto(false)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Avisos: cuando cambian tus datos, se recalcula la lista de avisos programados (con un pequeño retraso)
  useEffect(() => {
    const t = setTimeout(() => syncPush(data).catch(() => {}), 3000)
    return () => clearTimeout(t)
  }, [data.food, data.sessions, data.plan, data.body, data.pushPrefs, data.polar, data.goals])
  const [saveFail, setSaveFail] = useState(false)
  useEffect(() => {
    const bad = () => setSaveFail(true)
    const ok = () => setSaveFail(false)
    window.addEventListener('migym-save-error', bad)
    window.addEventListener('migym-save-ok', ok)
    return () => {
      window.removeEventListener('migym-save-error', bad)
      window.removeEventListener('migym-save-ok', ok)
    }
  }, [])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const start = (dayId) => {
    const day = data.plan.find((d) => d.id === dayId)
    if (!day) return
    if (data.active && data.active.dayId !== dayId) {
      if (!confirm('Tienes otro entreno en curso. ¿Empezar este y descartar el otro?')) return
    }
    // mismo día del plan pero empezado otra fecha: se sigue con lo apuntado, guardado con la fecha de hoy
    const stale = data.active && data.active.dayId === dayId && data.active.date !== todayStr()
    if (stale) {
      if (!confirm('Tienes este entreno a medias de otro día. ¿Seguir con lo apuntado, con fecha de hoy? (Para empezar de cero, entra y pulsa Descartar.)')) return
      setData((d) => (d.active ? { ...d, active: { ...d.active, date: todayStr() } } : d))
    }
    if (!data.active || data.active.dayId !== dayId) {
      const entries = {}
      for (const it of day.items) {
        entries[it.ex] = Array.from({ length: it.sets }, () => ({
          w: '',
          r: '',
          done: false,
          drops: it.drop ? [{ w: '', r: '' }] : [],
        }))
      }
      setData((d) => ({
        ...d,
        active: { dayId, name: day.name, date: todayStr(), items: day.items.map((i) => ({ ...i })), entries },
      }))
    }
    setTab('train')
    setView({ name: 'session' })
  }

  const startFree = () => {
    if (data.active && !confirm('Tienes otro entreno en curso. ¿Empezar uno libre y descartar el otro?')) return
    setData((d) => ({ ...d, active: { dayId: 'free', name: 'Entreno libre', date: todayStr(), items: [], entries: {} } }))
    setTab('train')
    setView({ name: 'session' })
  }

  const goTab = (id) => {
    if (editGuard.dirty && !confirm('Tienes cambios sin guardar en el día que estás editando. ¿Salir sin guardar?')) return
    editGuard.dirty = false
    setTab(id)
    if (id === 'train' && view.name !== 'session') setView({ name: 'list' })
  }

  return (
    <div className="app">
      <main className="main">
        {tab === 'home' && <Home data={data} setData={setData} onStart={start} go={goTab} />}
        {tab === 'train' && <Workout data={data} setData={setData} view={view} setView={setView} onStart={start} onStartFree={startFree} />}
        {tab === 'diet' && <Diet data={data} setData={setData} />}
        {tab === 'settings' && <Settings data={data} setData={setData} />}
      </main>
      {saveFail && (
        <div className="notice" style={{ background: 'var(--danger)', color: '#fff', top: 0 }} role="alert">
          No se está guardando: lo de ahora se perderá al cerrar. Haz una copia en Ajustes y libera espacio en el iPhone.
        </div>
      )}
      {notice && (
        <div className="notice" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t.id)}>
            <Icon name={t.icon} size={23} stroke={tab === t.id ? 2.3 : 1.8} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
