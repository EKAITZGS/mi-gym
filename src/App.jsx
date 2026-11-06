import { useState } from 'react'
import { useStore, todayStr } from './store'
import { setCustomExercises } from './data/exercises'
import Home from './Home'
import Workout from './Workout'
import Diet from './Diet'
import Settings from './Settings'
import Icon from './icons'

const TABS = [
  { id: 'home', label: 'Hoy', icon: 'home' },
  { id: 'train', label: 'Entreno', icon: 'dumbbell' },
  { id: 'diet', label: 'Dieta', icon: 'food' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
]

export default function App() {
  const [data, setData] = useStore()
  setCustomExercises(data.myExercises || [])
  const [tab, setTab] = useState('home')
  const [view, setView] = useState({ name: 'list' })

  const start = (dayId) => {
    const day = data.plan.find((d) => d.id === dayId)
    if (!day) return
    if (data.active && data.active.dayId !== dayId) {
      if (!confirm('Tienes otro entreno en curso. ¿Empezar este y descartar el otro?')) return
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
