// Mensajes entre entrenador y alumno, y entrenos que manda el entrenador
import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { listMessages, sendMessage, markRead, listWorkouts, sendWorkout, answerWorkout, deleteWorkout } from './cloud'
import { EX_BY_ID } from './data/exercises'
import { Library } from './Workout'
import { uid as newId, WEEKDAYS } from './store'

const exName = (id) => (EX_BY_ID[id]?.name || id).replace(/ \(.*\)/, '')
const when = (iso) => {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

// ---- Chat ----
export function Chat({ linkId, me, title, onClose }) {
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  const load = () =>
    listMessages(linkId)
      .then((m) => {
        setMsgs(m)
        setErr('')
        if (m.some((x) => x.sender_id !== me && !x.read_at)) markRead(linkId).catch(() => {})
      })
      .catch((e) => setErr(e.message))
  useEffect(() => {
    load()
    // con el chat abierto, mira si hay mensajes nuevos cada 8 s
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 8000)
    return () => clearInterval(t)
  }, [linkId])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs?.length])
  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await sendMessage(linkId, text)
      setText('')
      await load()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }
  return (
    <Modal title={title} onClose={onClose}>
      <div className="chat">
        {!msgs && !err && <p className="muted small">Cargando…</p>}
        {msgs && !msgs.length && <p className="muted small">Todavía no hay mensajes. Escribe el primero.</p>}
        {(msgs || []).map((m) => (
          <div key={m.id} className={'bubble ' + (m.sender_id === me ? 'me' : 'them')}>
            <div>{m.body}</div>
            <span>
              {when(m.created_at)}
              {m.sender_id === me && m.read_at ? ' · leído' : ''}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>
      {err && <div className="advice sm yellow">{err}</div>}
      <div className="chat-in">
        <textarea className="inp" rows={2} placeholder="Escribe un mensaje…" value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} />
        <button className="btn primary" disabled={busy || !text.trim()} onClick={send}>
          Enviar
        </button>
      </div>
    </Modal>
  )
}

// ---- Entrenador: preparar y mandar un entreno ----
export function WorkoutBuilder({ data, setData, linkId, studentName, studentPlan = [], onClose, onSent }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState([])
  const [note, setNote] = useState('')
  const [pick, setPick] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fromDay = (id) => {
    const d = studentPlan.find((x) => x.id === id)
    if (!d) return
    setName(d.name)
    setItems(d.items.map((it) => ({ ex: it.ex, sets: it.sets, reps: it.reps, ...(it.drop ? { drop: true } : {}), ...(it.uni ? { uni: true } : {}) })))
  }
  const upd = (i, p) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const send = async () => {
    setBusy(true)
    setErr('')
    try {
      await sendWorkout(linkId, { name: name.trim() || 'Entreno', items: items.map((it) => ({ ...it, sets: Math.max(1, Math.min(50, +it.sets || 3)), reps: String(it.reps || '10').slice(0, 20) })) }, note)
      onSent?.()
      onClose()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }
  if (pick)
    return (
      <Library
        data={data}
        setData={setData}
        noCreate
        title="Añadir ejercicio"
        onClose={() => setPick(false)}
        onPick={(e) => {
          setItems((l) => [...l, { ex: e.id, sets: 3, reps: '10' }])
          setPick(false)
        }}
      />
    )
  return (
    <Modal title={`Entreno para ${studentName}`} onClose={onClose}>
      {studentPlan.length > 0 && (
        <>
          <label className="lbl" style={{ marginTop: 0 }}>
            Partir de un día suyo (opcional)
          </label>
          <select className="inp" defaultValue="" onChange={(e) => fromDay(e.target.value)}>
            <option value="">Empezar de cero</option>
            {studentPlan.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </>
      )}
      <label className="lbl">Nombre del día</label>
      <input className="inp" placeholder="Ej.: Pierna (glúteo)" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} />
      <label className="lbl">Ejercicios</label>
      {!items.length && <p className="muted small">Añade los ejercicios que quieres que haga.</p>}
      {items.map((it, i) => (
        <div className="wb-row" key={i}>
          <div className="grow">
            <div className="li-t">{exName(it.ex)}</div>
            <div className="wb-in">
              <input className="inp" inputMode="numeric" value={it.sets} onChange={(e) => upd(i, { sets: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
              <span className="muted small">series ×</span>
              <input className="inp" value={it.reps} onChange={(e) => upd(i, { reps: e.target.value.slice(0, 20) })} />
              <span className="muted small">reps</span>
            </div>
          </div>
          <button className="icon-btn ghost" aria-label="Quitar" onClick={() => setItems((l) => l.filter((_, k) => k !== i))}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
      <button className="btn full" onClick={() => setPick(true)}>
        <Icon name="plus" size={15} /> Añadir ejercicio
      </button>
      <label className="lbl">Nota para {studentName} (opcional)</label>
      <textarea className="inp" rows={2} placeholder="Ej.: descansa 2 min en las sentadillas y sube 2,5 kg si llegas a 10." value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} />
      {err && <div className="advice sm yellow">{err}</div>}
      <button className="btn primary full" style={{ marginTop: 12 }} disabled={busy || !items.length} onClick={send}>
        {busy ? 'Enviando…' : 'Mandar entreno'}
      </button>
      <p className="muted small">Le llegará como propuesta: {studentName} decide si lo añade a su plan.</p>
    </Modal>
  )
}

// Lista de entrenos mandados (vista del entrenador)
export function SentWorkouts({ linkId, refresh }) {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const load = () => listWorkouts(linkId).then(setList).catch((e) => setErr(e.message))
  useEffect(() => {
    load()
  }, [linkId, refresh])
  if (err) return <div className="advice sm yellow">{err}</div>
  if (!list || !list.length) return null
  const st = { pending: 'Esperando respuesta', accepted: 'Lo ha añadido a su plan', rejected: 'No lo ha añadido' }
  return (
    <>
      <h4>Entrenos que le has mandado</h4>
      {list.map((w) => (
        <div className="dp-meal" key={w.id}>
          <div className="dp-head">
            <b>{w.day?.name || 'Entreno'}</b>
            <span className={'small ' + (w.status === 'accepted' ? 'up' : 'muted')}>{st[w.status]}</span>
          </div>
          <div className="small muted">
            {(w.day?.items || []).map((it) => exName(it.ex)).join(' · ')} · {when(w.created_at)}
          </div>
          {w.status === 'pending' && (
            <button className="link" style={{ fontSize: 13 }} onClick={() => confirm('¿Retirar este entreno?') && deleteWorkout(w.id).then(load)}>
              Retirar
            </button>
          )}
        </div>
      ))}
    </>
  )
}

// ---- Alumno: entrenos que le manda su entrenador ----
export function TrainerWorkouts({ linkId, trainerName, data, setData, onChange }) {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [day, setDay] = useState({})
  const load = () => listWorkouts(linkId).then(setList).catch((e) => setErr(e.message))
  useEffect(() => {
    load()
  }, [linkId])
  if (err) return <div className="advice sm yellow">{err}</div>
  if (!list || !list.length) return null
  const answer = async (w, ok) => {
    try {
      if (ok) {
        const wd = day[w.id] === '' || day[w.id] == null ? null : +day[w.id]
        const newDay = {
          id: newId(),
          name: w.day?.name || 'Entreno del entrenador',
          weekday: wd,
          fromTrainer: true,
          items: (w.day?.items || []).map((it) => ({ id: newId(), ex: it.ex, sets: +it.sets || 3, reps: String(it.reps || '10'), drop: !!it.drop, ...(it.uni ? { uni: true } : {}) })),
        }
        // si ese día de la semana ya tenía otro entreno, ese se queda "sin día"
        setData((d) => ({ ...d, plan: [...d.plan.map((p) => (wd != null && p.weekday === wd ? { ...p, weekday: null } : p)), newDay] }))
      }
      await answerWorkout(w.id, ok)
      load()
      onChange?.()
    } catch (e) {
      setErr(e.message)
    }
  }
  const pending = list.filter((w) => w.status === 'pending')
  const done = list.filter((w) => w.status !== 'pending').slice(0, 5)
  return (
    <div className="tw">
      {pending.map((w) => (
        <div className="tw-card" key={w.id}>
          <div className="tw-h">
            <Icon name="dumbbell" size={16} /> {trainerName} te ha mandado un entreno
          </div>
          <b>{w.day?.name}</b>
          {(w.day?.items || []).map((it, i) => (
            <div className="small dp-item" key={i}>
              {exName(it.ex)} <span className="muted">· {it.sets}×{it.reps}</span>
            </div>
          ))}
          {w.note && <div className="small tw-note">“{w.note}”</div>}
          <label className="lbl">¿Qué día lo quieres hacer?</label>
          <select className="inp" value={day[w.id] ?? ''} onChange={(e) => setDay((s) => ({ ...s, [w.id]: e.target.value }))}>
            <option value="">Sin día fijo</option>
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <option key={n} value={n}>
                {WEEKDAYS[n]}
                {data.plan.some((p) => p.weekday === n) ? ` (sustituye a ${data.plan.find((p) => p.weekday === n).name})` : ''}
              </option>
            ))}
          </select>
          <div className="btns">
            <button className="btn" onClick={() => answer(w, false)}>
              No, gracias
            </button>
            <button className="btn primary" onClick={() => answer(w, true)}>
              Añadir a mi plan
            </button>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          Anteriores: {done.map((w) => `${w.day?.name} (${w.status === 'accepted' ? 'añadido' : 'no añadido'})`).join(', ')}
        </p>
      )}
    </div>
  )
}
