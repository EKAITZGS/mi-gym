import { useState } from 'react'
import { EX_BY_ID } from './data/exercises'
import { Thumb } from './ui'
import Icon from './icons'
import { weeklyReview, applyProposal, aiWeeklyReview } from './coach'
import { hasAi } from './ai'

function Proposal({ p, data, onDecide }) {
  const it = data.plan.find((d) => d.id === p.dayId)?.items.find((i) => i.id === p.itemId)
  return (
    <div className="prop">
      <div className="prop-head">
        <span className="daypill">{p.dayName}</span>
        {p.ai && <span className="tag tag-main">IA</span>}
      </div>
      {p.type === 'swap' ? (
        <div className="swap-row">
          <div className="swap-ex">
            <Thumb ex={EX_BY_ID[p.from]} size={40} />
            <span>{EX_BY_ID[p.from]?.name}</span>
          </div>
          <Icon name="right" size={18} />
          <div className="swap-ex">
            <Thumb ex={EX_BY_ID[p.to]} size={40} />
            <span>{EX_BY_ID[p.to]?.name}</span>
          </div>
        </div>
      ) : (
        <div className="swap-row">
          <div className="swap-ex">
            <Thumb ex={EX_BY_ID[p.from]} size={40} />
            <span>
              {EX_BY_ID[p.from]?.name}: {it?.sets} → {Math.max(1, (it?.sets || 3) + p.delta)} series
            </span>
          </div>
        </div>
      )}
      {p.motivo && <p className="muted small">{p.motivo}</p>}
      <div className="btns">
        <button className="btn" onClick={() => onDecide(p, false)}>
          <Icon name="x" size={16} /> Rechazar
        </button>
        <button className="btn primary" onClick={() => onDecide(p, true)}>
          <Icon name="check" size={16} /> Aceptar
        </button>
      </div>
    </div>
  )
}

export default function WeeklyReview({ data, setData, focusId }) {
  const rv = weeklyReview(data, focusId)
  const [ai, setAi] = useState({ loading: false, err: '', res: null })
  const [msg, setMsg] = useState('')
  if (!rv) return null
  const aiProps = (ai.res?.props || []).filter((p) => !(data.reviews || {})[p.key])
  const pending = [...rv.pending, ...aiProps.filter((p) => !rv.pending.some((x) => x.key === p.key))]
  const hasKey = hasAi()
  if (!pending.length && !rv.findings.length && !ai.res && !msg) return null

  const decide = (p, ok) => {
    setData((d) => ({
      ...d,
      plan: ok ? applyProposal(d.plan, p) : d.plan,
      reviews: { ...(d.reviews || {}), [p.key]: ok ? 'accepted' : 'rejected' },
    }))
    setMsg(ok ? 'Cambio aplicado a tu plan.' : 'Rechazado: tu plan se queda como estaba.')
  }
  const askAi = async () => {
    setAi({ loading: true, err: '', res: null })
    try {
      setAi({ loading: false, err: '', res: await aiWeeklyReview(data) })
    } catch (e) {
      setAi({ loading: false, err: e.message, res: null })
    }
  }

  return (
    <div className="card review">
      <div className="sec-head nm">
        <b>
          <Icon name="trend" size={16} className="inl" /> Revisión de la semana
        </b>
        <span className="muted small">{rv.count} entrenos</span>
      </div>
      {rv.summary && <p className="small">{rv.summary}</p>}
      {rv.findings.length > 0 && (
        <ul className="tips-list">
          {rv.findings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
      {ai.res?.valoracion && <div className="advice green sm">{ai.res.valoracion}</div>}
      {pending.length > 0 && (
        <p className="muted small">Te propongo estos cambios. No toco nada si no aceptas.</p>
      )}
      {pending.map((p) => (
        <Proposal key={p.key} p={p} data={data} onDecide={decide} />
      ))}
      {msg && <p className="toast">{msg}</p>}
      {hasKey && !ai.res && (
        <button className="btn full" disabled={ai.loading} onClick={askAi}>
          <Icon name="sparkle" size={16} /> {ai.loading ? 'La IA está revisando tu semana…' : 'Pedir valoración a la IA'}
        </button>
      )}
      {ai.err && <p className="toast warn small">{ai.err}</p>}
    </div>
  )
}
