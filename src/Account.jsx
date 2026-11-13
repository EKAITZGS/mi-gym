// Cuenta (Supabase): entrar, crear cuenta, recuperar contraseña y estado de la copia en la nube
import { useState } from 'react'
import { cloudReady, signIn, signUp, signOut, resetPassword, updatePassword, connect, resolve, summary, sb } from './cloud'
import { Modal } from './ui'
import Icon from './icons'

const ago = (iso) => {
  if (!iso) return ''
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return `el ${new Date(iso).toLocaleDateString('es-ES')}`
}

const RESULT = {
  uploaded: 'Listo: tus datos ya están guardados en tu cuenta.',
  downloaded: 'Datos de tu cuenta cargados en este móvil.',
  same: 'Todo al día: este móvil y tu cuenta tienen lo mismo.',
}

export default function AccountCard({ data, setData, cloud }) {
  const [mode, setMode] = useState('in') // in | up | forgot
  const [f, setF] = useState({ name: '', email: '', pass: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { t: 'green' | 'yellow', x }
  const [conflict, setConflict] = useState(null)
  if (!cloudReady()) return null
  const m = cloud.meta
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const run = async (fn) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ t: 'yellow', x: e.message })
    }
    setBusy(false)
  }
  const afterLogin = async (user) => {
    const r = await connect(user, data, setData)
    if (r.action === 'conflict') setConflict(r.cloud)
    else setMsg({ t: 'green', x: RESULT[r.action] })
    setF((s) => ({ ...s, pass: '' }))
  }
  const doIn = () => run(async () => afterLogin(await signIn(f.email, f.pass)))
  const doUp = () =>
    run(async () => {
      if (f.pass.length < 6) throw new Error('La contraseña necesita al menos 6 caracteres.')
      const { user, session } = await signUp(f.email, f.pass, f.name)
      if (session) return afterLogin(user)
      setMode('in')
      setMsg({ t: 'green', x: `Te he mandado un email a ${f.email.trim()}. Ábrelo, pulsa el enlace para confirmar y vuelve aquí a entrar.` })
    })
  const doForgot = () =>
    run(async () => {
      await resetPassword(f.email)
      setMode('in')
      setMsg({ t: 'green', x: 'Te he mandado un email para poner una contraseña nueva. Ábrelo desde este iPhone.' })
    })
  const recheck = () =>
    run(async () => {
      const c = await sb()
      const { data: s } = await c.auth.getSession()
      if (!s.session) {
        await signOut()
        throw new Error('Tu sesión ha caducado: vuelve a entrar.')
      }
      await afterLogin(s.session.user)
    })
  const choose = (choice) =>
    run(async () => {
      await resolve(choice, conflict, data, setData)
      setConflict(null)
      setMsg({ t: 'green', x: choice === 'cloud' ? RESULT.downloaded : RESULT.uploaded })
    })
  const out = () => {
    if (!confirm('¿Cerrar sesión? Tus datos se quedan en este móvil, solo deja de guardarse la copia en la nube.')) return
    run(async () => {
      await signOut()
      setMsg({ t: 'green', x: 'Sesión cerrada. Tus datos siguen en este móvil.' })
    })
  }

  const note = msg && <div className={'advice sm ' + msg.t}>{msg.x}</div>

  // con sesión
  if (m?.uid) {
    return (
      <div className="card account">
        <div className="row nob">
          <span className="rest-ic">
            <Icon name="check" size={20} />
          </span>
          <div className="grow">
            <div className="li-t">{m.email}</div>
            <div className="muted small">
              {m.pending
                ? 'Falta elegir qué datos usar'
                : cloud.busy
                  ? 'Guardando en la nube…'
                  : m.dirty
                    ? 'Hay cambios por subir'
                    : `Guardado en la nube ${ago(m.synced)}`}
            </div>
          </div>
        </div>
        {m.pending &&
          (conflict ? (
            <div className="acc-conflict">
              <p className="small">
                Tienes datos distintos en tu cuenta y en este móvil. Elige cuáles usar (los otros se guardan aparte por si
                acaso):
              </p>
              <button className="btn full" disabled={busy} onClick={() => choose('local')}>
                Usar los de este móvil · {summary(data)}
              </button>
              <button className="btn full" disabled={busy} onClick={() => choose('cloud')}>
                Usar los de la cuenta · {summary(conflict.data)} · {ago(conflict.updated_at)}
              </button>
            </div>
          ) : (
            <button className="btn full" disabled={busy} onClick={recheck}>
              Elegir qué datos usar
            </button>
          ))}
        {cloud.error && !msg && <div className="advice sm yellow">{cloud.error}</div>}
        {note}
        {!m.pending && (
          <div className="btns">
            <button className="btn" disabled={busy || cloud.busy} onClick={() => cloud.download()}>
              Sincronizar ahora
            </button>
            <button className="btn" disabled={busy} onClick={out}>
              Cerrar sesión
            </button>
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Entrenos, plan, dieta, cuerpo y reloj se guardan solos en tu cuenta. Las fotos de progreso se quedan solo en el
          móvil.
        </p>
      </div>
    )
  }

  // sin sesión
  return (
    <div className="card account">
      {mode !== 'forgot' && (
        <div className="seg">
          <button className={mode === 'in' ? 'on' : ''} onClick={() => (setMode('in'), setMsg(null))}>
            Entrar
          </button>
          <button className={mode === 'up' ? 'on' : ''} onClick={() => (setMode('up'), setMsg(null))}>
            Crear cuenta
          </button>
        </div>
      )}
      {mode === 'forgot' && <p className="small" style={{ marginTop: 0 }}>Escribe tu email y te mando un enlace para poner otra contraseña.</p>}
      {mode === 'up' && (
        <>
          <label className="lbl">Nombre</label>
          <input className="inp" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value.slice(0, 40))} />
        </>
      )}
      <label className="lbl">Email</label>
      <input className="inp" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={(e) => set('email', e.target.value)} />
      {mode !== 'forgot' && (
        <>
          <label className="lbl">Contraseña</label>
          <input
            className="inp"
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={f.pass}
            onChange={(e) => set('pass', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (mode === 'up' ? doUp() : doIn())}
          />
        </>
      )}
      <button
        className="btn primary full"
        style={{ marginTop: 12 }}
        disabled={busy || !f.email.includes('@') || (mode !== 'forgot' && !f.pass)}
        onClick={mode === 'up' ? doUp : mode === 'forgot' ? doForgot : doIn}
      >
        {busy ? 'Un momento…' : mode === 'up' ? 'Crear cuenta' : mode === 'forgot' ? 'Mandar enlace' : 'Entrar'}
      </button>
      {note}
      {mode === 'in' && (
        <button className="link" onClick={() => (setMode('forgot'), setMsg(null))}>
          He olvidado mi contraseña
        </button>
      )}
      {mode === 'forgot' && (
        <button className="link" onClick={() => setMode('in')}>
          Volver
        </button>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>
        Con cuenta, tus datos se guardan solos en la nube y los recuperas si cambias de móvil o borras la app. Al entrar
        se suben los que tienes ahora: no se borra nada.
      </p>
    </div>
  )
}

// Al abrir el enlace de "he olvidado mi contraseña"
export function NewPassword({ onDone }) {
  const [p, setP] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const save = async () => {
    setBusy(true)
    try {
      await updatePassword(p)
      setMsg({ t: 'green', x: 'Contraseña cambiada. Ya puedes entrar en la app con ella.' })
    } catch (e) {
      setMsg({ t: 'yellow', x: e.message })
    }
    setBusy(false)
  }
  return (
    <Modal title="Nueva contraseña" onClose={onDone}>
      <label className="lbl" style={{ marginTop: 0 }}>
        Contraseña nueva (6 caracteres o más)
      </label>
      <input className="inp" type="password" autoComplete="new-password" value={p} onChange={(e) => setP(e.target.value)} />
      <button className="btn primary full" style={{ marginTop: 12 }} disabled={busy || p.length < 6 || msg?.t === 'green'} onClick={save}>
        Guardar
      </button>
      {msg && <div className={'advice sm ' + msg.t}>{msg.x}</div>}
    </Modal>
  )
}
