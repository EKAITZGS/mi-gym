// Cuenta (Supabase): entrar, crear cuenta, recuperar contraseña y estado de la copia en la nube
import { useEffect, useState } from 'react'
import { cloudReady, cloudMeta, signIn, signUp, signOut, resetPassword, updatePassword, connect, resolve, summary, sb, getMyProfile, updateProfile, countStudents } from './cloud'
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
  fresh: 'Cuenta nueva lista.',
}

export default function AccountCard({ data, setData, cloud }) {
  const [mode, setMode] = useState('in') // in | up | forgot
  const [f, setF] = useState({ name: '', email: '', pass: '', role: 'user' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { t: 'green' | 'yellow', x }
  const [conflict, setConflict] = useState(null)
  const [profile, setProfile] = useState(false)
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
    else if (r.action !== 'ask') setMsg({ t: 'green', x: RESULT[r.action] })
    setF((s) => ({ ...s, pass: '' }))
  }
  const doIn = () => run(async () => afterLogin(await signIn(f.email, f.pass)))
  const doUp = () =>
    run(async () => {
      if (!f.name.trim()) throw new Error('Pon tu nombre de perfil (es el que verán tu entrenador o tus alumnos).')
      if (f.pass.length < 8) throw new Error('La contraseña necesita al menos 8 caracteres.')
      if (f.pass !== f.pass2) throw new Error('Las contraseñas no coinciden.')
      const { user, session } = await signUp(f.email, f.pass, f.name, f.role)
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
      setMsg({ t: 'green', x: choice === 'cloud' ? RESULT.downloaded : choice === 'fresh' ? 'Cuenta lista, empiezas de cero. Lo que había en el móvil queda guardado aparte.' : RESULT.uploaded })
    })
  const out = () => {
    if (!confirm('¿Cerrar sesión? Para volver a usar la app tendrás que entrar otra vez. Tus datos quedan guardados en tu cuenta.')) return
    run(async () => {
      // antes de salir, sube lo que falte
      if (cloud.meta?.dirty) await cloud.upload()
      if (cloudMeta()?.dirty) throw new Error('No se han podido subir los últimos cambios (¿sin conexión?). Prueba otra vez con internet.')
      await signOut()
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
            <div className="li-t">{m.name || m.email}</div>
            <div className="muted small">
              {m.name ? `${m.email} · ` : ''}
              {m.role === 'trainer' ? 'Cuenta de entrenador' : 'Cuenta de usuario'}
            </div>
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
        {m.pending && m.ask && (
          <div className="acc-conflict">
            <p className="small">
              En este móvil hay datos guardados ({summary(data)}). ¿Son tuyos y quieres pasarlos a tu cuenta?
            </p>
            <button className="btn primary full" disabled={busy} onClick={() => choose('local')}>
              Sí, son míos: pasarlos a mi cuenta
            </button>
            <button className="btn full" disabled={busy} onClick={() => choose('fresh')}>
              No, empezar de cero
            </button>
          </div>
        )}
        {m.pending &&
          !m.ask &&
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
          <button className="btn full" style={{ marginTop: 10 }} onClick={() => setProfile(true)}>
            <Icon name="edit" size={15} /> Editar perfil
          </button>
        )}
        {profile && <ProfileModal email={m.email} onClose={() => setProfile(false)} />}
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
          <button className={mode === 'up' ? 'on' : ''} onClick={() => (setMode('up'), setMsg(null), set('pass2', ''))}>
            Crear cuenta
          </button>
        </div>
      )}
      {mode === 'forgot' && <p className="small" style={{ marginTop: 0 }}>Escribe tu email y te mando un enlace para poner otra contraseña.</p>}
      {mode === 'up' && (
        <>
          <label className="lbl">Nombre de perfil</label>
          <input className="inp" autoComplete="nickname" placeholder="Cómo te verán tu entrenador o tus alumnos" value={f.name} onChange={(e) => set('name', e.target.value.slice(0, 40))} />
        </>
      )}
      <label className="lbl">Email</label>
      <input className="inp" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={(e) => set('email', e.target.value)} />
      {mode !== 'forgot' && (
        <>
          <div className="lbl-row">
            <label className="lbl">Contraseña</label>
            <button type="button" className="link-mini" onClick={() => set('show', !f.show)}>
              {f.show ? 'Ocultar' : 'Ver'}
            </button>
          </div>
          <input
            className="inp"
            type={f.show ? 'text' : 'password'}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            placeholder={mode === 'up' ? '8 caracteres o más' : ''}
            value={f.pass}
            onChange={(e) => set('pass', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && mode === 'in' && doIn()}
          />
        </>
      )}
      {mode === 'up' && (
        <>
          <label className="lbl">Repetir contraseña</label>
          <input
            className="inp"
            type={f.show ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="none"
            value={f.pass2 || ''}
            onChange={(e) => set('pass2', e.target.value)}
          />
          {f.pass2 && f.pass2 !== f.pass && <p className="small" style={{ color: 'var(--warn)', margin: '4px 0 0' }}>No coinciden.</p>}

          <label className="lbl">Tipo de cuenta</label>
          <div className="seg">
            <button className={f.role === 'user' ? 'on' : ''} onClick={() => set('role', 'user')}>
              Usuario
            </button>
            <button className={f.role === 'trainer' ? 'on' : ''} onClick={() => set('role', 'trainer')}>
              Entrenador
            </button>
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            {f.role === 'trainer'
              ? 'Apareces en la lista de entrenadores: los usuarios te piden entrenar y, si aceptas, ves sus entrenos y su progreso. También puedes usar la app para ti. Lo puedes cambiar luego en tu perfil.'
              : 'Usas la app para entrenar y comer, y si quieres puedes pedir a un entrenador que te lleve. Lo puedes cambiar luego en tu perfil.'}
          </p>

          <label className="chk-l uni-l" style={{ marginTop: 12, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={!!f.ok} onChange={(e) => set('ok', e.target.checked)} />
            <span className="small">
              Acepto que mis datos (entrenos, dieta, peso y reloj) se guarden en mi cuenta para usar la app. Solo los verá
              el entrenador que yo acepte, y puedo borrarlos cuando quiera.
            </span>
          </label>
        </>
      )}
      <button
        className="btn primary full"
        style={{ marginTop: 12 }}
        disabled={
          busy ||
          !f.email.includes('@') ||
          (mode !== 'forgot' && !f.pass) ||
          (mode === 'up' && (!f.name.trim() || f.pass.length < 8 || f.pass !== f.pass2 || !f.ok))
        }
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
        Tus datos se guardan solos en tu cuenta y los recuperas si cambias de móvil o borras la app. Si ya tenías datos en
        este móvil, se suben al entrar: no se borra nada.
      </p>
    </div>
  )
}

// Pantalla de entrada: sin sesión no se usa la app. La sesión se queda abierta hasta que la cierres.
export function AuthGate({ data, setData, cloud }) {
  return (
    <div className="gate">
      <div className="gate-in">
        <img src="./app-icon-192.png" alt="" className="gate-logo" />
        <h1 className="gate-t">Mi Gym</h1>
        <p className="muted gate-s">Entrena, come y mira cómo progresas.</p>
        <AccountCard data={data} setData={setData} cloud={cloud} />
      </div>
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
        Contraseña nueva (8 caracteres o más)
      </label>
      <input className="inp" type="password" autoComplete="new-password" value={p} onChange={(e) => setP(e.target.value)} />
      <button className="btn primary full" style={{ marginTop: 12 }} disabled={busy || p.length < 8 || msg?.t === 'green'} onClick={save}>
        Guardar
      </button>
      {msg && <div className={'advice sm ' + msg.t}>{msg.x}</div>}
    </Modal>
  )
}

// Perfil: nombre, tipo de cuenta (te puedes hacer entrenador o dejar de serlo), "sobre mí" y contraseña
export function ProfileModal({ email, onClose }) {
  const [f, setF] = useState(null)
  const [orig, setOrig] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pass, setPass] = useState('')
  useEffect(() => {
    getMyProfile()
      .then((p) => {
        const v = { name: p?.name || '', role: p?.role || 'user', bio: p?.bio || '' }
        setF(v)
        setOrig(v)
      })
      .catch((e) => setMsg({ t: 'yellow', x: e.message }))
  }, [])
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const save = async () => {
    if (!f.name.trim()) return setMsg({ t: 'yellow', x: 'Pon un nombre.' })
    setBusy(true)
    setMsg(null)
    try {
      if (orig.role === 'trainer' && f.role === 'user') {
        const n = await countStudents().catch(() => 0)
        if (n && !confirm(`Si dejas de ser entrenador, tus ${n} alumno${n === 1 ? '' : 's'} y solicitudes se quitan. ¿Seguro?`)) {
          setBusy(false)
          return
        }
      }
      const r = await updateProfile(f)
      setOrig(f)
      setMsg({ t: 'green', x: r.noBio && f.bio ? 'Guardado (falta activar "Sobre ti" en Supabase con 03-perfil.sql).' : 'Perfil guardado.' })
    } catch (e) {
      setMsg({ t: 'yellow', x: e.message })
    }
    setBusy(false)
  }
  const savePass = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await updatePassword(pass)
      setPass('')
      setMsg({ t: 'green', x: 'Contraseña cambiada.' })
    } catch (e) {
      setMsg({ t: 'yellow', x: e.message })
    }
    setBusy(false)
  }
  return (
    <Modal title="Tu perfil" onClose={onClose}>
      {!f ? (
        <p className="muted small">{msg ? '' : 'Cargando…'}</p>
      ) : (
        <>
          <label className="lbl" style={{ marginTop: 0 }}>
            Nombre
          </label>
          <input className="inp" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value.slice(0, 40))} />
          <p className="muted small" style={{ margin: '4px 0 0' }}>Es el que ven tu entrenador o tus alumnos.</p>

          <label className="lbl">Tipo de cuenta</label>
          <div className="seg">
            <button className={f.role === 'user' ? 'on' : ''} onClick={() => set('role', 'user')}>
              Usuario
            </button>
            <button className={f.role === 'trainer' ? 'on' : ''} onClick={() => set('role', 'trainer')}>
              Entrenador
            </button>
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            {f.role === 'trainer'
              ? 'Sales en la lista de entrenadores y puedes aceptar alumnos. Puedes volver a ser usuario cuando quieras.'
              : 'Si te haces entrenador, los usuarios podrán pedirte que les entrenes.'}
          </p>

          {f.role === 'trainer' && (
            <>
              <label className="lbl">Sobre ti</label>
              <textarea
                className="inp"
                rows={3}
                placeholder="Ej.: Entrenador de fuerza. Ayudo a ganar músculo y perder grasa."
                value={f.bio}
                onChange={(e) => set('bio', e.target.value.slice(0, 240))}
              />
              <p className="muted small" style={{ margin: '4px 0 0' }}>Lo ven los usuarios en la lista de entrenadores.</p>
            </>
          )}

          <button
            className="btn primary full"
            style={{ marginTop: 14 }}
            disabled={busy || (orig && f.name === orig.name && f.role === orig.role && f.bio === orig.bio)}
            onClick={save}
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>

          <label className="lbl">Email</label>
          <div className="inp" style={{ opacity: 0.7 }}>
            {email}
          </div>

          <label className="lbl">Cambiar contraseña</label>
          <input className="inp" type="password" autoComplete="new-password" placeholder="Nueva (8 caracteres o más)" value={pass} onChange={(e) => setPass(e.target.value)} />
          <button className="btn full" style={{ marginTop: 8 }} disabled={busy || pass.length < 8} onClick={savePass}>
            Cambiar contraseña
          </button>
        </>
      )}
      {msg && <div className={'advice sm ' + msg.t}>{msg.x}</div>}
    </Modal>
  )
}

// Cerrar sesión (desde Ajustes o el menú): antes sube lo que falte
export async function logout(cloud) {
  if (!confirm('¿Cerrar sesión? Para volver a usar la app tendrás que entrar otra vez. Tus datos quedan guardados en tu cuenta.')) return false
  if (cloud.meta?.dirty) await cloud.upload()
  if (cloudMeta()?.dirty) {
    alert('No se han podido subir los últimos cambios (¿sin conexión?). Prueba otra vez con internet.')
    return false
  }
  await signOut()
  return true
}
