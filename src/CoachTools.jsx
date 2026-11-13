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

// ---- Propuestas de cambios sobre un día del alumno ----
// Ejercicio del plan sin su id (lo que viaja en la propuesta)
const clean = (it) => ({
  ex: it.ex,
  sets: it.sets,
  reps: it.reps,
  ...(it.drop ? { drop: true } : {}),
  ...(it.uni ? { uni: true } : {}),
  ...(it.track ? { track: it.track } : {}),
  ...(it.rir != null ? { rir: it.rir } : {}),
  ...(it.rest ? { rest: it.rest } : {}),
})
const sr = (it) => `${it.sets}×${String(it.reps).trim()}`
const norm = (it) => ({ ...it, sets: Math.max(1, Math.min(50, +it.sets || 3)), reps: String(it.reps || '').trim().slice(0, 20) || '10' })

// Qué cambia: day = { name, items[{fromId?}], baseId, baseName, base[{id, ex, sets, reps}] }
export function diffDay(day) {
  const base = day?.base || []
  const items = day?.items || []
  const out = []
  if (day?.baseName && day.name && day.name !== day.baseName) out.push({ t: 'name', from: day.baseName, to: day.name })
  for (const it of items) {
    const b = it.fromId && base.find((x) => x.id === it.fromId)
    if (!b) out.push({ t: 'add', ex: it.ex, sr: sr(it) })
    else if (b.ex !== it.ex) out.push({ t: 'swap', from: b.ex, ex: it.ex, sr: sr(it) })
    else if (sr(b) !== sr(it)) out.push({ t: 'sets', ex: it.ex, from: sr(b), sr: sr(it) })
  }
  for (const b of base) if (!items.some((it) => it.fromId === b.id)) out.push({ t: 'del', ex: b.ex })
  return out
}
const TAG = { swap: 'Cambiar', add: 'Añadir', del: 'Quitar', sets: 'Series', name: 'Nombre' }
export function DiffLines({ changes, nameOf = exName }) {
  return (
    <div className="dl">
      {changes.map((c, i) => (
        <div className={'dl-row ' + c.t} key={i}>
          <span className="dl-tag">{TAG[c.t]}</span>
          <span className="grow">
            {c.t === 'swap' && (
              <>
                <b>{nameOf(c.from)}</b> por <b>{nameOf(c.ex)}</b> <span className="muted nw">· {c.sr}</span>
              </>
            )}
            {c.t === 'add' && (
              <>
                <b>{nameOf(c.ex)}</b> <span className="muted nw">· {c.sr}</span>
              </>
            )}
            {c.t === 'del' && <b>{nameOf(c.ex)}</b>}
            {c.t === 'sets' && (
              <>
                <b>{nameOf(c.ex)}</b>: <span className="nw">{c.from} →</span> <b className="nw">{c.sr}</b>
              </>
            )}
            {c.t === 'name' && (
              <>
                {c.from} → <b>{c.to}</b>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
const shortTxt = (c, nameOf) =>
  c.t === 'swap' ? `${nameOf(c.from)} → ${nameOf(c.ex)}` : c.t === 'add' ? `+ ${nameOf(c.ex)}` : c.t === 'del' ? `− ${nameOf(c.ex)}` : c.t === 'sets' ? `${nameOf(c.ex)} ${c.from} → ${c.sr}` : 'nombre'

// Aplica los cambios aceptados al día del plan. Respeta lo que el alumno haya tocado después de la propuesta.
export function applyChanges(plan, day) {
  const p = plan.find((x) => x.id === day.baseId)
  if (!p) return null
  const base = day.base || []
  const baseIds = new Set(base.map((b) => b.id))
  const items = []
  for (const raw of day.items || []) {
    const it = norm(raw)
    const cur = it.fromId && p.items.find((x) => x.id === it.fromId)
    const b = it.fromId && base.find((x) => x.id === it.fromId)
    const changed = !b || b.ex !== it.ex || sr(b) !== sr(it)
    if (cur) {
      // si cambia el ejercicio, fuera lo que era propio del anterior (unilateral, tipo de medida)
      const { uni, track, ...rest } = cur
      items.push({ ...(cur.ex !== it.ex ? rest : cur), ...clean(it), id: cur.id, drop: !!it.drop })
    } else if (changed) items.push({ ...clean(it), id: newId(), drop: !!it.drop })
    // si él lo quitó después y el entrenador no lo tocó, no vuelve
  }
  // lo que el alumno añadió después de la propuesta se queda al final
  for (const x of p.items) if (!baseIds.has(x.id)) items.push(x)
  return plan.map((x) => (x.id === p.id ? { ...x, name: day.name || x.name, items } : x))
}

// ---- Entrenador: preparar y mandar un entreno o cambios en un día suyo ----
export function WorkoutBuilder({ data, setData, linkId, studentName, studentPlan = [], startDay = null, nameOf = exName, onClose, onSent }) {
  const snap = (d) => ({ id: d.id, name: d.name, items: d.items.map((it) => ({ ...clean(it), id: it.id })) })
  const [base, setBase] = useState(startDay ? snap(startDay) : null)
  const [mode, setMode] = useState('edit')
  const [name, setName] = useState(startDay?.name || '')
  const [items, setItems] = useState(startDay ? startDay.items.map((it) => ({ ...clean(it), fromId: it.id })) : [])
  const [note, setNote] = useState('')
  const [pick, setPick] = useState(null) // 'add' | índice del ejercicio a cambiar
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const edit = !!base && mode === 'edit'
  const fromDay = (id) => {
    const d = studentPlan.find((x) => x.id === id)
    if (!d) {
      setBase(null)
      setName('')
      setItems([])
      return
    }
    setBase(snap(d))
    setMode('edit')
    setName(d.name)
    setItems(d.items.map((it) => ({ ...clean(it), fromId: it.id })))
  }
  const upd = (i, p) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const removed = edit ? base.items.filter((b) => !items.some((it) => it.fromId === b.id)) : []
  const restore = (b) =>
    setItems((l) => {
      const bi = (id) => base.items.findIndex((x) => x.id === id)
      const at = l.findIndex((it) => it.fromId && bi(it.fromId) > bi(b.id))
      const n = [...l]
      const { id, ...rest } = b
      n.splice(at < 0 ? n.length : at, 0, { ...rest, fromId: id })
      return n
    })
  const out = () => {
    const list = items.map(norm)
    if (!edit) return { name: name.trim() || 'Entreno', items: list.map(({ fromId, ...it }) => it) }
    return {
      name: name.trim() || base.name,
      items: list,
      baseId: base.id,
      baseName: base.name,
      base: base.items.map((b) => ({ id: b.id, ex: b.ex, sets: b.sets, reps: b.reps })),
    }
  }
  const changes = edit ? diffDay(out()) : []
  const send = async () => {
    setBusy(true)
    setErr('')
    try {
      await sendWorkout(linkId, out(), note)
      onSent?.()
      onClose()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }
  if (pick != null)
    return (
      <Library
        data={data}
        setData={setData}
        noCreate
        title={pick === 'add' ? 'Añadir ejercicio' : `Cambiar ${nameOf(items[pick]?.ex)} por…`}
        onClose={() => setPick(null)}
        onPick={(e) => {
          if (pick === 'add') setItems((l) => [...l, { ex: e.id, sets: 3, reps: '10' }])
          else
            setItems((l) =>
              l.map((x, k) => {
                if (k !== pick) return x
                const { uni, track, ...rest } = x
                return { ...rest, ex: e.id }
              })
            )
          setPick(null)
        }}
      />
    )
  return (
    <Modal title={edit ? `Cambios para ${studentName}` : `Entreno para ${studentName}`} onClose={onClose}>
      {studentPlan.length > 0 && (
        <>
          <label className="lbl" style={{ marginTop: 0 }}>
            Partir de un día suyo (opcional)
          </label>
          <select className="inp" value={base?.id || ''} onChange={(e) => fromDay(e.target.value)}>
            <option value="">Empezar de cero</option>
            {studentPlan.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.weekday != null ? ` (${WEEKDAYS[d.weekday]})` : ''}
              </option>
            ))}
          </select>
        </>
      )}
      {base && (
        <>
          <div className="seg" style={{ marginTop: 10 }}>
            <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>
              Cambiar su día
            </button>
            <button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>
              Como día nuevo
            </button>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            {edit ? `Le llega qué cambias, ejercicio a ejercicio. Su "${base.name}" no se toca hasta que acepte.` : 'Le llega como un día nuevo; el suyo se queda como está.'}
          </p>
        </>
      )}
      <label className="lbl">Nombre del día</label>
      <input className="inp" placeholder="Ej.: Pierna (glúteo)" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} />
      <label className="lbl">Ejercicios</label>
      {!items.length && <p className="muted small">Añade los ejercicios que quieres que haga.</p>}
      {items.map((it, i) => {
        const b = edit && it.fromId ? base.items.find((x) => x.id === it.fromId) : null
        return (
          <div className="wb-row" key={i}>
            <div className="grow">
              <div className="li-t">
                {nameOf(it.ex)}
                {edit && !b && <span className="wb-new">nuevo</span>}
              </div>
              {b && b.ex !== it.ex && <div className="small wb-was">en vez de {nameOf(b.ex)}</div>}
              <div className="wb-in">
                <input className="inp" inputMode="numeric" value={it.sets} onChange={(e) => upd(i, { sets: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                <span className="muted small">series ×</span>
                <input className="inp" value={it.reps} onChange={(e) => upd(i, { reps: e.target.value.slice(0, 20) })} />
                <span className="muted small">reps</span>
              </div>
            </div>
            <button className="icon-btn ghost" aria-label="Cambiar por otro" onClick={() => setPick(i)}>
              <Icon name="swap" size={16} />
            </button>
            <button className="icon-btn ghost" aria-label="Quitar" onClick={() => setItems((l) => l.filter((_, k) => k !== i))}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        )
      })}
      {removed.map((b) => (
        <div className="wb-row wb-del" key={b.id}>
          <div className="grow">
            <div className="li-t">{nameOf(b.ex)}</div>
            <div className="small muted">Se lo quitas</div>
          </div>
          <button className="link" style={{ fontSize: 13 }} onClick={() => restore(b)}>
            Volver a poner
          </button>
        </div>
      ))}
      <button className="btn full" style={{ marginTop: 8 }} onClick={() => setPick('add')}>
        <Icon name="plus" size={15} /> Añadir ejercicio
      </button>
      {edit && (
        <>
          <label className="lbl">Lo que le propones</label>
          {changes.length ? <DiffLines changes={changes} nameOf={nameOf} /> : <p className="muted small">Aún no has cambiado nada: cambia, quita o añade ejercicios.</p>}
        </>
      )}
      <label className="lbl">Nota para {studentName} (opcional)</label>
      <textarea className="inp" rows={2} placeholder={edit ? 'Ej.: cambio el press por mancuernas para que no te moleste el hombro.' : 'Ej.: descansa 2 min en las sentadillas y sube 2,5 kg si llegas a 10.'} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} />
      {err && <div className="advice sm yellow">{err}</div>}
      <button className="btn primary full" style={{ marginTop: 12 }} disabled={busy || !items.length || (edit && !changes.length)} onClick={send}>
        {busy ? 'Enviando…' : edit ? 'Mandar cambios' : 'Mandar entreno'}
      </button>
      <p className="muted small">{edit ? `${studentName} verá cada cambio y decide si lo acepta.` : `Le llegará como propuesta: ${studentName} decide si lo añade a su plan.`}</p>
    </Modal>
  )
}

// Lista de entrenos mandados (vista del entrenador)
export function SentWorkouts({ linkId, refresh, nameOf = exName }) {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const load = () => listWorkouts(linkId).then(setList).catch((e) => setErr(e.message))
  useEffect(() => {
    load()
  }, [linkId, refresh])
  if (err) return <div className="advice sm yellow">{err}</div>
  if (!list || !list.length) return null
  const st = { pending: 'Esperando respuesta', accepted: 'Lo ha añadido a su plan', rejected: 'No lo ha añadido' }
  const stC = { pending: 'Esperando respuesta', accepted: 'Ha aceptado los cambios', rejected: 'No ha aceptado los cambios' }
  return (
    <>
      <h4>Lo que le has mandado</h4>
      {list.map((w) => {
        const ch = !!w.day?.baseId
        return (
          <div className="dp-meal" key={w.id}>
            <div className="dp-head">
              <b>{ch ? `Cambios en ${w.day.baseName || 'su día'}` : w.day?.name || 'Entreno'}</b>
              <span className={'small ' + (w.status === 'accepted' ? 'up' : 'muted')}>{(ch ? stC : st)[w.status]}</span>
            </div>
            <div className="small muted">
              {ch ? diffDay(w.day).map((c) => shortTxt(c, nameOf)).join(' · ') : (w.day?.items || []).map((it) => nameOf(it.ex)).join(' · ')} · {when(w.created_at)}
            </div>
            {w.status === 'pending' && (
              <button className="link" style={{ fontSize: 13 }} onClick={() => confirm(ch ? '¿Retirar estos cambios?' : '¿Retirar este entreno?') && deleteWorkout(w.id).then(load)}>
                Retirar
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}

// ---- Alumno: entrenos y cambios que le manda su entrenador ----
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
  const nameOf = (id) => (EX_BY_ID[id]?.name || (data.myExercises || []).find((x) => x.id === id)?.name || 'Ejercicio propio').replace(/ \(.*\)/, '')
  const target = (w) => (w.day?.baseId ? data.plan.find((p) => p.id === w.day.baseId) : null)
  const answer = async (w, ok) => {
    try {
      if (ok && target(w)) {
        // cambios en un día suyo: se aplican a ese día (mismo día de la semana)
        setData((d) => ({ ...d, plan: applyChanges(d.plan, w.day) || d.plan }))
      } else if (ok) {
        const wd = day[w.id] === '' || day[w.id] == null ? null : +day[w.id]
        const newDay = {
          id: newId(),
          name: w.day?.name || 'Entreno del entrenador',
          weekday: wd,
          fromTrainer: true,
          items: (w.day?.items || []).map((raw) => {
            const it = norm(raw)
            return { ...clean(it), id: newId(), drop: !!it.drop }
          }),
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
      {pending.map((w) => {
        const p = target(w)
        if (p) {
          const changes = diffDay(w.day)
          const after = applyChanges([p], w.day)[0]
          return (
            <div className="tw-card" key={w.id}>
              <div className="tw-h">
                <Icon name="edit" size={16} /> {trainerName} te propone cambios
              </div>
              <b>
                En tu día {p.name}
                {p.weekday != null ? ` (${WEEKDAYS[p.weekday]})` : ''}
              </b>
              <DiffLines changes={changes} nameOf={nameOf} />
              {w.note && <div className="small tw-note">“{w.note}”</div>}
              <details className="tw-after">
                <summary>Ver cómo queda el día</summary>
                {after.items.map((it) => (
                  <div className="small dp-item" key={it.id}>
                    {nameOf(it.ex)} <span className="muted">· {it.sets}×{it.reps}</span>
                  </div>
                ))}
              </details>
              <div className="btns">
                <button className="btn" onClick={() => answer(w, false)}>
                  No, gracias
                </button>
                <button className="btn primary" onClick={() => answer(w, true)}>
                  Aceptar cambios
                </button>
              </div>
            </div>
          )
        }
        return (
          <div className="tw-card" key={w.id}>
            <div className="tw-h">
              <Icon name="dumbbell" size={16} /> {trainerName} te ha mandado un entreno
            </div>
            <b>{w.day?.name}</b>
            {w.day?.baseId && <div className="small muted">Eran cambios para "{w.day.baseName}", pero ya no tienes ese día: puedes añadirlo como día nuevo.</div>}
            {(w.day?.items || []).map((it, i) => (
              <div className="small dp-item" key={i}>
                {nameOf(it.ex)} <span className="muted">· {it.sets}×{it.reps}</span>
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
        )
      })}
      {done.length > 0 && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          Anteriores:{' '}
          {done
            .map((w) =>
              w.day?.baseId ? `cambios en ${w.day.baseName} (${w.status === 'accepted' ? 'aceptados' : 'no aceptados'})` : `${w.day?.name} (${w.status === 'accepted' ? 'añadido' : 'no añadido'})`
            )
            .join(', ')}
        </p>
      )}
    </div>
  )
}
