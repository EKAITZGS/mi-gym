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
              <div className="muted small">
                {EX_BY_ID[g.top.id]?.name}
                {g.top.main ? '' : ' (secundario)'}
                {g.top.e ? ` · 1RM est. ${fmtKg(Math.round(g.top.e * 2) / 2)} kg` : ` · ${g.top.reps} reps`}
                {g.need ? (g.need.e1rm ? ` · ${g.need.rank.name} con 1RM est. ${fmtKg(g.need.e1rm)} kg` : ` · ${g.need.rank.name} con ${g.need.reps} reps`) : ' · rango máximo'}
              </div>
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
        Los rangos salen de tu fuerza real en los últimos 90 días comparada con tu peso corporal{bw.real ? '' : ' (aún sin pesajes: se calcula con 80 kg)'}, usando referencias de fuerza para hombres entrenados. Oro es un nivel intermedio sólido; Diamante, avanzado. Los ejercicios también suman, con menos peso, a los músculos que trabajan como secundarios: el press banca al tríceps y al hombro, los remos al bíceps y al antebrazo…
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
    <button className="card rank-card" onClick={() => setOpen(true)}>
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
