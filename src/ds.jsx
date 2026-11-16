// Componentes base de MI-GYM 2.0 (sistema de diseño). Pequeños, sin estado, reutilizables.
import { cloneElement, isValidElement, useId } from 'react'
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

// ---- Sistema de diseño 2.0 · componentes comunes ----
// Las clases CSS (.btn, .card, .seg, .row…) siguen siendo la base; estos componentes las montan siempre igual.
const cx = (...l) => l.filter(Boolean).join(' ')

// Botón: variant primary (lima) | secondary (superficie, por defecto) | ghost (transparente) | danger
// loading = deshabilitado con indicador; done = confirmado (✓)
export function Button({ variant = 'secondary', size, full, loading, done, icon, className = '', children, type = 'button', disabled, ...p }) {
  return (
    <button
      type={type}
      {...p}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx('btn', variant === 'primary' && 'primary', variant === 'ghost' && 'ghost', variant === 'danger' && 'danger', size === 'sm' && 'sm-btn', full && 'full', loading && 'is-loading', done && 'is-done', className)}
    >
      {done ? <Icon name="check" size={16} /> : icon && !loading ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  )
}

// Botón solo con icono (siempre con nombre para lectores de pantalla)
export const IconButton = ({ icon, label, ghost, size = 18, className = '', ...p }) => (
  <button type="button" {...p} className={cx('icon-btn', ghost && 'ghost', className)} aria-label={label} title={label}>
    <Icon name={icon} size={size} />
  </button>
)

// Tarjeta con cabecera fija: icono · título · dato a la derecha
export const Card = ({ icon, title, aside, className = '', children, ...p }) => (
  <div {...p} className={cx('card', className)}>
    {(title || icon) && (
      <div className="card-h">
        {icon && <Icon name={icon} size={16} />}
        {title && <h3>{title}</h3>}
        {aside != null && <span className="card-aside">{aside}</span>}
      </div>
    )}
    {children}
  </div>
)

// Título de sección (MAYÚSCULAS pequeñas) con dato opcional a la derecha
export const Section = ({ title, aside, children }) => (
  <section className="ds-section">
    <div className="section-h">
      <h4>{title}</h4>
      {aside != null && <span className="muted small">{aside}</span>}
    </div>
    {children}
  </section>
)

// Campo: etiqueta, control, ayuda o error. right = acción a la derecha de la etiqueta (p. ej. "Ver")
export const Field = ({ label, hint, error, right, children, className = '' }) => {
  // la etiqueta queda unida al campo (lectores de pantalla y tocar la etiqueta enfoca el campo)
  const auto = useId()
  const id = (isValidElement(children) && children.props.id) || auto
  const control = isValidElement(children) && label ? cloneElement(children, { id }) : children
  return (
    <div className={cx('field', error && 'error', className)}>
      {(label || right) && (
        <div className="field-row">
          {label && <label className="lbl" htmlFor={id}>{label}</label>}
          {right}
        </div>
      )}
      {control}
      {error ? <p className="field-err" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  )
}

// Selector segmentado: options = [{ v, label }]
export const Segmented = ({ options, value, onChange, label, className = '' }) => (
  <div className={cx('seg', className)} role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
    {options.map((o) => (
      <button type="button" key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>
        {o.label}
      </button>
    ))}
  </div>
)

// Fila de lista: icono o miniatura, título, subtítulo, lado derecho y flecha
export const ListRow = ({ icon, thumb, title, sub, right, onClick, chevron = !!onClick, className = '' }) => {
  const body = (
    <>
      {thumb}
      {icon && (
        <span className="lr-ic">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="lr-main">
        <span className="li-t">{title}</span>
        {sub && <span className="lr-sub">{sub}</span>}
      </span>
      {right}
      {chevron && <Icon name="right" size={16} className="lr-chev" />}
    </>
  )
  return onClick ? (
    <button type="button" className={cx('row list-row', className)} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cx('row list-row', className)}>{body}</div>
  )
}

// Estado vacío (mismo componente que State)
export const EmptyState = State
