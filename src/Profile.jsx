// Pestaña Perfil: tu cuenta, reloj, entrenador/alumnos, cuerpo y ajustes.
import { useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { ProfileModal, logout } from './Account'
import AccountCard from './Account'
import { MyTrainer, Students } from './Trainers'
import { getPolar, syncPolar, connectPolar } from './polar'
import { cloudReady } from './cloud'
import Settings from './Settings'
import { SyncPill } from './ds'

const ago = (iso) => {
  if (!iso) return 'nunca'
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return `el ${new Date(iso).toLocaleDateString('es-ES')}`
}
export const initialOf = (meta) => ((meta?.name || meta?.email || '?').trim()[0] || '?').toUpperCase()

export const Row = ({ icon, title, desc, onClick, busy, danger, badge }) => (
  <button className={'um-row' + (danger ? ' danger' : '')} onClick={onClick} disabled={busy}>
    <span className="um-ic">
      <Icon name={icon} size={19} />
      {badge > 0 && <i className="tab-badge">{badge > 9 ? '9+' : badge}</i>}
    </span>
    <span className="grow">
      <span className="um-t">{title}</span>
      {desc && <span className="um-d">{desc}</span>}
    </span>
    {!danger && <Icon name="right" size={16} className="muted" />}
  </button>
)

export default function Profile({ data, setData, cloud, inbox, onInbox, online }) {
  const m = cloud.meta || {}
  const [sub, setSub] = useState(null) // 'profile' | 'coach' | 'settings'
  const [sync, setSync] = useState({ busy: false, msg: '' })
  const polar = getPolar()
  const trainer = m.role === 'trainer'
  const hasAccount = cloudReady() && !!m.uid

  const syncWatch = async () => {
    if (!polar?.token) {
      setSync({ busy: true, msg: '' })
      connectPolar()
      return
    }
    setSync({ busy: true, msg: '' })
    const before = new Set(Object.keys(data.polar?.exercises || {}))
    try {
      const r = await syncPolar(setData)
      const fresh = r.list.filter((e) => !before.has(String(e.id))).length
      setSync({ busy: false, msg: fresh ? `Reloj sincronizado: ${fresh} entreno${fresh === 1 ? '' : 's'} nuevo${fresh === 1 ? '' : 's'}.` : 'Reloj sincronizado: todo al día.' })
    } catch (e) {
      setSync({ busy: false, msg: e.message === 'AUTH' ? 'Polar ha rechazado el acceso: vuelve a conectarlo en Ajustes.' : 'No se pudo sincronizar ahora. ¿Has sincronizado el reloj con el móvil (Polar Flow)?' })
    }
  }

  if (sub === 'settings') return <Settings data={data} setData={setData} cloud={cloud} onBack={() => setSub(null)} />

  const inboxN = inbox ? inbox.messages + inbox.workouts + inbox.requests : 0
  const inboxTxt = (() => {
    const parts = []
    if (inbox?.requests) parts.push(`${inbox.requests} solicitud${inbox.requests === 1 ? '' : 'es'}`)
    if (inbox?.workouts) parts.push(inbox.workouts === 1 && inbox.changes?.length ? 'cambios en tu entreno por revisar' : `${inbox.workouts} entreno${inbox.workouts === 1 ? '' : 's'} por revisar`)
    if (inbox?.messages) parts.push(`${inbox.messages} mensaje${inbox.messages === 1 ? '' : 's'} nuevo${inbox.messages === 1 ? '' : 's'}`)
    return parts.length ? parts.join(' · ') : trainer ? 'Solicitudes, mensajes y entrenos de tus alumnos' : 'Mensajes y entrenos de tu entrenador'
  })()

  return (
    <div className="page">
      <div className="eyebrow">Tu cuenta</div>
      <h1 className="title">Perfil</h1>
      <div className="prof-head">
        <span className="prof-av">{initialOf(m)}</span>
        <div className="grow">
          <div className="prof-name">{m.name || (hasAccount ? 'Sin nombre' : 'Sin cuenta')}</div>
          {m.email && <div className="prof-sub">{m.email}</div>}
          <div className="prof-sub" style={{ marginTop: 6 }}>
            {hasAccount && <span className="badge" style={{ marginRight: 8 }}>{trainer ? 'Entrenador' : 'Usuario'}</span>}
            <SyncPill cloud={cloud} online={online} />
          </div>
        </div>
      </div>

      {!hasAccount && cloudReady() && <AccountCard data={data} setData={setData} cloud={cloud} />}

      <div className="card prof-list">
        <Row
          icon="watch"
          title={polar?.token ? (sync.busy ? 'Sincronizando reloj…' : 'Sincronizar reloj') : sync.busy ? 'Abriendo Polar…' : 'Conectar reloj Polar'}
          desc={polar?.token ? sync.msg || `Última vez ${ago(data.polar?.lastSync)}` : 'Entras con tu cuenta de Polar y das permiso'}
          onClick={syncWatch}
          busy={sync.busy}
        />
        {hasAccount && <Row icon="user" title="Editar perfil" desc="Nombre, tipo de cuenta y contraseña" onClick={() => setSub('profile')} />}
        {hasAccount && <Row icon="users" title={trainer ? 'Tus alumnos' : 'Entrenador'} badge={inboxN} desc={inboxTxt} onClick={() => setSub('coach')} />}
        <Row icon="settings" title="Ajustes" desc="Objetivos, descanso, avisos, IA, copias" onClick={() => setSub('settings')} />
        {hasAccount && <Row icon="logout" title="Cerrar sesión" danger onClick={() => logout(cloud)} />}
      </div>


      {sub === 'profile' && <ProfileModal email={m.email} onClose={() => setSub(null)} />}
      {sub === 'coach' && (
        <Modal title={trainer ? 'Tus alumnos' : 'Entrenador'} onClose={() => setSub(null)}>
          {trainer ? (
            <Students uid={m.uid} data={data} setData={setData} inbox={inbox} onInbox={onInbox} />
          ) : (
            <MyTrainer uid={m.uid} data={data} setData={setData} inbox={inbox} onInbox={onInbox} />
          )}
        </Modal>
      )}
    </div>
  )
}
