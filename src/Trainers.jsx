// Entrenadores y alumnos: el usuario pide entrenar a un entrenador; si acepta, el entrenador ve sus entrenos y progreso
import { useEffect, useState } from 'react'
import { listTrainers, myLinks, requestTrainer, removeLink, answerLink, profilesOf, studentData } from './cloud'
import { Modal } from './ui'
import { Chat, WorkoutBuilder, SentWorkouts, TrainerWorkouts } from './CoachTools'
import Icon from './icons'
import PolarSession, { HrSpark } from './PolarSession'
import { SessionCard, hasSet, fmtDay } from './DayDetail'
import { EX_BY_ID } from './data/exercises'
import { WEEKDAYS, fmtKg } from './store'

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
export function MyTrainer({ uid, data, setData, inbox, onInbox }) {
  const [st, reload] = useLoad(async () => {
    const [trainers, links] = await Promise.all([listTrainers(), myLinks()])
    return { trainers: trainers.filter((t) => t.id !== uid), links: links.filter((l) => l.user_id === uid) }
  })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [chat, setChat] = useState(false)
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
        <>
          <p className="small" style={{ marginTop: 0 }}>
            Tu entrenador es <b>{trainers.find((t) => t.id === mine.trainer_id)?.name || 'tu entrenador'}</b>: ve tus entrenos y tu progreso.
          </p>
          <button className="btn full" onClick={() => setChat(true)}>
            <Icon name="book" size={15} /> Mensajes{inbox?.msgByLink?.[mine.id] ? ` (${inbox.msgByLink[mine.id]} nuevos)` : ''}
          </button>
          {data && (
            <TrainerWorkouts
              linkId={mine.id}
              trainerName={trainers.find((t) => t.id === mine.trainer_id)?.name || 'Tu entrenador'}
              data={data}
              setData={setData}
              onChange={onInbox}
            />
          )}
          {chat && (
            <Chat
              linkId={mine.id}
              me={uid}
              title={trainers.find((t) => t.id === mine.trainer_id)?.name || 'Tu entrenador'}
              onClose={() => (setChat(false), onInbox?.())}
            />
          )}
        </>
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
export function Students({ uid, data, setData, inbox, onInbox }) {
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
            <div className="muted small">
              {inbox?.msgByLink?.[l.id] ? <b className="up">{inbox.msgByLink[l.id]} mensaje{inbox.msgByLink[l.id] === 1 ? '' : 's'} nuevo{inbox.msgByLink[l.id] === 1 ? '' : 's'} · </b> : ''}
              Entrenos, progreso y mensajes
            </div>
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
          me={uid}
          data={data}
          setData={setData}
          unread={inbox?.msgByLink?.[open.id] || 0}
          onInbox={onInbox}
          onClose={() => setOpen(null)}
          onRemove={() => confirm(`¿Dejar de entrenar a ${open.name}?`) && act(open.id, () => removeLink(open.id)).then(() => setOpen(null))}
        />
      )}
    </div>
  )
}

// Lo que ve el entrenador de un alumno: entrenos, plan y progreso (peso solo como media)

