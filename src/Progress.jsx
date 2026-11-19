import { useMemo, useState } from 'react'
import { fmtKg } from './store'
import { EX_BY_ID } from './data/exercises'
import { Thumb } from './ui'
import { ExerciseModal } from './workout/Library'
import Icon from './icons'
import BodyCard from './Body'
import MonthModal from './Month'
import RankCard from './Rank'
import { recentPRs, stalled, periodStats, consistency, progressRead } from './stats'
import { exHistory } from './progression'
import MuscleMap from './MuscleMap'
import { Stat, miles, fmtMin, Section } from './ds'
import { fmtDate } from './store'
import SleepCard from './Sleep'
import AimCard from './AimCard'

// Récords del último mes y ejercicios que llevan 3 entrenos sin mejorar
function Highlights({ data, onOpen }) {
  const prs = useMemo(() => recentPRs(data.sessions).slice(0, 5), [data.sessions])
  const stuck = useMemo(() => stalled(data.sessions, new Date(), data.plan).filter((x) => EX_BY_ID[x.id]), [data.sessions, data.plan])
  if (!prs.length && !stuck.length) return null
  return (
    <div className="card list-card">
      {prs.length > 0 && (
        <>
          <div className="card-h">
            <Icon name="trophy" size={16} className="gold" />
            <h3>Récords del último mes</h3>
            <span className="card-aside">{prs.length}</span>
          </div>
          {prs.map((p) => (
            <button key={p.id} className="row nob li" onClick={() => onOpen(EX_BY_ID[p.id])}>
              <Thumb ex={EX_BY_ID[p.id]} size={38} />
              <div className="grow">
                <div className="li-t">{EX_BY_ID[p.id]?.name || p.id}</div>
                <div className="muted small">
                  {fmtKg(p.w)} kg × {p.r} · {p.date.slice(8)}/{p.date.slice(5, 7)}
                </div>
              </div>
              <span className="delta up">+{fmtKg(Math.round((p.e - p.prev) * 10) / 10)} kg</span>
            </button>
          ))}
        </>
      )}
      {stuck.length > 0 && (
        <>
          <div className={'card-h' + (prs.length ? ' mt-3' : '')}>
            <Icon name="trend" size={16} />
            <h3>Estancados</h3>
            <span className="card-aside">{stuck.length}</span>
          </div>
          <p className="muted small mt-0">
            3 entrenos sin mejorar. Prueba otro rango de reps, una semana de descarga o una variante del ejercicio.
          </p>
          {stuck.map((x) => (
            <button key={x.id} className="row nob li" onClick={() => onOpen(EX_BY_ID[x.id])}>
              <Thumb ex={EX_BY_ID[x.id]} size={38} />
              <div className="grow">
                <div className="li-t">{EX_BY_ID[x.id].name}</div>
                <div className="muted small">Mejor 1RM est. {fmtKg(Math.round(x.best * 10) / 10)} kg</div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

// Pestaña Progreso: lo que antes iba al final de Inicio (rangos, series por músculo, cuerpo y fuerza)
const KIND = { weight: 'Más peso', reps: 'Más reps', volume: 'Más volumen', flat: 'Estable', down: 'Bajón', few: 'Pocos datos' }

export default function Progress({ data, setData }) {
  const [open, setOpen] = useState(null)
  const [month, setMonth] = useState(false)
  const [all, setAll] = useState(false)
  const head = useMemo(() => {
    const d = new Date()
    const m0 = fmtDate(new Date(d.getFullYear(), d.getMonth(), 1))
    const w = new Date(d)
    w.setDate(w.getDate() - ((w.getDay() + 6) % 7))
    return { month: periodStats(data.sessions, m0), week: periodStats(data.sessions, fmtDate(w)), all: periodStats(data.sessions, '0000'), cons: consistency(data.sessions) }
  }, [data.sessions, data.plan])

  const progress = useMemo(() => {
    const ids = [...new Set(data.sessions.flatMap((s) => Object.keys(s.entries || {})))]
    return ids
      .map((id) => {
        const st = exHistory(data.sessions, id, data.plan)
        if (!st.length || !EX_BY_ID[id]) return null
        return { id, n: st.length, first: st[0].best.e, last: st[st.length - 1].best.e, read: progressRead(st) }
      })
      .filter(Boolean)
      .sort((a, b) => b.n - a.n)
  }, [data.sessions])

  return (
    <div className="page wide">
      <h1 className="title">Progreso</h1>
      {/* escritorio: «Entreno» a la izquierda; objetivo y «Cuerpo y descanso» a la derecha (mismo orden en móvil) */}
      <div className="prog-grid">
      <div className="ga-aim">
      <AimCard data={data} setData={setData} />
      </div>

      <div className="ga-ent">
      <Section title="Entreno">
      <MuscleMap data={data} />
      <Highlights data={data} onOpen={setOpen} />
      {progress.length === 0 ? (
        <div className="card">
          <div className="card-h">
            <Icon name="trend" size={16} />
            <h3>Historial por ejercicio</h3>
          </div>
          <p className="muted small m-0">Cuando registres entrenos verás aquí cómo sube tu fuerza en cada ejercicio.</p>
        </div>
      ) : (
        <div className="card list-card">
          <div className="card-h">
            <Icon name="trend" size={16} />
            <h3>Historial por ejercicio</h3>
            <span className="card-aside">{progress.length} ejercicios</span>
          </div>
          {progress.slice(0, all ? undefined : 5).map((p) => {
            const diff = p.last - p.first
            return (
              <button key={p.id} className="row nob li" onClick={() => setOpen(EX_BY_ID[p.id])}>
                <Thumb ex={EX_BY_ID[p.id]} size={42} />
                <div className="grow">
                  <div className="li-t">{EX_BY_ID[p.id].name}</div>
                  <div className="muted small">
                    1RM est. {fmtKg(Math.round(p.last * 10) / 10)} kg · {p.n} {p.n === 1 ? 'sesión' : 'sesiones'} · <span className={'prog-kind ' + p.read.kind}>{KIND[p.read.kind]}</span>
                  </div>
                </div>
                {p.n > 1 && (
                  <span className={'delta ' + (diff >= 0 ? 'up' : 'down')}>
                    {diff >= 0 ? '+' : ''}
                    {fmtKg(Math.round(diff * 10) / 10)} kg
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
      {!all && progress.length > 5 && (
        <button className="link small" onClick={() => setAll(true)}>
          Ver los {progress.length} ejercicios
        </button>
      )}
      <button className="link small month-link" onClick={() => setMonth(true)}>
        <Icon name="calendar" size={15} /> Ver resumen del mes
      </button>
      {data.sessions.length > 0 && (
        <details className="card rank-fold">
          <summary>
            <span className="card-h m-0">
              <Icon name="trophy" size={16} />
              <h3>Tu personaje</h3>
              <span className="card-aside">rangos por músculo</span>
            </span>
          </summary>
          <RankCard data={data} />
        </details>
      )}
      </Section>
      </div>

      <div className="ga-body">
      <Section title="Cuerpo y descanso">
        <BodyCard data={data} setData={setData} />
        <SleepCard data={data} setData={setData} />
      </Section>
      </div>
      </div>
      {month && <MonthModal data={data} onClose={() => setMonth(false)} />}
      {open && <ExerciseModal ex={open} data={data} setData={setData} onClose={() => setOpen(null)} />}
    </div>
  )
}
