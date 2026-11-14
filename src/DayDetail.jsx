// Detalle de un día: entrenos apuntados + entrenos del reloj (pulso). Lo usan la semana de Entreno y la ficha del alumno.
import { useState } from 'react'
import Icon from './icons'
import { Modal } from './ui'
import { setTxt, WEEKDAYS, todayStr } from './store'
import { EX_BY_ID } from './data/exercises'
import PolarSession, { HrSpark } from './PolarSession'

export const hasSet = (x) => !!(x.r || x.s || x.m || x.km || x.min)
export const doneSessions = (data, date) =>
  (data?.sessions || []).filter((s) => (!date || s.date === date) && Object.values(s.entries || {}).some((l) => l.some(hasSet)))
export const watchOf = (data) => Object.values(data?.polar?.exercises || {}).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
export const nameFor = (data) => (id) => (EX_BY_ID[id]?.name || (data?.myExercises || []).find((x) => x.id === id)?.name || 'Ejercicio propio').replace(/ \(.*\)/, '')

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fmtDay = (s) => {
  const d = new Date(s + 'T12:00:00')
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`
}

// Fila de un entreno del reloj: pulso medio, máximo, minutos y mini curva
export function HrRow({ e, onOpen }) {
  return (
    <button className="sv-hr" onClick={() => onOpen(e)}>
      <Icon name="heart" size={15} />
      <span className="grow">
        {e.sport} ·{' '}
        {e.hrAvg ? (
          <>
            <b>{e.hrAvg}</b> ppm{e.hrMax ? ` (máx. ${e.hrMax})` : ''}
          </>
        ) : (
          'sin pulso'
        )}{' '}
        · {e.min} min
      </span>
      <HrSpark hr={e.hr} w={56} h={20} />
      <Icon name="right" size={14} className="muted" />
    </button>
  )
}

// Tarjeta de un entreno apuntado: ejercicios con sus series, RIR, reloj y nota
export function SessionCard({ s, nameOf, watch = [], onHr, showDate = true }) {
  return (
    <div className="sv-card">
      <div className="sv-head">
        <b>{s.dayName || 'Entreno'}</b>
        {(showDate || s.min) && (
          <span className="sv-chip">
            {showDate ? fmtDay(s.date) : ''}
            {showDate && s.min ? ' · ' : ''}
            {s.min ? `${s.min} min` : ''}
          </span>
        )}
      </div>
      {Object.entries(s.entries || {}).map(([id, sets]) => {
        const done = sets.filter(hasSet)
        if (!done.length) return null
        const rir = s.checkin?.rir?.[id]
        return (
          <div className="sv-ex" key={id}>
            <div className="sv-name">
              {nameOf(id)}
              {rir != null && <span className={'sv-rir' + (rir === 0 ? ' hard' : '')}>RIR {rir}</span>}
            </div>
            <div className="sv-sets">
              {done.map((x, k) => (
                <span className="sv-set" key={k}>
                  {setTxt(x)}
                </span>
              ))}
            </div>
          </div>
        )
      })}
      {watch.map((e) => (
        <HrRow e={e} onOpen={onHr} key={e.id} />
      ))}
      {s.checkin?.note && <div className="sv-note">“{s.checkin.note}”</div>}
    </div>
  )
}

// Al tocar un día de la semana en Entreno
export function DayModal({ data, date, onClose }) {
  const [px, setPx] = useState(null)
  const today = todayStr()
  const wd = new Date(date + 'T12:00:00').getDay()
  const nameOf = nameFor(data)
  const sessions = doneSessions(data, date)
  const watch = watchOf(data)
    .filter((e) => e.date === date)
    .reverse()
  const day = data.polar?.days?.[date]
  const planned = data.plan.filter((p) => p.weekday === wd)
  // si solo hay un entreno apuntado, el del reloj va dentro de su tarjeta
  const inCard = sessions.length === 1
  const title = date === today ? `Hoy · ${fmtDay(date)}` : `${WEEKDAYS[wd]} ${fmtDay(date).split(' ').slice(1).join(' ')}`
  return (
    <Modal title={title} onClose={onClose}>
      {date > today ? (
        planned.length ? (
          planned.map((p) => (
            <div className="sv-card" key={p.id}>
              <div className="sv-head">
                <b>Toca {p.name}</b>
                <span className="sv-chip">{p.items.length} ejercicios</span>
              </div>
              {p.items.map((it) => (
                <div className="sv-row" key={it.id}>
                  <span>{nameOf(it.ex)}</span>
                  <b>
                    {it.sets} × {it.reps}
                  </b>
                </div>
              ))}
            </div>
          ))
        ) : (
          <p className="muted small">Día de descanso: no tienes ningún entreno puesto este día.</p>
        )
      ) : (
        <>
          {sessions.map((s) => (
            <SessionCard key={s.id} s={s} nameOf={nameOf} watch={inCard ? watch : []} onHr={setPx} showDate={false} />
          ))}
          {!sessions.length && (
            <p className="muted small">
              {date === today ? 'Hoy aún no has apuntado ningún entreno.' : 'Ese día no apuntaste ningún entreno.'}
              {planned.length ? ` ${date === today ? 'Toca' : 'Tocaba'} ${planned.map((p) => p.name.trim()).join(' y ')}.` : ''}
            </p>
          )}
          {!inCard && watch.length > 0 && (
            <>
              <h4 style={{ marginTop: 14 }}>Reloj</h4>
              {watch.map((e) => (
                <HrRow e={e} onOpen={setPx} key={e.id} />
              ))}
            </>
          )}
          {day && (day.steps || day.kcal) ? (
            <p className="muted small" style={{ marginTop: 12 }}>
              {day.steps ? `${day.steps.toLocaleString('es-ES')} pasos` : ''}
              {day.steps && day.kcal ? ' · ' : ''}
              {day.kcal ? `${day.kcal} kcal gastadas según el reloj` : ''}
            </p>
          ) : null}
          {!watch.length && data.polar && sessions.length > 0 && <p className="muted small">El reloj no tiene ningún entreno de ese día.</p>}
        </>
      )}
      {px && <PolarSession ex={px} data={data} onClose={() => setPx(null)} />}
    </Modal>
  )
}
