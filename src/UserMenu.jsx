// Menú de la cuenta (botón con tu inicial en la barra de abajo): perfil, reloj, entrenador, ajustes y salir
import { useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { ProfileModal, logout } from './Account'
import { MyTrainer, Students } from './Trainers'
import { getPolar, syncPolar } from './polar'

const ago = (iso) => {
  if (!iso) return 'nunca'
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return `el ${new Date(iso).toLocaleDateString('es-ES')}`
}
export const initialOf = (meta) => ((meta?.name || meta?.email || '?').trim()[0] || '?').toUpperCase()

export default function UserMenu({ data, setData, cloud, onClose, goTab }) {
  const m = cloud.meta || {}
  const [sub, setSub] = useState(null) // 'profile' | 'coach'
  const [sync, setSync] = useState({ busy: false, msg: '' })
  const polar = getPolar()
  const trainer = m.role === 'trainer'

  const syncWatch = async () => {
    if (!polar?.token) {
      onClose()
      goTab('settings')
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

  if (sub === 'profile') return <ProfileModal email={m.email} onClose={() => setSub(null)} />
  if (sub === 'coach')
    return (
      <Modal title={trainer ? 'Tus alumnos' : 'Entrenador'} onClose={() => setSub(null)}>
        {trainer ? <Students uid={m.uid} /> : <MyTrainer uid={m.uid} />}
      </Modal>
    )

  const Row = ({ icon, title, desc, onClick, busy, danger }) => (
    <button className={'um-row' + (danger ? ' danger' : '')} onClick={onClick} disabled={busy}>
      <span className="um-ic">
        <Icon name={icon} size={19} />
      </span>
      <span className="grow">
        <span className="um-t">{title}</span>
        {desc && <span className="um-d">{desc}</span>}
      </span>
      {!danger && <Icon name="right" size={16} className="muted" />}
    </button>
  )

  return (
    <Modal title="Tu cuenta" onClose={onClose}>
      <div className="um-head">
        <span className="um-av big">{initialOf(m)}</span>
        <div className="grow">
          <div className="um-name">{m.name || 'Sin nombre'}</div>
          <div className="muted small">{m.email}</div>
          <div className="small um-role">
            {trainer ? 'Entrenador' : 'Usuario'} · {cloud.busy ? 'guardando…' : m.dirty ? 'cambios por subir' : `guardado ${ago(m.synced)}`}
          </div>
        </div>
      </div>
      <div className="um-list">
        <Row
          icon="watch"
          title={polar?.token ? (sync.busy ? 'Sincronizando reloj…' : 'Sincronizar reloj') : 'Conectar reloj Polar'}
          desc={polar?.token ? sync.msg || `Última vez ${ago(data.polar?.lastSync)}` : 'Se conecta en Ajustes'}
          onClick={syncWatch}
          busy={sync.busy}
        />
        <Row icon="user" title="Perfil" desc="Nombre, tipo de cuenta y contraseña" onClick={() => setSub('profile')} />
        <Row icon="users" title={trainer ? 'Tus alumnos' : 'Entrenador'} desc={trainer ? 'Solicitudes y entrenos de tus alumnos' : 'Pide a un entrenador que te lleve'} onClick={() => setSub('coach')} />
        <Row
          icon="settings"
          title="Ajustes"
          desc="Objetivos, avisos, reloj y más"
          onClick={() => {
            onClose()
            goTab('settings')
          }}
        />
        <Row icon="logout" title="Cerrar sesión" danger onClick={async () => (await logout(cloud)) && onClose()} />
      </div>
    </Modal>
  )
}
