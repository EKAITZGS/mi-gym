// Entrenadores y alumnos: el usuario pide entrenar a un entrenador; si acepta, el entrenador ve sus entrenos y progreso
import { useEffect, useState } from 'react'
import { listTrainers, myLinks, requestTrainer, removeLink, answerLink, profilesOf, studentData } from './cloud'
import { Modal } from './ui'
import Icon from './icons'
import { EX_BY_ID } from './data/exercises'
import { setTxt, WEEKDAYS, fmtKg } from './store'

const fmtDate = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const exName = (id) => (EX_BY_ID[id]?.name || id).replace(/ \(.*\)/, '')

function useLoad(fn, deps = []) {
  const [st, setSt] = useState({ data: null, error: '', loading: true })
  const load = () => {
    setSt((s) => ({ ...s, loading: true }))
    fn()
      .then((data) => setSt({ data, error: '', loading: false }))
      .catch((e) => setSt({ data: null, error: e.message, loading: false }))
  }
  useEffect(load, deps)
  return [st, load]
}

// ---- Usuario: lista de entrenadores y su solicitud ----
export function MyTrainer({ uid }) {
  const [st, reload] = useLoad(async () => {
    const [trainers, links] = await Promise.all([listTrainers(), myLinks()])
    return { trainers: trainers.filter((t) => t.id !== uid), links: links.filter((l) => l.user_id === uid) }
  })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const act = async (id, fn) => {
    setBusy(id)
    setErr('')
    try {
      await fn()
      reload()
    } catch (e) {
      setErr(e.message)
    }
    setBusy('')
  }
  if (st.loading && !st.data) return <div className="card muted small">Cargando entrenadores…</div>
  if (st.error) return <div className="card"><div className="advice sm yellow">{st.error}</div></div>
  const { trainers, links } = st.data
  const linkOf = (tid) => links.find((l) => l.trainer_id === tid)
  const mine = links.find((l) => l.status === 'accepted')
  return (
    <div className="card trainers">
      {mine ? (
        <p className="small" style={{ marginTop: 0 }}>
          Tu entrenador es <b>{trainers.find((t) => t.id === mine.trainer_id)?.name || 'tu entrenador'}</b>: ve tus entrenos y tu progreso.
        </p>
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>
          Pide a un entrenador que te lleve. Si acepta, podrá ver tus entrenos, tu plan y tu progreso. Puedes dejarlo cuando quieras.
        </p>
      )}
      {!trainers.length && <p className="muted small">Todavía no hay entrenadores en la app.</p>}
      {trainers.map((t) => {
        const l = linkOf(t.id)
        return (
          <div className="row nob tr-row" key={t.id}>
            <span className="tr-av">{(t.name || '?').slice(0, 1).toUpperCase()}</span>
            <div className="grow">
              <div className="li-t">{t.name || 'Entrenador'}</div>
              <div className="muted small">
                {l?.status === 'accepted' ? 'Tu entrenador' : l?.status === 'pending' ? 'Solicitud enviada, esperando respuesta' : l?.status === 'rejected' ? 'No aceptó tu solicitud' : 'Entrenador'}
              </div>
              {t.bio && <div className="small tr-bio">{t.bio}</div>}
            </div>
            {l?.status === 'accepted' ? (
              <button className="btn sm-btn" disabled={busy === t.id} onClick={() => confirm(`¿Dejar de entrenar con ${t.name}? Dejará de ver tus entrenos.`) && act(t.id, () => removeLink(l.id))}>
                Dejar
              </button>
            ) : l?.status === 'pending' ? (
              <button className="btn sm-btn" disabled={busy === t.id} onClick={() => act(t.id, () => removeLink(l.id))}>
                Cancelar
              </button>
            ) : (
              <button className="btn primary sm-btn" disabled={busy === t.id || !!mine} onClick={() => act(t.id, () => requestTrainer(t.id))}>
                {l?.status === 'rejected' ? 'Pedir otra vez' : 'Solicitar'}
              </button>
            )}
          </div>
        )
      })}
      {mine && <p className="muted small" style={{ marginBottom: 0 }}>Para cambiar de entrenador, deja primero el actual.</p>}
      {err && <div className="advice sm yellow">{err}</div>}
    </div>
  )
}

