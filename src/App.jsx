import { useEffect, useState } from 'react'
import { useStore, todayStr, prefillSets } from './store'
import { setCustomExercises } from './data/exercises'
import Home from './Home'
import Workout, { editGuard } from './Workout'
import Diet from './Diet'
import Progress from './Progress'
import Profile, { initialOf } from './Profile'
import StartSheet from './StartSheet'
import Icon from './icons'
import { readPolarReturn, getPolar, syncPolar } from './polar'
import { checkServerAi } from './ai'
import { syncPush } from './push'
import { useCloudSync, cloudReady, inbox } from './cloud'
import { NewPassword, AuthGate } from './Account'

// Navegación principal (móvil: barra inferior; escritorio: lateral)
const TABS = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'train', label: 'Entrenamiento', icon: 'dumbbell' },
  { id: 'routines', label: 'Rutinas', icon: 'list' },
  { id: 'progress', label: 'Progreso', icon: 'trend' },
]

const useOnline = () => {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const a = () => setOn(true)
    const b = () => setOn(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', b)
    return () => {
      window.removeEventListener('online', a)
      window.removeEventListener('offline', b)
    }
  }, [])
  return on
}

export default function App() {
  const [data, setData] = useStore()
  // copia en la nube (si hay cuenta): sube los cambios y baja los de otro móvil
  const cloud = useCloudSync(data, setData)
  const online = useOnline()
  // avisos del entrenador / alumnos: mensajes sin leer, entrenos mandados y solicitudes
  const [box, setBox] = useState(null)
  const refreshBox = () => {
    if (!cloud.meta?.uid || cloud.meta.pending) return
    inbox()
      .then((r) => {
        if (!r) return
        setBox((prev) => {
          const was = prev || { messages: 0, workouts: 0, requests: 0 }
          if (r.workouts > was.workouts) setNotice(r.workouts === 1 ? (r.changes?.length ? `Tu entrenador te propone cambios en tu día ${r.changes[0]}. Míralo en Perfil → Entrenador.` : 'Tu entrenador te ha mandado un entreno. Míralo en Perfil → Entrenador.') : `Tienes ${r.workouts} entrenos de tu entrenador por revisar (Perfil → Entrenador).`)
          else if (r.requests > was.requests) setNotice('Tienes una solicitud de alumno nueva (Perfil → Tus alumnos).')
          else if (r.messages > was.messages) setNotice(r.messages === 1 ? 'Tienes un mensaje nuevo (Perfil).' : `Tienes ${r.messages} mensajes nuevos (Perfil).`)
          return r
        })
      })
      .catch(() => {})
  }
  useEffect(() => {
    if (!cloud.meta?.uid) return setBox(null)
    refreshBox()
    const onVis = () => document.visibilityState === 'visible' && refreshBox()
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(() => document.visibilityState === 'visible' && refreshBox(), 60000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(t)
    }
  }, [cloud.meta?.uid, cloud.meta?.pending])
  const boxN = box ? box.messages + box.workouts + box.requests : 0
  setCustomExercises(data.myExercises || [])
  // Si hay un entreno de hoy a medias (p. ej. la app se recargó por una actualización), vuelve directo a él
  const resume = data.active && data.active.date === todayStr()
  const [tab, setTab] = useState(resume ? 'train' : 'home')
  const [view, setView] = useState(resume ? { name: 'session' } : { name: 'list' })
  const [notice, setNotice] = useState(null)
  const [startSheet, setStartSheet] = useState(false)
  const storedPolarEx = () => { try { return JSON.parse(localStorage.getItem('migym.v1') || '{}').polar?.exercises || {} } catch { return {} } }

  // al abrir el enlace de confirmación del email
  useEffect(() => {
    if (cloud.confirmed) setNotice('Email confirmado. Ya puedes entrar con tu cuenta.')
  }, [cloud.confirmed])

  // ¿hay IA sin clave en el Worker?
  useEffect(() => {
    checkServerAi()
  }, [])

  // Polar: al volver de dar permiso, y sincronización automática al abrir, al volver a la app y cada 5 min con la app abierta
  useEffect(() => {
    const ret = readPolarReturn()
    if (ret) {
      // al volver de Polar: te quedas en Inicio y se sincroniza solo (si falla, Perfil para reintentar)
      if (!ret.ok) setTab('profile')
      setNotice(ret.ok ? 'Polar conectado. Trayendo los datos del reloj…' : `No se pudo conectar Polar (${ret.error}).`)
    }
    let lastTry = 0
    const auto = (force) => {
      const p = getPolar()
      if (!p?.token) return
      if (!force && Date.now() - lastTry < 60 * 1000) return
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
    const every = setInterval(() => document.visibilityState === 'visible' && auto(false), 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(every)
    }
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
        // el peso de la última vez ya puesto; las reps de hoy empiezan vacías
        entries[it.ex] = prefillSets(data.sessions, it.ex, it.sets, it.drop)
      }
      setData((d) => ({
        ...d,
        active: { dayId, name: day.name, date: todayStr(), start: Date.now(), items: day.items.map((i) => ({ ...i })), entries },
      }))
    }
    setTab('train')
    setView({ name: 'session' })
  }

  const startFree = () => {
    if (data.active && data.active.dayId !== 'free' && !confirm('Tienes otro entreno en curso. ¿Empezar uno libre y descartar el otro?')) return
    if (!data.active || data.active.dayId !== 'free')
      setData((d) => ({ ...d, active: { dayId: 'free', name: 'Entreno libre', date: todayStr(), start: Date.now(), items: [], entries: {} } }))
    setTab('train')
    setView({ name: 'session' })
  }

  const goTab = (id) => {
    if (editGuard.dirty && !confirm('Tienes cambios sin guardar en el día que estás editando. ¿Salir sin guardar?')) return
    editGuard.dirty = false
    setTab(id)
    // Entrenamiento y Rutinas comparten las vistas (sesión, editor, biblioteca): al cambiar se vuelve a la lista,
    // salvo que haya una sesión en pantalla y vayas a Entrenamiento (se sigue con ella)
    if (id === 'train' && view.name === 'session') return
    if (id === 'train' || id === 'routines') setView({ name: 'list' })
  }

  // hace falta cuenta para usar la app (la sesión se queda abierta hasta cerrar sesión)
  if (cloudReady() && (!cloud.meta?.uid || cloud.meta.pending))
    return (
      <>
        <AuthGate data={data} setData={setData} cloud={cloud} />
        {cloud.recovery && <NewPassword onDone={cloud.doneRecovery} />}
        {notice && (
          <div className="notice" onClick={() => setNotice(null)}>
            {notice}
          </div>
        )}
      </>
    )

  const openStart = () => setStartSheet(true)
  const navBtn = (t) => (
    <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
      <Icon name={t.icon} size={23} stroke={tab === t.id ? 2.3 : 1.8} />
      <span className="tab-label">{t.label}</span>
    </button>
  )

  return (
    <div className="app">
      {!online && (
        <div className="offline-bar" role="status">
          <Icon name="offline" size={15} /> Sin conexión: todo se guarda en el móvil y se subirá al volver
        </div>
      )}
      <main className="main">
        {tab === 'home' && <Home data={data} setData={setData} onStart={start} go={goTab} onOpenStart={openStart} name={cloud.meta?.name} />}
        {(tab === 'train' || tab === 'routines') && (
          <Workout data={data} setData={setData} view={view} setView={setView} onStart={start} onStartFree={startFree} mode={tab} onOpenStart={openStart} goTab={goTab} cloud={cloud} online={online} />
        )}
        {tab === 'diet' && <Diet data={data} setData={setData} onBack={() => goTab('home')} />}
        {tab === 'progress' && <Progress data={data} setData={setData} go={goTab} />}
        {tab === 'profile' && <Profile data={data} setData={setData} cloud={cloud} inbox={box} onInbox={refreshBox} online={online} />}
      </main>
      {cloud.recovery && <NewPassword onDone={cloud.doneRecovery} />}
      {saveFail && (
        <div className="notice" style={{ background: 'var(--danger)', color: '#fff', top: 0 }} role="alert">
          No se está guardando: lo de ahora se perderá al cerrar. Haz una copia en Perfil → Ajustes y libera espacio en el iPhone.
        </div>
      )}
      {notice && (
        <div className="notice" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      {startSheet && <StartSheet data={data} onStart={start} onStartFree={startFree} onClose={() => setStartSheet(false)} onRoutines={() => goTab('routines')} />}
      <nav className="tabbar" aria-label="Navegación principal">
        <div className="nav-brand">
          <img src="./logo.svg" alt="" />
          MI-GYM
        </div>
        {TABS.map(navBtn)}
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => goTab('profile')} aria-label="Perfil" aria-current={tab === 'profile' ? 'page' : undefined}>
          <span className="tab-av">
            {cloudReady() ? initialOf(cloud.meta) : <Icon name="user" size={15} />}
            {boxN > 0 && <i className="tab-badge">{boxN > 9 ? '9+' : boxN}</i>}
          </span>
          <span className="tab-label">Perfil</span>
        </button>
      </nav>
    </div>
  )
}