function StudentView({ student, me, data, setData, unread, onInbox, onClose, onRemove }) {
  const [st] = useLoad(() => studentData(student.user_id), [student.user_id])
  const [chat, setChat] = useState(false)
  const [build, setBuild] = useState(false)
  const [sent, setSent] = useState(0)
  const [tab, setTab] = useState('train')
  const [px, setPx] = useState(null)
  const d = st.data?.data
  // entrenos del reloj (los sincroniza el alumno en su móvil y llegan con sus datos)
  const watch = Object.values(d?.polar?.exercises || {}).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  // nombre de cada ejercicio (también los que el alumno creó él)
  const nameOf = (id) => (EX_BY_ID[id]?.name || (d?.myExercises || []).find((x) => x.id === id)?.name || 'Ejercicio propio').replace(/ \(.*\)/, '')
  const sessions = (d?.sessions || []).filter((s) => Object.values(s.entries || {}).some((l) => l.some(hasSet))).slice().reverse()
  const week = sessions.filter((s) => (Date.now() - Date.parse(s.date)) / 864e5 < 7).length
  const w = d?.body?.weight || []
  const avg3 = (list) => (list.length ? list.reduce((a, x) => a + x.kg, 0) / list.length : null)
  const wNow = avg3(w.slice(-3))
  const wStart = w.length >= 4 ? avg3(w.slice(0, 3)) : null
  const waist = d?.body?.waist || []
  const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±')
  return (
    <Modal title={student.name} onClose={onClose}>
      <div className="btns" style={{ marginTop: 0 }}>
        <button className="btn" onClick={() => setChat(true)}>
          <Icon name="book" size={15} /> Mensajes{unread ? ` (${unread})` : ''}
        </button>
        <button className="btn primary" onClick={() => setBuild(true)}>
          <Icon name="dumbbell" size={15} /> Mandar entreno
        </button>
      </div>
      {chat && <Chat linkId={student.id} me={me} title={student.name} onClose={() => (setChat(false), onInbox?.())} />}
      {build && (
        <WorkoutBuilder
          data={data}
          setData={setData}
          linkId={student.id}
          studentName={student.name}
          studentPlan={d?.plan || []}
          startDay={build === true ? null : build}
          nameOf={nameOf}
          onClose={() => setBuild(false)}
          onSent={() => setSent((n) => n + 1)}
        />
      )}
      <SentWorkouts linkId={student.id} refresh={sent} nameOf={nameOf} />

      {st.loading && <p className="muted small">Cargando…</p>}
      {st.error && <div className="advice sm yellow">{st.error}</div>}
      {!st.loading && !d && !st.error && <p className="muted small">Aún no tiene datos en la app.</p>}
      {d && (
        <>
          <div className="sv-stats">
            <div>
              <b>{week}</b>
              <span>entrenos esta semana</span>
            </div>
            <div>
              <b>{waist.length ? fmtKg(waist[waist.length - 1].cm) : '—'}</b>
              <span>
                cm de cintura
                {waist.length > 1 ? ` (${sign(waist[waist.length - 1].cm - waist[0].cm)}${fmtKg(Math.abs(waist[waist.length - 1].cm - waist[0].cm))})` : ''}
              </span>
            </div>
            <div>
              <b>{w.length ? fmtKg(w[w.length - 1].kg) : '—'}</b>
              <span>
                kg {w.length ? `· ${fmtDay(w[w.length - 1].date).slice(4)}` : ''}
                {wNow && w.length >= 2 ? ` · media ${fmtKg(Math.round(wNow * 10) / 10)}` : ''}
                {wStart && Math.round((wNow - wStart) * 10) ? ` (${sign(wNow - wStart)}${fmtKg(Math.abs(Math.round((wNow - wStart) * 10) / 10))})` : ''}
              </span>
            </div>
          </div>

          <div className="seg sv-tabs three">
            <button className={tab === 'train' ? 'on' : ''} onClick={() => setTab('train')}>
              Entrenos ({sessions.length})
            </button>
            <button className={tab === 'hr' ? 'on' : ''} onClick={() => setTab('hr')}>
              Pulso
            </button>
            <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>
              Su plan
            </button>
          </div>

          {tab === 'train' && (
            <>
              {!sessions.length && <p className="muted small">Aún no ha entrenado.</p>}
              {sessions.slice(0, 20).map((s) => (
                <SessionCard key={s.id} s={s} nameOf={nameOf} watch={watch.filter((e) => e.date === s.date)} onHr={setPx} />
              ))}
            </>
          )}

          {tab === 'hr' && (
            <>
              {!watch.length && <p className="muted small">{d.polar ? 'Aún no hay entrenos del reloj.' : 'No tiene reloj conectado (o aún no lo ha sincronizado).'}</p>}
              {watch.slice(0, 30).map((e) => (
                <button className="polar-ex" key={e.id} onClick={() => setPx(e)}>
                  <div className="grow">
                    <div className="li-t">
                      {e.sport} · {e.min} min
                    </div>
                    <div className="muted small">
                      {fmtDay(e.date)} · {e.time}
                      {(() => {
                        // nombre del entreno que apuntó ese día (solo en entrenos de fuerza del reloj)
                        const ss = /fuerza/i.test(e.sport) ? (d.sessions || []).filter((x) => x.date === e.date && x.dayName) : []
                        return ss.length ? ` · ${[...new Set(ss.map((x) => x.dayName))].join(' + ')}` : ''
                      })()}
                    </div>
                  </div>
                  <HrSpark hr={e.hr} />
                  <div className="polar-stats">{e.hrAvg ? <span><b>{e.hrAvg}</b>/{e.hrMax} ppm</span> : <span>sin pulso</span>}</div>
                </button>
              ))}
              {watch.length > 0 && <p className="muted small">Toca un entreno para ver la curva de pulso, las zonas y la valoración según lo que entrenó ese día.</p>}
            </>
          )}

          {tab === 'plan' && (
            <>
              {!(d.plan || []).length && <p className="muted small">No tiene plan.</p>}
              {(d.plan || []).map((day) => (
                <div className="sv-card" key={day.id}>
                  <div className="sv-head">
                    <b>{day.name}</b>
                    <span className={'sv-chip' + (day.weekday != null ? ' on' : '')}>{day.weekday != null ? WEEKDAYS[day.weekday] : 'Sin día'}</span>
                  </div>
                  {day.items.map((it) => (
                    <div className="sv-row" key={it.id}>
                      <span>{nameOf(it.ex)}</span>
                      <b>
                        {it.sets} × {it.reps}
                      </b>
                    </div>
                  ))}
                  <button className="btn full sv-edit" onClick={() => setBuild(day)}>
                    <Icon name="edit" size={15} /> Proponer cambios
                  </button>
                </div>
              ))}
            </>
          )}

          {px && <PolarSession ex={px} data={d} them onClose={() => setPx(null)} />}
          <p className="muted small">
            Datos actualizados el{' '}
            {st.data.updated_at ? new Date(st.data.updated_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}.
          </p>
          <button className="btn full" onClick={onRemove}>
            Dejar de entrenarle
          </button>
        </>
      )}
    </Modal>
  )
}
