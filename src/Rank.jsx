import { useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { muscleRanks, symmetry } from './ranks'
import { EX_BY_ID } from './data/exercises'
import { fmtKg } from './store'
import Mannequin from './Mannequin'

export const RankBadge = ({ rank, sm }) =>
  rank ? (
    <span className={'rank-badge' + (sm ? ' sm' : '')} style={{ '--rc': rank.color }}>
      <i /> {rank.name}
    </span>
  ) : (
    <span className={'rank-badge none' + (sm ? ' sm' : '')}>Sin datos</span>
  )

// Qué falta para el siguiente rango (el rango sale de varios ejercicios a la vez)
function needTxt(g) {
  const n = g.need
  if (!n) return 'Rango máximo.'
  const to = `Para ${n.rank.name}: `
  if (n.more) return to + `entrena ${n.more === 1 ? 'otro ejercicio' : `${n.more} ejercicios más`} de ${g.group.toLowerCase()} (el rango sale de tus 3 mejores a la vez).`
  if (n.compound) return to + 'añade algún ejercicio básico (sentadilla, prensa, press, remo, jalón…): solo con aislamiento no se pasa de Plata.'
  if (n.direct) return to + `haz algún ejercicio directo de ${g.group.toLowerCase()} (ahora solo trabaja de rebote).`
  const name = EX_BY_ID[n.id]?.name || n.id
  if (n.e1rm) return to + `p. ej., ${name} a 1RM est. ${fmtKg(n.e1rm)} kg.`
  return to + `p. ej., ${name} a ${n.reps} reps.`
}

function Detail({ data, onClose }) {
  const { groups, overall, bw } = muscleRanks(data)
  const sym = symmetry(data)
  return (
    <Modal title="Tu personaje" onClose={onClose}>
      <div className="char-wrap big">
        <Mannequin groups={groups} />
      </div>
      <div className="char-overall">
        Rango general <RankBadge rank={overall} />
      </div>
      <p className="muted small char-note">El general cuenta los 7 músculos: el que no entrenas cuenta como cero.</p>
      <h4>Músculos</h4>
      {Object.values(groups).map((g) => (
        <div className="rk-row" key={g.group}>
          <div className="rk-top">
            <b>{g.group}</b>
            <RankBadge rank={g.rank} sm />
          </div>
          {g.rank ? (
            <>
              <div className="rk-bar">
                <span style={{ width: Math.round(g.progress * 100) + '%', background: g.rank.color }} />
              </div>
              <div className="muted small rk-used">
                Cuentan:{' '}
                {g.used
                  .map((u) => `${EX_BY_ID[u.id]?.name || u.id}${u.main ? '' : ' (de rebote)'} ${u.e ? `${fmtKg(Math.round(u.e * 2) / 2)}\u00a0kg` : `${u.reps}\u00a0reps`}`)
                  .join(' · ')}
              </div>
              <div className="small rk-need">{needTxt(g)}</div>
            </>
          ) : (
            <div className="muted small">Entrena algún ejercicio de {g.group.toLowerCase()} para desbloquear su rango.</div>
          )}
        </div>
      ))}
      <h4>Simetría izquierda / derecha</h4>
      {sym.length ? (
        sym.map((s) => (
          <div className={'advice ' + (s.level === 'ok' ? 'green' : 'yellow')} key={s.group}>
            <b>{s.group}:</b> {s.level === 'ok' ? `equilibrado (diferencia del ${s.pct} %).` : `el lado ${s.weak} rinde un ${s.pct} % menos. Empieza las series por ese lado y no hagas más reps con el otro.`}
          </div>
        ))
      ) : (
        <p className="muted small">Activa "Unilateral" en ejercicios de un brazo o una pierna y apunta las reps de cada lado para medir la simetría.</p>
      )}
      <p className="muted small">
        Fuerza real de los últimos 90 días frente a tu peso corporal{bw.real ? '' : ' (sin pesajes aún: 80 kg)'} y referencias de fuerza{data.prefs?.sex === 'f' ? ' de mujeres' : ''}: Oro ≈ intermedio, Diamante ≈ avanzado. Cada músculo se mide con tus 3 mejores ejercicios a la vez. El aislamiento (abductores, extensiones, elevaciones…) cuenta la mitad donde hay básicos y solo con él no se pasa de Plata; con 1 ejercicio, como mucho Oro, y con 2, Platino. Lo que trabaja de rebote (el press banca al tríceps) suma menos.
      </p>
    </Modal>
  )
}

export default function RankCard({ data }) {
  const [open, setOpen] = useState(false)
  const { groups, overall } = muscleRanks(data)
  const n = Object.values(groups).filter((g) => g.rank).length
  if (!data.sessions?.length) return null
  return (
    <>
    <button className="card rank-card" onClick={() => setOpen(true)} aria-label="Tu personaje: ver rangos por músculo">
      <div className="char-wrap">
        <Mannequin groups={groups} />
      </div>
      <div className="rank-side">
        <span className="muted small">Tu personaje</span>
        <RankBadge rank={overall} />
        <div className="rank-mini">
          {Object.values(groups)
            .filter((g) => g.rank)
            .slice(0, 8)
            .map((g) => (
              <span key={g.group} className="small">
                <i style={{ background: g.rank.color }} /> {g.group}
              </span>
            ))}
        </div>
        <span className="muted small">
          {n}/{Object.keys(groups).length} desbloqueados ›
        </span>
      </div>
    </button>
    {open && <Detail data={data} onClose={() => setOpen(false)} />}
    </>
  )
}
