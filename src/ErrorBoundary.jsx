// Si algo revienta al pintar, en vez de pantalla negra: aviso, recargar y copia de seguridad.
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) {
    return { err }
  }
  componentDidCatch(err) {
    try {
      console.error('MI-GYM error', err)
    } catch {}
  }
  backup = () => {
    try {
      const json = localStorage.getItem('migym.v1') || '{}'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      a.download = `mi-gym-copia-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
    } catch {}
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="page" style={{ paddingTop: 48 }}>
        <h1 className="title">Algo ha fallado</h1>
        <p className="muted">Tus datos están guardados en el móvil (y en tu cuenta si la tienes). Recarga la app; si vuelve a pasar, haz una copia y cuéntamelo.</p>
        <p className="muted small" style={{ wordBreak: 'break-word' }}>{String(this.state.err?.message || this.state.err)}</p>
        <button className="btn primary full" onClick={() => location.reload()}>
          Recargar
        </button>
        <button className="btn full" onClick={this.backup}>
          Descargar copia de mis datos
        </button>
      </div>
    )
  }
}
