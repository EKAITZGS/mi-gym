import { useMemo, useState } from 'react'
import { exStats, fmtKg } from './store'
import { EX_BY_ID } from './data/exercises'
import { Thumb } from './ui'
import { ExerciseModal } from './Workout'
import Icon from './icons'
import BodyCard from './Body'
import MonthModal from './Month'
import RankCard from './Rank'
import { MuscleSets } from './Extras'

// Pestaña Progreso: lo que antes iba al final de Inicio (rangos, series por músculo, cuerpo y fuerza)
export default function Progress({ data, setData }) {
  const [open, setOpen] = useState(null)
  const [month, setMonth] = useState(false)
  const [all, setAll] = useState(false)

  const progress = useMemo(() => {
    const ids = [...new Set(data.sessions.flatMap((s) => Object.keys(s.entries || {})))]
    return ids
      .map((id) => {
        const st = exStats(data.sessions, id)
        if (!st.length || !EX_BY_ID[id]) return null
        return { id, n: st.length, first: st[0].best.e, last: st[st.length - 1].best.e }
      })
      .filter(Boolean)
      .sort((a, b) => b.n - a.n)
  }, [data.sessions])

  return (
    <div className="page">
      <h1 className="title">Progreso</h1>
      <RankCard data={data} />
      <MuscleSets data={data} />
      <BodyCard data={data} setData={setData} />

      <div className="sec-head">
        <h4>Fuerza por ejercicio</h4>
      </div>
      {progress.length === 0 ? (
        <p className="muted small">Cuando registres entrenos verás aquí cómo sube tu fuerza en cada ejercicio.</p>
      ) : (
        <div className="card list-card">
          {progress.slice(0, all ? undefined : 5).map((p) => {
            const diff = p.last - p.first
            return (
              <button key={p.id} className="row nob li" onClick={() => setOpen(EX_BY_ID[p.id])}>
                <Thumb ex={EX_BY_ID[p.id]} size={42} />
                <div className="grow">
                  <div className="li-t">{EX_BY_ID[p.id].name}</div>
                  <div className="muted small">1RM est. {fmtKg(Math.round(p.last * 10) / 10)} kg</div>
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
        <Icon name="trend" size={15} /> Ver resumen del mes
      </button>
      {month && <MonthModal data={data} onClose={() => setMonth(false)} />}
      {open && <ExerciseModal ex={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  )
}
