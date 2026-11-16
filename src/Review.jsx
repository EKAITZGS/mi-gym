import { useState, useRef, useEffect } from 'react'
import { todayStr } from './store'
import { Modal } from './ui'
import { EX_BY_ID } from './data/exercises'
import { Thumb } from './ui'
import Icon from './icons'
import { weeklyReview, applyProposal, aiWeeklyReview, restDayTips, askCoach } from './coach'
import { hasAi } from './ai'
import { WEEKDAYS } from './store'
import { DiffLines } from './CoachTools'
import { applyChanges } from './dayDiff'
import { applyAiProposal, proposalTxt, exNameOf, levelOf, LEVEL_TXT } from './aiPlan'

// Propuesta del entrenador IA en el chat: se enseña qué cambia y el usuario la aplica o no (nunca se aplica sola)
function AiProposal({ p, data, setData, status, onDecide }) {
  const nameOf = exNameOf(data)
  const [pick, setPick] = useState({})
  const wdOf = (d, i) => (pick[i] !== undefined ? pick[i] : d.weekday)
  const apply = () => {
    setData((dd) => ({ ...dd, plan: applyAiProposal(dd.plan, p, pick) }))
    onDecide('ok')
  }
  return (
    <div className="tw-card ai-prop">
      <div className="tw-h">
        <Icon name="sparkle" size={16} /> Propuesta para tu rutina
        {p.level && <span className="badge ai-lv">nivel {LEVEL_TXT[p.level]}</span>}
      </div>
      {p.summary && <p className="small m-0 ai-prop-sum">{p.summary}</p>}
      {p.days.map((d, i) => {
        if (d.kind === 'edit') {
          const cur = data.plan.find((x) => x.id === d.day.baseId)
          if (!cur) return <p className="small muted" key={i}>El día "{d.day.baseName}" ya no está en tu rutina.</p>
          const after = applyChanges([cur], d.day)[0]
          return (
            <div className="ai-day" key={i}>
              <b>
                En tu día {cur.name.trim()}
                {cur.weekday != null ? ` (${WEEKDAYS[cur.weekday]})` : ''}
              </b>
              {d.changes.length > 0 && <DiffLines changes={d.changes} nameOf={nameOf} />}
              {d.weekday !== undefined && (
                <div className="dl">
                  <div className="dl-row sets">
                    <span className="dl-tag">Día</span>
                    <span className="grow">
                      {cur.weekday != null ? WEEKDAYS[cur.weekday] : 'Sin día'} → <b>{d.weekday != null ? WEEKDAYS[d.weekday] : 'Sin día'}</b>
                      {d.weekday != null && data.plan.some((x) => x.weekday === d.weekday && x.id !== cur.id) ? <span className="muted"> · {data.plan.find((x) => x.weekday === d.weekday).name.trim()} se queda sin día</span> : null}
                    </span>
                  </div>
                </div>
              )}
              <details className="tw-after">
                <summary>Ver cómo queda el día</summary>
                {after.items.map((it) => (
                  <div className="small dp-item" key={it.id}>
                    {nameOf(it.ex)} <span className="muted">· {it.sets}×{it.reps}{it.rir != null ? ` · RIR ${it.rir}` : ''}</span>
                  </div>
                ))}
              </details>
            </div>
          )
        }
        const wd = wdOf(d, i)
        const taken = wd != null ? data.plan.find((x) => x.weekday === wd) : null
        return (
          <div className="ai-day" key={i}>
            <b>Día nuevo: {d.name}</b>
            {d.items.map((it, k) => (
              <div className="small dp-item" key={k}>
                {nameOf(it.ex)} <span className="muted">· {it.sets}×{it.reps}{it.rir != null ? ` · RIR ${it.rir}` : ''}</span>
              </div>
            ))}
            {status == null && (
              <>
                <label className="lbl">¿Qué día?</label>
                <select className="inp" aria-label="Día de la semana del día nuevo" value={wd ?? ''} onChange={(e) => setPick((s) => ({ ...s, [i]: e.target.value === '' ? null : +e.target.value }))}>
                  <option value="">Sin día fijo</option>
                  {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                    <option key={n} value={n}>
                      {WEEKDAYS[n]}
                      {data.plan.some((x) => x.weekday === n) ? ` (sustituye a ${data.plan.find((x) => x.weekday === n).name.trim()})` : ''}
                    </option>
                  ))}
                </select>
                {taken && <p className="small hint-warn m-0">{taken.name.trim()} se quedará sin día fijo (no se borra).</p>}
              </>
            )}
          </div>
        )
      })}
      {status == null ? (
        setData ? (
          <div className="btns">
            <button className="btn" onClick={() => onDecide('no')}>
              No, gracias
            </button>
            <button className="btn primary" onClick={apply}>
              <Icon name="check" size={16} /> Aplicar
            </button>
          </div>
        ) : (
          <p className="small muted">Para aplicarla, pregúntalo desde Entrenamiento.</p>
        )
      ) : (
        <p className={'small ai-prop-st ' + status}>{status === 'ok' ? '✓ Aplicado: ya lo tienes en Rutinas.' : 'Descartada: tu rutina sigue igual.'}</p>
      )}
    </div>
  )
}

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

