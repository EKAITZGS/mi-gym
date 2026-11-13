import { useState, useRef, useEffect } from 'react'
import { Modal } from './ui'
import { EX_BY_ID } from './data/exercises'
import { Thumb } from './ui'
import Icon from './icons'
import { weeklyReview, applyProposal, aiWeeklyReview, restDayTips, askCoach } from './coach'
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

const IDEAS = ['¿Qué ceno hoy para llegar a la proteína?', 'Me duele un poco el hombro, ¿qué cambio en mi plan?', '¿Cómo salgo de un estancamiento en press banca?']

// Chat con el entrenador (IA). La conversación no se guarda: al cerrar se borra.
export function CoachChat({ data, onClose }) {
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs, busy])
  const send = async (text) => {
    const t = (text || q).trim().slice(0, 500)
    if (!t || busy) return
    setQ('')
    const hist = [...msgs, { role: 'user', text: t }]
    setMsgs(hist)
    setBusy(true)
    try {
      const a = await askCoach(data, msgs, t)
      setMsgs([...hist, { role: 'coach', text: a }])
    } catch (e) {
      setMsgs([...hist, { role: 'coach', err: true, text: e.message === 'NO_KEY' ? 'La IA no está disponible ahora. Puedes poner tu clave gratis de Groq en Ajustes.' : e.message }])
    }
    setBusy(false)
  }
  return (
    <Modal title="Pregunta al entrenador" onClose={onClose}>
      <div className="chat">
        {msgs.length === 0 && (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Conoce tu plan, tus últimos entrenos, molestias y sueño. Es orientativo: no sustituye a un médico ni a un fisio.
            </p>
            {IDEAS.map((i) => (
              <button key={i} className="chip sm chat-idea" onClick={() => send(i)}>
                {i}
              </button>
            ))}
          </>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={'bubble ' + (m.role === 'user' ? 'me' : 'coach') + (m.err ? ' err' : '')}>
            {m.text}
          </div>
        ))}
        {busy && <div className="bubble coach muted">Pensando…</div>}
        <div ref={end} />
      </div>
      <form
        className="chat-in"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input className="inp" placeholder="Escribe tu pregunta…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" disabled={busy || !q.trim()} aria-label="Enviar">
          <Icon name="right" size={18} />
        </button>
      </form>
    </Modal>
  )
}

function AskButton({ data }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn full" onClick={() => setOpen(true)}>
        <Icon name="sparkle" size={16} /> Pregunta al entrenador
      </button>
      {open && <CoachChat data={data} onClose={() => setOpen(false)} />}
    </>
  )
}

// rest: hoy no toca pesas (Inicio) -> solo recomendaciones de andar o correr
export default function WeeklyReview({ data, setData, focusId, rest }) {
  if (rest) {
    const tips = restDayTips(data)
    return (
      <div className="card review">
        <div className="sec-head nm">
          <b>
            <Icon name="trend" size={16} className="inl" /> Recomendaciones para hoy
          </b>
        </div>
        <ul className="tips-list">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <AskButton data={data} />
      </div>
    )
  }
  return <TrainingReview data={data} setData={setData} focusId={focusId} />
}

function TrainingReview({ data, setData, focusId }) {
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
          <Icon name="trend" size={16} className="inl" /> Recomendaciones de entrenamiento
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
      <AskButton data={data} />
    </div>
  )
}
