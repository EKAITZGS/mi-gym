// Componentes base de MI-GYM 2.0 (sistema de diseño). Pequeños, sin estado, reutilizables.
import Icon from './icons'

export const Badge = ({ tone = '', children }) => <span className={'badge ' + tone}>{children}</span>

// Cifra destacada: <Stat v={12} unit="kg" label="volumen" />
export const Stat = ({ v, unit, label, tone = '' }) => (
  <div className={'stat ' + tone}>
    <div className="st-v">
      {v}
      {unit && <span>{unit}</span>}
    </div>
    <div className="st-l">{label}</div>
  </div>
)

// Estado vacío / error con acción opcional
export const State = ({ icon = 'info', title, text, action, onAction, error }) => (
  <div className={'state' + (error ? ' error' : '')}>
    <div className="st-ic">
      <Icon name={icon} size={22} />
    </div>
    {title && <b>{title}</b>}
    {text && <p>{text}</p>}
    {action && (
      <button className="btn sm-btn" onClick={onAction}>
        {action}
      </button>
    )}
  </div>
)

export const Skeleton = ({ h = 14, w = '100%', style }) => <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden="true" />

// Estado de guardado: local (sin cuenta), ok, busy (subiendo), warn (sin subir / error)
export function SyncPill({ cloud, online = true }) {
  const m = cloud?.meta
  if (!m?.uid) return (
    <span className="sync-pill local">
      <i /> Guardado en el móvil
    </span>
  )
  if (!online) return (
    <span className="sync-pill warn">
      <i /> Sin conexión · guardado aquí
    </span>
  )
  if (cloud.busy) return (
    <span className="sync-pill busy">
      <i /> Guardando en tu cuenta…
    </span>
  )
  if (cloud.error) return (
    <span className="sync-pill warn">
      <i /> {cloud.error}
    </span>
  )
  if (m.dirty) return (
    <span className="sync-pill warn">
      <i /> Cambios por subir
    </span>
  )
  return (
    <span className="sync-pill ok">
      <i /> Guardado en tu cuenta
    </span>
  )
}

export const fmtMin = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`)
export const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