// ---- Entrenador: solicitudes y alumnos ----
export function Students({ uid }) {
  const [st, reload] = useLoad(async () => {
    const links = (await myLinks()).filter((l) => l.trainer_id === uid)
    const people = await profilesOf([...new Set(links.map((l) => l.user_id))])
    const name = Object.fromEntries(people.map((p) => [p.id, p.name]))
    return links.map((l) => ({ ...l, name: name[l.user_id] || 'Usuario' }))
  })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const act = async (id, fn) => {
    setBusy(id)
    setErr('')
    try {
      await fn()
      reload()
    } catch (e) {
      setErr(e.message)
    }
    setBusy('')
  }
  if (st.loading && !st.data) return <div className="card muted small">Cargando alumnos…</div>
  if (st.error) return <div className="card"><div className="advice sm yellow">{st.error}</div></div>
  const pending = st.data.filter((l) => l.status === 'pending')
  const accepted = st.data.filter((l) => l.status === 'accepted')
  return (
    <div className="card trainers">
      {pending.length > 0 && (
        <>
          <div className="tr-h">Solicitudes ({pending.length})</div>
          {pending.map((l) => (
            <div className="row nob tr-row" key={l.id}>
              <span className="tr-av">{l.name.slice(0, 1).toUpperCase()}</span>
              <div className="grow">
                <div className="li-t">{l.name}</div>
                <div className="muted small">Quiere que le entrenes · {fmtDate(l.created_at)}</div>
              </div>
              <button className="btn sm-btn" disabled={busy === l.id} onClick={() => act(l.id, () => answerLink(l.id, false))}>
                No
              </button>
              <button className="btn primary sm-btn" disabled={busy === l.id} onClick={() => act(l.id, () => answerLink(l.id, true))}>
                Aceptar
              </button>
            </div>
          ))}
        </>
      )}
      <div className="tr-h">Tus alumnos ({accepted.length})</div>
      {!accepted.length && <p className="muted small">Cuando aceptes a alguien, aparecerá aquí y podrás ver sus entrenos.</p>}
      {accepted.map((l) => (
        <button className="row nob li tr-row" key={l.id} onClick={() => setOpen(l)}>
          <span className="tr-av">{l.name.slice(0, 1).toUpperCase()}</span>
          <div className="grow">
            <div className="li-t">{l.name}</div>
            <div className="muted small">Ver entrenos y progreso</div>
          </div>
          <Icon name="right" size={16} className="muted" />
        </button>
      ))}
      <button className="link" style={{ fontSize: 13 }} onClick={reload} disabled={st.loading}>
        {st.loading ? 'Actualizando…' : 'Actualizar'}
      </button>
      {err && <div className="advice sm yellow">{err}</div>}
      {open && (
        <StudentView
          student={open}
          onClose={() => setOpen(null)}
          onRemove={() => confirm(`¿Dejar de entrenar a ${open.name}?`) && act(open.id, () => removeLink(open.id)).then(() => setOpen(null))}
        />
      )}
    </div>
  )
}

// Lo que ve el entrenador de un alumno: plan, últimos entrenos y cuerpo (peso solo como media)
function StudentView({ student, onClose, onRemove }) {
  const [st] = useLoad(() => studentData(student.user_id), [student.user_id])
  const d = st.data?.data
  const sessions = (d?.sessions || []).filter((s) => Object.keys(s.entries || {}).length).slice().reverse()
  const week = sessions.filter((s) => (Date.now() - Date.parse(s.date)) / 864e5 < 7).length
  const w = d?.body?.weight || []
  const avg3 = (list) => (list.length ? list.reduce((a, x) => a + x.kg, 0) / list.length : null)
  const wNow = avg3(w.slice(-3))
  const wStart = w.length >= 4 ? avg3(w.slice(0, 3)) : null
  const waist = d?.body?.waist || []
  return (
    <Modal title={student.name} onClose={onClose}>
      {st.loading && <p className="muted small">Cargando…</p>}
      {st.error && <div className="advice sm yellow">{st.error}</div>}
      {!st.loading && !d && !st.error && <p className="muted small">Aún no tiene datos en la app.</p>}
      {d && (
        <>
          <div className="polar-sum">
            <div>
              <b>{week}</b>
              <span>entrenos en 7 días</span>
            </div>
            <div>
              <b>{sessions.length}</b>
              <span>en total</span>
            </div>
            {waist.length > 0 && (
              <div>
                <b>{fmtKg(waist[waist.length - 1].cm)}</b>
                <span>cm cintura{waist.length > 1 ? ` (${waist[waist.length - 1].cm - waist[0].cm > 0 ? '+' : ''}${fmtKg(waist[waist.length - 1].cm - waist[0].cm)})` : ''}</span>
              </div>
            )}
            {wNow && (
              <div>
                <b>{fmtKg(Math.round(wNow * 10) / 10)}</b>
                <span>
                  kg (media)
                  {wStart && Math.round((wNow - wStart) * 10)
                    ? ` (${wNow - wStart > 0 ? '+' : ''}${fmtKg(Math.round((wNow - wStart) * 10) / 10)})`
                    : ''}
                </span>
              </div>
            )}
          </div>

          <h4>Su plan</h4>
          {!(d.plan || []).length && <p className="muted small">No tiene plan.</p>}
          {(d.plan || []).map((day) => (
            <div className="dp-meal" key={day.id}>
              <div className="dp-head">
                <b>{day.name}</b>
                <span className="muted small">{day.weekday != null ? WEEKDAYS[day.weekday] : 'Sin día'}</span>
              </div>
              {day.items.map((it) => (
                <div className="small dp-item" key={it.id}>
                  {exName(it.ex)} <span className="muted">· {it.sets}×{it.reps}</span>
                </div>
              ))}
            </div>
          ))}

          <h4>Últimos entrenos</h4>
          {!sessions.length && <p className="muted small">Aún no ha entrenado.</p>}
          {sessions.slice(0, 15).map((s) => (
            <div className="dp-meal" key={s.id}>
              <div className="dp-head">
                <b>{s.dayName || 'Entreno'}</b>
                <span className="muted small">
                  {fmtDate(s.date)}
                  {s.min ? ` · ${s.min} min` : ''}
                </span>
              </div>
              {Object.entries(s.entries).map(([id, sets]) => (
                <div className="small dp-item" key={id}>
                  {exName(id)}
                  <span className="muted">
                    {' '}
                    · {sets.map(setTxt).join(', ')}
                    {s.checkin?.rir?.[id] != null ? ` · RIR ${s.checkin.rir[id]}` : ''}
                  </span>
                </div>
              ))}
              {s.checkin?.note && <div className="small muted">“{s.checkin.note}”</div>}
            </div>
          ))}
          <p className="muted small">Actualizado {st.data.updated_at ? new Date(st.data.updated_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}.</p>
          <button className="btn full" onClick={onRemove}>
            Dejar de entrenarle
          </button>
        </>
      )}
    </Modal>
  )
}