const IDEAS = ['Me duele un poco el hombro, ¿qué cambio en mi plan?', 'Quiero entrenar también el miércoles: hazme un día de espalda', '¿Qué ceno hoy para llegar a la proteína?', '¿Cómo salgo de un estancamiento en press banca?']

// Chat con el entrenador (IA). La conversación no se guarda: al cerrar se borra.
export function CoachChat({ data, setData, onClose, initial }) {
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs, busy])
  // pregunta que se manda sola al abrir (p. ej. el análisis del objetivo en Progreso)
  useEffect(() => {
    if (initial) send(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const send = async (text) => {
    const t = (text || q).trim().slice(0, 500)
    if (!t || busy) return
    setQ('')
    const hist = [...msgs, { role: 'user', text: t }]
    setMsgs(hist)
    setBusy(true)
    try {
      const a = await askCoach(data, msgs, t)
      setMsgs([...hist, { role: 'coach', text: a.text, proposal: a.proposal, ptxt: a.proposal ? proposalTxt(a.proposal, data) : '' }])
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
            <p className="muted small mt-0">
              Conoce tu plan, tu nivel ({levelOf(data).label}), tus últimos entrenos, molestias y sueño, y puede proponerte cambios en tu rutina. Es orientativo: no sustituye a un médico ni a un fisio.
            </p>
            {IDEAS.map((i) => (
              <button key={i} className="chip sm chat-idea" onClick={() => send(i)}>
                {i}
              </button>
            ))}
          </>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="chat-turn">
            {m.text && <div className={'bubble ' + (m.role === 'user' ? 'me' : 'coach') + (m.err ? ' err' : '')}>{m.text}</div>}
            {m.proposal && (
              <AiProposal
                p={m.proposal}
                data={data}
                setData={setData}
                status={m.status}
                onDecide={(st) => setMsgs((l) => l.map((x, k) => (k === i ? { ...x, status: st } : x)))}
              />
            )}
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

function AskButton({ data, setData }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="link small rv-ask" onClick={() => setOpen(true)}>
        <Icon name="sparkle" size={15} /> Pregunta al entrenador
      </button>
      {open && <CoachChat data={data} setData={setData} onClose={() => setOpen(false)} />}
    </>
  )
}

// rest: hoy no toca pesas (Inicio) -> solo recomendaciones de andar o correr
export default function WeeklyReview({ data, setData, focusId, rest }) {
  if (rest) {
    // sin ningún dato (cuenta nueva: ni entrenos ni reloj de hoy) no hay nada en qué basarse
    if (!data.sessions.length && !data.polar?.days?.[todayStr()]) return null
    const tips = restDayTips(data)
    return (
      <div className="card review">
        <div className="card-h">
          <Icon name="trend" size={16} />
          <h3>Para hoy</h3>
          <span className="card-aside">día de descanso</span>
        </div>
        <ul className="tips-list">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <AskButton data={data} setData={setData} />
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
      <div className="card-h">
        <Icon name="trend" size={16} />
        <h3>Recomendaciones</h3>
        <span className="card-aside">{rv.count} {rv.count === 1 ? 'entreno' : 'entrenos'}</span>
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
      <AskButton data={data} setData={setData} />
    </div>
  )
}
