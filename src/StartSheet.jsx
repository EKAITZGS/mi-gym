// "Comenzar entrenamiento": continuar el que está a medias, el de hoy, otra rutina o uno libre.
import { Modal } from './ui'
import Icon from './icons'
import { EX_BY_ID } from './data/exercises'
import { WEEKDAYS, todayStr } from './store'

export default function StartSheet({ data, onStart, onStartFree, onClose, onRoutines }) {
  const wd = new Date().getDay()
  const act = data.active
  const actDay = act && act.dayId !== 'free' ? data.plan.find((d) => d.id === act.dayId) : null
  const todays = data.plan.filter((d) => d.weekday === wd && d.id !== act?.dayId)
  const others = data.plan.filter((d) => d.weekday !== wd && d.id !== act?.dayId)
  const doneToday = new Set(data.sessions.filter((s) => s.date === todayStr()).map((s) => s.dayId))
  const sum = (d) => {
    const groups = [...new Set(d.items.map((i) => EX_BY_ID[i.ex]?.group).filter(Boolean))]
    return `${d.items.length} ejercicios${groups.length ? ' · ' + groups.slice(0, 3).join(', ') : ''}`
  }
  const Opt = ({ icon, title, desc, primary, onClick }) => (
    <button className={'start-opt' + (primary ? ' primary' : '')} onClick={onClick}>
      <span className="so-ic">
        <Icon name={icon} size={20} />
      </span>
      <span className="grow">
        <span className="so-t">{title}</span>
        {desc && <span className="so-d">{desc}</span>}
      </span>
      <Icon name="right" size={16} className="muted" />
    </button>
  )
  return (
    <Modal title="Comenzar entrenamiento" onClose={onClose}>
      {act && (
        <Opt
          icon="play"
          primary
          title={`Continuar: ${act.name || actDay?.name || 'Entreno'}`}
          desc={act.date === todayStr() ? 'Entreno a medias de hoy' : `Empezado el ${act.date.slice(8)}/${act.date.slice(5, 7)} · se guarda con fecha de hoy`}
          onClick={() => (onClose(), act.dayId === 'free' ? onStartFree() : onStart(act.dayId))}
        />
      )}
      {todays.map((d) => (
        <Opt key={d.id} icon="calendar" primary={!act} title={d.name} desc={`${doneToday.has(d.id) ? 'Ya hecho hoy · ' : 'Programado para hoy · '}${sum(d)}`} onClick={() => (onClose(), onStart(d.id))} />
      ))}
      {others.length > 0 && <h4 style={{ marginTop: 14 }}>Otra rutina</h4>}
      {others.map((d) => (
        <Opt key={d.id} icon="list" title={d.name} desc={`${d.weekday != null ? WEEKDAYS[d.weekday] + ' · ' : ''}${sum(d)}`} onClick={() => (onClose(), onStart(d.id))} />
      ))}
      <h4 style={{ marginTop: 14 }}>Sin plan</h4>
      <Opt icon="bolt" title="Entreno libre" desc="Añades los ejercicios sobre la marcha" onClick={() => (onClose(), onStartFree())} />
      {data.plan.length === 0 && onRoutines && (
        <button className="link" onClick={() => (onClose(), onRoutines())}>
          Crear mi rutina primero
        </button>
      )}
    </Modal>
  )
}
