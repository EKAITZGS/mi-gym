import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { editGuard } from './Workout'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// Actualización automática: al abrir la app (o volver a ella) busca versión nueva y recarga sola.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => reg.update().catch(() => {})
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    setInterval(check, 30 * 60 * 1000)
  },
  onNeedRefresh() {
    const apply = () => (editGuard.dirty ? setTimeout(apply, 30000) : updateSW(true))
    apply()
  },
})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Pantalla de entrada: se ve al menos ~1,3 s y luego se desvanece
const t0 = window.__t0 || performance.now()
const splash = document.getElementById('splash')
if (splash) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const wait = Math.max(0, (reduce ? 300 : 1350) - (performance.now() - t0))
  setTimeout(() => {
    splash.classList.add('out')
    setTimeout(() => splash.remove(), 450)
  }, wait)
}
