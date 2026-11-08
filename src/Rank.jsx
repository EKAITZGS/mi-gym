import { useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { RANKS, muscleRanks, symmetry } from './ranks'
import { EX_BY_ID } from './data/exercises'
import { fmtKg } from './store'

// Maniquí estilo videojuego: cada músculo se pinta con el color de su rango
const M = (pts) => pts.map(([x, y]) => [120 - x, y])
const poly = (pts) => pts.map((p) => p.join(',')).join(' ')
const SIDE = {
  front: [
    ['Hombro', [[33, 50], [46, 44], [48, 57], [36, 67]]],
    ['Pecho', [[48, 46], [59, 48], [59, 70], [47, 72], [45, 59]]],
    ['Bíceps', [[31, 68], [39, 65], [40, 88], [31, 90]]],
    ['Core', [[48, 75], [59, 75], [59, 113], [50, 113]]],
    ['Core', [[44, 75], [47, 75], [49, 112], [45, 106]]],
    ['Pierna', [[45, 118], [59, 120], [58, 170], [48, 172], [44, 150]]],
    ['Pierna', [[47, 179], [57, 179], [56, 222], [49, 224]]],
  ],
  back: [
    ['Espalda', [[50, 38], [59, 36], [59, 52], [45, 48]]],
    ['Hombro', [[33, 50], [45, 46], [46, 58], [36, 67]]],
    ['Espalda', [[46, 52], [59, 54], [59, 96], [50, 98], [44, 74]]],
    ['Tríceps', [[31, 68], [39, 65], [41, 88], [32, 90]]],
    ['Espalda', [[50, 99], [59, 99], [59, 113], [50, 113]]],
    ['Pierna', [[45, 116], [59, 118], [59, 138], [46, 136]]],
    ['Pierna', [[46, 141], [58, 141], [57, 172], [48, 172]]],
    ['Pierna', [[47, 179], [57, 179], [56, 222], [49, 224]]],
  ],
}
const NEUTRAL = [
  [[30, 92], [39, 90], [37, 116], [30, 118]], // antebrazo
  [[30, 119], [37, 117], [36, 128], [31, 129]], // mano
  [[48, 225], [56, 224], [57, 234], [46, 234]], // pie
  [[56, 30], [60, 30], [60, 38], [54, 38]], // cuello
]

function Figure({ view, groups, gid }) {
  const fill = (g) => {
    const r = groups[g]?.rank
    return r ? `url(#${gid}-${r.id})` : 'rgba(255,255,255,0.05)'
  }
  const stroke = (g) => (groups[g]?.rank ? groups[g].rank.color : 'rgba(255,255,255,0.18)')
  return (
    <svg viewBox="0 0 120 240" className="mannequin" role="img" aria-label={view === 'front' ? 'Vista de frente' : 'Vista de espalda'}>
      <circle cx="60" cy="18" r="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
      {NEUTRAL.flatMap((p, i) => [
        <polygon key={'n' + i} points={poly(p)} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />,
        <polygon key={'m' + i} points={poly(M(p))} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />,
      ])}
      {SIDE[view].flatMap(([g, p], i) => [
        <polygon key={'a' + i} points={poly(p)} fill={fill(g)} stroke={stroke(g)} strokeWidth="0.9" strokeLinejoin="round" filter={groups[g]?.rank ? `url(#${gid}-glow)` : undefined} />,
        <polygon key={'b' + i} points={poly(M(p))} fill={fill(g)} stroke={stroke(g)} strokeWidth="0.9" strokeLinejoin="round" filter={groups[g]?.rank ? `url(#${gid}-glow)` : undefined} />,
      ])}
    </svg>
  )
}

function Defs({ gid }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {RANKS.map((r) => (
          <linearGradient key={r.id} id={`${gid}-${r.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor={r.color} stopOpacity="0.95" />
            <stop offset="1" stopColor={r.color} stopOpacity="0.55" />
          </linearGradient>
        ))}
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
        <Figure view="front" groups={groups} gid="rkd" />
        <Figure view="back" groups={groups} gid="rkd" />
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
        <Figure view="front" groups={groups} gid="rkc" />
        <Figure view="back" groups={groups} gid="rkc" />
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
