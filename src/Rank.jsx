import { useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { RANKS, muscleRanks, symmetry } from './ranks'
import { EX_BY_ID } from './data/exercises'
import { fmtKg } from './store'
import Mannequin from './Mannequin'

function Defs({ gid }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {RANKS.map((r) => (
          <linearGradient key={r.id} id={`${gid}-${r.id}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.18" stopColor={r.color} />
            <stop offset="1" stopColor={r.color} stopOpacity="0.62" />
          </linearGradient>
        ))}
        <linearGradient id={`${gid}-none`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#4a5160" />
          <stop offset="1" stopColor="#262a33" />
        </linearGradient>
        <filter id={`${gid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

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
      <Defs gid="rkd" />
      <div className="char-wrap big">
        <Mannequin view="front" groups={groups} gid="rkd" />
        <Mannequin view="back" groups={groups} gid="rkd" />
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
        Los rangos salen de tu fuerza real en los últimos 90 días comparada con tu peso corporal{bw.real ? '' : ' (aún sin pesajes: se calcula con 80 kg)'}, usando referencias de fuerza para hombres entrenados. Oro es un nivel intermedio sólido; Diamante, avanzado.
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
      <Defs gid="rkc" />
      <div className="char-wrap">
        <Mannequin view="front" groups={groups} gid="rkc" />
        <Mannequin view="back" groups={groups} gid="rkc" />
      </div>
      <div className="rank-side">
        <span className="muted small">Tu personaje</span>
        <RankBadge rank={overall} />
        <div className="rank-mini">
          {Object.values(groups)
            .filter((g) => g.rank)
            .slice(0, 7)
            .map((g) => (
              <span key={g.group} className="small">
                <i style={{ background: g.rank.color }} /> {g.group}
              </span>
            ))}
        </div>
        <span className="muted small">
          {n}/7 desbloqueados ›
        </span>
      </div>
    </button>
    {open && <Detail data={data} onClose={() => setOpen(false)} />}
    </>
  )
}
