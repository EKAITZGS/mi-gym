import { useMemo, useState } from 'react'
import { EXERCISES, EX_BY_ID, GROUPS } from './data/exercises'
import { WEEKDAYS, uid, lastSets, exStats, suggestion, fmtKg, num } from './store'
import { Modal, Thumb, LineChart, ExPhoto } from './ui'
import Icon from './icons'
import { generatePlan, PLAN_OPTIONS } from './plans'

const ORDER = [1, 2, 3, 4, 5, 6, 0] // lunes primero

/* ---------- Modal de ejercicio ---------- */
export function ExerciseModal({ ex, data, onClose, onPick, pickLabel, onDelete }) {
  const stats = useMemo(() => exStats(data.sessions, ex.id), [data.sessions, ex.id])
  const [metric, setMetric] = useState('e1rm')
  const bestAll = stats.reduce((m, x) => (!m || x.best.e > m.e ? x.best : m), null)
  const history = useMemo(() => {
    const out = []
    for (let i = data.sessions.length - 1; i >= 0 && out.length < 5; i--) {
      const sets = data.sessions[i].entries?.[ex.id]
      if (sets) out.push({ date: data.sessions[i].date, sets })
    }
    return out
  }, [data.sessions, ex.id])
  return (
    <Modal title={ex.name} onClose={onClose}>
      <ExPhoto ex={ex} />
      <div className="tags">
        {ex.main.map((m) => (
          <span key={m} className="tag tag-main">{m}</span>
        ))}
        {ex.sec.map((m) => (
          <span key={m} className="tag">{m}</span>
        ))}
        <span className="tag eq">{ex.equip}</span>
      </div>
      {onPick && (
        <button className="btn primary full" onClick={onPick}>
          {pickLabel || 'Añadir'}
        </button>
      )}
      {onDelete && (
        <button className="btn danger full" onClick={onDelete}>
          Borrar este ejercicio
        </button>
      )}
      {stats.length > 0 && (
        <>
          <h4>Progreso</h4>
          <p className="muted small">
            Mejor serie: <b>{fmtKg(bestAll.w)} kg × {bestAll.r}</b> · 1RM estimado {fmtKg(Math.round(bestAll.e * 10) / 10)} kg
          </p>
          <div className="chips">
            <button className={'chip' + (metric === 'e1rm' ? ' on' : '')} onClick={() => setMetric('e1rm')}>
              Fuerza (1RM est.)
            </button>
            <button className={'chip' + (metric === 'vol' ? ' on' : '')} onClick={() => setMetric('vol')}>
              Volumen
            </button>
          </div>
          <LineChart points={stats.map((x) => ({ label: x.date, v: metric === 'e1rm' ? x.best.e : x.vol }))} />
        </>
      )}
      <h4>Historial</h4>
      {history.length === 0 && <p className="muted">Aún no has registrado este ejercicio.</p>}
      {history.map((h) => (
        <div key={h.date} className="hist">
          <b>{h.date}</b>
          <div>
            {h.sets.map((s, i) => (
              <span key={i} className="pill">
                {s.w || '?'}kg×{s.r || '?'}
                {s.drops?.length ? ' ↓' + s.drops.map((d) => `${d.w || '?'}×${d.r || '?'}`).join('↓') : ''}
              </span>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  )
}

/* ---------- Biblioteca / selector ---------- */
function CreateExercise({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState(GROUPS[0])
  return (
    <Modal title="Ejercicio propio" onClose={onClose}>
      <label className="lbl">Nombre</label>
      <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Press en máquina Smith" />
      <label className="lbl">Grupo muscular</label>
      <select className="inp" value={group} onChange={(e) => setGroup(e.target.value)}>
        {GROUPS.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </select>
      <button className="btn primary full" disabled={!name.trim()} onClick={() => onCreate(name.trim(), group)}>
        Crear
      </button>
    </Modal>
  )
}

function Library({ data, setData, onPick, onClose, inline, title }) {
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('Todos')
  const [open, setOpen] = useState(null)
  const list = EXERCISES.filter(
    (e) =>
      (group === 'Todos' || e.group === group) && (!q || e.name.toLowerCase().includes(q.toLowerCase()))
  )
  const body = (
    <>
      <input className="inp" placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {['Todos', ...GROUPS].map((g) => (
          <button key={g} className={'chip' + (g === group ? ' on' : '')} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="list">
        {list.map((e) => (
          <button key={e.id} className="row" onClick={() => setOpen(e)}>
            <Thumb ex={e} />
            <div className="grow">
              <div>{e.name}</div>
              <div className="muted small">
                {e.group} · {e.equip}
              </div>
            </div>
            {onPick && <span className="plus"><Icon name="plus" size={18} /></span>}
          </button>
        ))}
        {list.length === 0 && <p className="muted">Sin resultados.</p>}
      </div>
      <button className="btn full" onClick={() => setCreating(true)}>
        + Crear ejercicio propio
      </button>
      {creating && (
        <CreateExercise
          onClose={() => setCreating(false)}
          onCreate={(name, grp) => {
            setData((d) => ({ ...d, myExercises: [...(d.myExercises || []), { id: 'c-' + uid(), name, group: grp }] }))
            setCreating(false)
          }}
        />
      )}
      {open && (
        <ExerciseModal
          ex={open}
          data={data}
          onClose={() => setOpen(null)}
          onPick={onPick ? () => (onPick(open), setOpen(null)) : null}
          onDelete={
            open.custom
              ? () => {
                  if (!confirm('¿Borrar este ejercicio? También se quitará de tus días.')) return
                  setData((d) => ({
                    ...d,
                    myExercises: (d.myExercises || []).filter((x) => x.id !== open.id),
                    plan: d.plan.map((p) => ({ ...p, items: p.items.filter((i) => i.ex !== open.id) })),
                  }))
                  setOpen(null)
                }
              : null
          }
        />
      )}
    </>
  )
  if (inline) return body
  return (
    <Modal title={title || 'Elegir ejercicio'} onClose={onClose}>
      {body}
    </Modal>
  )
}

/* ---------- Generador de plan ---------- */
function Generator({ onClose, onGenerate }) {
  const [days, setDays] = useState(4)
  return (
    <Modal title="Generar plan automático" onClose={onClose}>
      <p className="muted">
        Elige cuántos días a la semana vas a entrenar. Esto <b>sustituye tu plan actual</b> (luego puedes cambiar
        cualquier ejercicio, series o día).
      </p>
      <div className="list">
        {PLAN_OPTIONS.map((o) => (
          <button key={o.days} className={'row opt' + (days === o.days ? ' on' : '')} onClick={() => setDays(o.days)}>
            <div className="grow">
              <b>{o.label}</b>
              <div className="muted small">{o.hint}</div>
            </div>
            {days === o.days && <span className="plus"><Icon name="check" size={18} /></span>}
          </button>
        ))}
      </div>
      <button className="btn primary full" onClick={() => onGenerate(days)}>
        Generar plan de {days} días
      </button>
    </Modal>
  )
}

/* ---------- Editor de día ---------- */
function DayEditor({ data, setData, dayId, onBack }) {
  const day = data.plan.find((d) => d.id === dayId)
  const [picker, setPicker] = useState(false)
  if (!day) return null
  const patchDay = (p) => setData((d) => ({ ...d, plan: d.plan.map((x) => (x.id === dayId ? { ...x, ...p } : x)) }))
  const patchItem = (id, p) => patchDay({ items: day.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })
  const move = (idx, dir) => {
    const items = [...day.items]
    const j = idx + dir
    if (j < 0 || j >= items.length) return
    ;[items[idx], items[j]] = [items[j], items[idx]]
    patchDay({ items })
  }
  const add = (ex) => {
    if (day.items.some((i) => i.ex === ex.id)) return setPicker(false)
    patchDay({ items: [...day.items, { id: uid(), ex: ex.id, sets: 3, reps: '10', drop: false }] })
    setPicker(false)
  }
  const del = () => {
    if (!confirm(`¿Borrar el día "${day.name}"?`)) return
    setData((d) => ({ ...d, plan: d.plan.filter((x) => x.id !== dayId) }))
    onBack()
  }
  return (
    <div className="page">
      <button className="link" onClick={onBack}>
        <Icon name="left" size={18} /> Volver
      </button>
      <h2>Editar día</h2>
      <label className="lbl">Nombre</label>
      <input className="inp" value={day.name} onChange={(e) => patchDay({ name: e.target.value })} />
      <label className="lbl">Día de la semana</label>
      <select
        className="inp"
        value={day.weekday ?? ''}
        onChange={(e) => patchDay({ weekday: e.target.value === '' ? null : Number(e.target.value) })}
      >
        <option value="">Sin día fijo</option>
        {ORDER.map((w) => (
          <option key={w} value={w}>
            {WEEKDAYS[w]}
          </option>
        ))}
      </select>
      <h4>Ejercicios</h4>
      {day.items.map((it, idx) => {
        const ex = EX_BY_ID[it.ex]
        return (
          <div className="card" key={it.id}>
            <div className="row nob">
              <Thumb ex={ex} />
              <div className="grow">{ex?.name || it.ex}</div>
              <button className="icon-btn" onClick={() => move(idx, -1)} aria-label="Subir">
                <Icon name="up" size={16} />
              </button>
              <button className="icon-btn" onClick={() => move(idx, 1)} aria-label="Bajar">
                <Icon name="down" size={16} />
              </button>
              <button className="icon-btn" onClick={() => patchDay({ items: day.items.filter((i) => i.id !== it.id) })}>
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="fields">
              <label>
                Series
                <input
                  className="inp sm"
                  inputMode="numeric"
                  value={it.sets}
                  onChange={(e) => patchItem(it.id, { sets: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                />
              </label>
              <label>
                Reps / objetivo
                <input className="inp sm" value={it.reps} onChange={(e) => patchItem(it.id, { reps: e.target.value })} />
              </label>
              <label className="chk-l">
                <input type="checkbox" checked={!!it.drop} onChange={(e) => patchItem(it.id, { drop: e.target.checked })} />
                Drop set
              </label>
            </div>
          </div>
        )
      })}
      <button className="btn full" onClick={() => setPicker(true)}>
        + Añadir ejercicio
      </button>
      <button className="btn danger full" onClick={del}>
        Eliminar este día
      </button>
      {picker && <Library data={data} setData={setData} onPick={add} onClose={() => setPicker(false)} />}
    </div>
  )
}

/* ---------- Entreno en curso ---------- */
function Session({ data, setData, onExit }) {
  const a = data.active
  const day = a ? data.plan.find((d) => d.id === a.dayId) : null
  const items = a?.items || day?.items || []
  const name = a?.name || day?.name || 'Entreno'
  const [detail, setDetail] = useState(null)
  const [picker, setPicker] = useState(null) // { mode: 'add' } | { mode: 'swap', itemId }
  const [done, setDone] = useState(null) // { prs, changed, items, dayId, name } al terminar

  const newSets = (n, drop) =>
    Array.from({ length: n }, () => ({ w: '', r: '', done: false, drops: drop ? [{ w: '', r: '' }] : [] }))
  const setActive = (fn) => setData((d) => (d.active ? { ...d, active: fn(d.active) } : d))
  const curItems = (act) => act.items || day?.items || []
  const removeItem = (itemId) =>
    setActive((act) => {
      const its = curItems(act)
      const it = its.find((i) => i.id === itemId)
      const entries = { ...act.entries }
      if (it) delete entries[it.ex]
      return { ...act, items: its.filter((i) => i.id !== itemId), entries }
    })
  const addSet = (exId) =>
    setActive((act) => ({ ...act, entries: { ...act.entries, [exId]: [...(act.entries[exId] || []), ...newSets(1, false)] } }))
  const pickEx = (ex) => {
    const p = picker
    setPicker(null)
    setActive((act) => {
      const its = curItems(act)
      if (its.some((i) => i.ex === ex.id)) return act
      const entries = { ...act.entries }
      if (p?.mode === 'swap') {
        const old = its.find((i) => i.id === p.itemId)
        if (!old) return act
        delete entries[old.ex]
        entries[ex.id] = newSets(old.sets, old.drop)
        return { ...act, items: its.map((i) => (i.id === p.itemId ? { ...i, ex: ex.id } : i)), entries }
      }
      entries[ex.id] = newSets(3, false)
      return { ...act, items: [...its, { id: uid(), ex: ex.id, sets: 3, reps: '10', drop: false }], entries }
    })
  }
  const saveToPlan = () => {
    const its = done.items.map((i) => ({ ...i, id: uid() }))
    if (done.dayId === 'free') {
      setData((d) => ({ ...d, plan: [...d.plan, { id: uid(), name: 'Mi entreno', weekday: null, items: its }] }))
    } else {
      setData((d) => ({ ...d, plan: d.plan.map((x) => (x.id === done.dayId ? { ...x, items: its } : x)) }))
    }
    setDone({ ...done, changed: false, saved: true })
  }

  if (done)
    return (
      <div className="page">
        <Modal title="Entreno guardado" onClose={onExit}>
          {done.prs.length > 0 ? (
            <>
              <h4>Récords nuevos</h4>
              {done.prs.map((p) => (
                <div className="pr" key={p.name}>
                  <Icon name="trophy" size={18} className="gold" /> <b>{p.name}</b>: {fmtKg(p.w)} kg × {p.r}
                  <div className="muted small">
                    1RM estimado {fmtKg(Math.round(p.e * 10) / 10)} kg (antes {fmtKg(Math.round(p.prev * 10) / 10)})
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="muted">Entreno registrado. Cada serie que anotas hace más fiable tu progreso.</p>
          )}
          {done.changed && (
            <div className="card save-plan">
              <b>{done.dayId === 'free' ? '¿Guardar este entreno como un día?' : 'Has cambiado ejercicios'}</b>
              <p className="muted small">
                {done.dayId === 'free'
                  ? 'Lo tendrás en tus días para repetirlo (puedes renombrarlo y asignarle día).'
                  : `¿Quieres que "${done.name}" quede así para la próxima vez?`}
              </p>
              <button className="btn full" onClick={saveToPlan}>
                {done.dayId === 'free' ? 'Guardar como día nuevo' : 'Guardar cambios en el plan'}
              </button>
            </div>
          )}
          {done.saved && <p className="toast">Guardado en tu plan.</p>}
          <button className="btn primary full" onClick={onExit}>
            Listo
          </button>
        </Modal>
      </div>
    )

  if (!a)
    return (
      <div className="page">
        <button className="link" onClick={onExit}>
          <Icon name="left" size={18} /> Volver
        </button>
      </div>
    )

  const patchSet = (exId, si, fn) =>
    setData((d) => ({
      ...d,
      active: {
        ...d.active,
        entries: { ...d.active.entries, [exId]: d.active.entries[exId].map((s, i) => (i === si ? fn(s) : s)) },
      },
    }))

  const finish = () => {
    const entries = {}
    for (const [k, sets] of Object.entries(a.entries)) {
      const kept = sets
        .filter((s) => s.done || s.w || s.r || s.drops.some((x) => x.w || x.r))
        .map((s) => ({ w: s.w, r: s.r, drops: s.drops.filter((x) => x.w || x.r) }))
      if (kept.length) entries[k] = kept
    }
    // récords: mejor 1RM estimado frente a todos los entrenos anteriores
    const prs = []
    for (const [exId, sets] of Object.entries(entries)) {
      const prev = exStats(data.sessions, exId)
      if (!prev.length) continue
      const prevBest = Math.max(...prev.map((x) => x.best.e))
      const cur = exStats([{ entries: { [exId]: sets } }], exId)[0]
      if (cur && cur.best.e > prevBest + 0.01) {
        prs.push({ name: EX_BY_ID[exId]?.name || exId, w: cur.best.w, r: cur.best.r, e: cur.best.e, prev: prevBest })
      }
    }
    setData((d) => ({
      ...d,
      active: null,
      sessions: [...d.sessions, { id: uid(), date: a.date, dayId: a.dayId, dayName: name, entries }],
    }))
    const before = (day?.items || []).map((i) => i.ex).join('|')
    const after = items.map((i) => i.ex).join('|')
    const changed = items.length > 0 && (a.dayId === 'free' || (day && before !== after))
    setDone({ prs, changed, items, dayId: a.dayId, name })
  }
  const discard = () => {
    if (!confirm('¿Descartar este entreno sin guardar?')) return
    setData((d) => ({ ...d, active: null }))
    onExit()
  }
  return (
    <div className="page">
      <button className="link" onClick={onExit}>
        <Icon name="left" size={18} /> Salir (se queda guardado)
      </button>
      <h1 className="title">{name}</h1>
      {items.length === 0 && (
        <div className="empty-state">
          <Icon name="dumbbell" size={28} />
          <p>Añade los ejercicios que vayas haciendo.</p>
        </div>
      )}
      {items.map((it) => {
        const ex = EX_BY_ID[it.ex]
        const sets = a.entries[it.ex] || []
        const last = lastSets(data.sessions, it.ex)
        const sug = suggestion(data.sessions, it.ex, it.reps, it.sets, ex?.equip)
        const phOf = (i) => {
          const base = last?.sets[i] || last?.sets[last.sets.length - 1] || {}
          return sug ? { ...base, w: fmtKg(sug.w), r: String(sug.reps) } : base
        }
        return (
          <div className="card" key={it.id}>
            <div className="ex-tools">
              <button className="tool" onClick={() => setPicker({ mode: 'swap', itemId: it.id })}>
                <Icon name="swap" size={15} /> Cambiar
              </button>
              <button className="tool" onClick={() => addSet(it.ex)}>
                <Icon name="plus" size={15} /> Serie
              </button>
              <button className="tool danger" onClick={() => confirm('¿Quitar este ejercicio de hoy?') && removeItem(it.id)}>
                <Icon name="x" size={15} /> Quitar
              </button>
            </div>
            <div className="row nob" onClick={() => ex && setDetail(ex)}>
              <Thumb ex={ex} />
              <div className="grow">
                <div>
                  <b>{ex?.name || it.ex}</b>
                </div>
                <div className="muted small">
                  Objetivo: {it.sets}×{it.reps}
                  {it.drop ? ' · drop set' : ''}
                </div>
                {last && (
                  <div className="muted small">
                    Última vez: {last.sets.map((s) => `${s.w || '?'}×${s.r || '?'}`).join(', ')}
                  </div>
                )}
                {sug && (
                  <div className="tip">
                    <Icon name="trend" size={15} /> Sube a {fmtKg(sug.w)} kg: la última vez hiciste {sug.hi}+ reps en todas las series con {fmtKg(sug.from)} kg
                  </div>
                )}
              </div>
            </div>
            {sets.map((s, i) => {
              const ph = phOf(i)
              return (
                <div key={i}>
                  <div className="setrow">
                    <span className="setn">{i + 1}</span>
                    <input
                      className="inp sm"
                      inputMode="decimal"
                      placeholder={ph.w || 'kg'}
                      value={s.w}
                      onChange={(e) => patchSet(it.ex, i, (x) => ({ ...x, w: e.target.value }))}
                    />
                    <span className="x">kg ×</span>
                    <input
                      className="inp sm"
                      inputMode="numeric"
                      placeholder={ph.r || 'reps'}
                      value={s.r}
                      onChange={(e) => patchSet(it.ex, i, (x) => ({ ...x, r: e.target.value }))}
                    />
                    <button
                      className={'chk' + (s.done ? ' on' : '')}
                      onClick={() =>
                        patchSet(it.ex, i, (x) =>
                          x.done
                            ? { ...x, done: false }
                            : {
                                ...x,
                                done: true,
                                w: x.w || ph.w || '',
                                r: x.r || ph.r || '',
                                drops: x.drops.map((dr, j) => ({
                                  w: dr.w || ph.drops?.[j]?.w || '',
                                  r: dr.r || ph.drops?.[j]?.r || '',
                                })),
                              }
                        )
                      }
                    >
                      <Icon name="check" size={18} />
                    </button>
                  </div>
                  {s.drops.map((dr, j) => (
                    <div className="setrow drop" key={j}>
                      <span className="setn">↳</span>
                      <input
                        className="inp sm"
                        inputMode="decimal"
                        placeholder={ph.drops?.[j]?.w || 'kg'}
                        value={dr.w}
                        onChange={(e) =>
                          patchSet(it.ex, i, (x) => ({
                            ...x,
                            drops: x.drops.map((y, k) => (k === j ? { ...y, w: e.target.value } : y)),
                          }))
                        }
                      />
                      <span className="x">kg ×</span>
                      <input
                        className="inp sm"
                        inputMode="numeric"
                        placeholder={ph.drops?.[j]?.r || 'reps'}
                        value={dr.r}
                        onChange={(e) =>
                          patchSet(it.ex, i, (x) => ({
                            ...x,
                            drops: x.drops.map((y, k) => (k === j ? { ...y, r: e.target.value } : y)),
                          }))
                        }
                      />
                      <button
                        className="icon-btn"
                        onClick={() => patchSet(it.ex, i, (x) => ({ ...x, drops: x.drops.filter((_, k) => k !== j) }))}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="link small"
                    onClick={() => patchSet(it.ex, i, (x) => ({ ...x, drops: [...x.drops, { w: '', r: '' }] }))}
                  >
                    + drop (bajar peso)
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
      <button className="btn full" onClick={() => setPicker({ mode: 'add' })}>
        <Icon name="plus" size={18} /> Añadir ejercicio
      </button>
      {picker && (
        <Library
          data={data}
          setData={setData}
          onPick={pickEx}
          onClose={() => setPicker(null)}
          title={picker.mode === 'swap' ? 'Cambiar por…' : 'Añadir ejercicio'}
        />
      )}
      <button className="btn primary full" onClick={finish}>
        Terminar entreno
      </button>
      <button className="btn danger full" onClick={discard}>
        Descartar
      </button>
      {detail && <ExerciseModal ex={detail} data={data} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ---------- Pantalla Entreno ---------- */
export default function Workout({ data, setData, view, setView, onStart, onStartFree }) {
  const [gen, setGen] = useState(false)

  if (view.name === 'session') return <Session data={data} setData={setData} onExit={() => setView({ name: 'list' })} />
  if (view.name === 'edit') return <DayEditor data={data} setData={setData} dayId={view.id} onBack={() => setView({ name: 'list' })} />
  if (view.name === 'library')
    return (
      <div className="page">
        <button className="link" onClick={() => setView({ name: 'list' })}>
          <Icon name="left" size={18} /> Volver
        </button>
        <h1 className="title">Ejercicios</h1>
        <Library data={data} setData={setData} inline />
      </div>
    )

  const today = new Date().getDay()
  const byWeekday = (w) => data.plan.filter((d) => d.weekday === w)
  const setWeekday = (dayId, w) =>
    setData((d) => ({ ...d, plan: d.plan.map((x) => (x.id === dayId ? { ...x, weekday: w } : x)) }))
  const addDay = () => {
    const id = uid()
    setData((d) => ({ ...d, plan: [...d.plan, { id, name: 'Nuevo día', weekday: null, items: [] }] }))
    setView({ name: 'edit', id })
  }
  const generate = (days) => {
    setData((d) => ({ ...d, plan: generatePlan(days), active: null }))
    setGen(false)
  }
  const sorted = [...data.plan].sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7)

  return (
    <div className="page">
      <div className="head">
        <div>
          <div className="eyebrow">Tu rutina</div>
          <h1 className="title">Entreno</h1>
        </div>
        <button className="icon-btn" onClick={() => setView({ name: 'library' })} aria-label="Biblioteca">
          <Icon name="book" size={18} />
        </button>
      </div>

      {data.active && (
        <button className="banner" onClick={() => setView({ name: 'session' })}>
          <span className="pulse" />
          <span className="grow">
            <b>Entreno en curso</b>
            <span className="small"> · {data.active.name || data.plan.find((d) => d.id === data.active.dayId)?.name}</span>
          </span>
          <Icon name="right" size={18} />
        </button>
      )}

      <div className="week">
        {ORDER.map((w) => {
          const ds = byWeekday(w)
          return (
            <div className={'wday' + (w === today ? ' today' : '') + (ds.length ? ' has' : '')} key={w}>
              <span className="wd">{'DLMXJVS'[w]}</span>
              <span className="dot" />
            </div>
          )
        })}
      </div>

      <div className="sec-head">
        <h4>Mis días</h4>
        <span className="muted small">{data.plan.length} días</span>
      </div>
      {data.plan.length === 0 && (
        <div className="empty-state">
          <Icon name="calendar" size={28} />
          <p>No tienes ningún día. Crea uno o genera un plan automático.</p>
        </div>
      )}
      {sorted.map((d) => {
        const cover = EX_BY_ID[d.items[0]?.ex]
        const groups = [...new Set(d.items.map((i) => EX_BY_ID[i.ex]?.group).filter(Boolean))]
        const sets = d.items.reduce((n, i) => n + Number(i.sets || 0), 0)
        return (
          <div className={'daycard' + (d.weekday === today ? ' is-today' : '')} key={d.id}>
            <div className="daycover">
              {cover?.imgs?.[0] ? <img src={cover.imgs[0]} alt="" loading="lazy" /> : <div className="cover-empty" />}
              <div className="daycover-shade" />
              <div className="daycover-txt">
                <span className="daypill">{d.weekday != null ? WEEKDAYS[d.weekday] : 'Sin día'}{d.weekday === today ? ' · Hoy' : ''}</span>
                <h3>{d.name}</h3>
                <span className="small">
                  {d.items.length} ejercicios · {sets} series{groups.length ? ' · ' + groups.join(', ') : ''}
                </span>
              </div>
            </div>
            <div className="dayfoot">
              <select
                className="inp mini-sel"
                value={d.weekday ?? ''}
                onChange={(e) => setWeekday(d.id, e.target.value === '' ? null : Number(e.target.value))}
                aria-label="Día de la semana"
              >
                <option value="">Sin día</option>
                {ORDER.map((w) => (
                  <option key={w} value={w}>
                    {WEEKDAYS[w]}
                  </option>
                ))}
              </select>
              <button className="icon-btn" onClick={() => setView({ name: 'edit', id: d.id })} aria-label="Editar">
                <Icon name="edit" size={17} />
              </button>
              <button className="btn primary sm-btn" onClick={() => onStart(d.id)}>
                <Icon name="play" size={14} fill="currentColor" stroke={0} />
                {data.active?.dayId === d.id ? 'Seguir' : 'Empezar'}
              </button>
            </div>
          </div>
        )
      })}

      <button className="btn full free-btn" onClick={onStartFree}>
        <Icon name="play" size={14} fill="currentColor" stroke={0} /> Entreno libre (a tu aire)
      </button>
      <div className="actions">
        <button className="btn" onClick={addDay}>
          <Icon name="plus" size={18} /> Nuevo día
        </button>
        <button className="btn" onClick={() => setGen(true)}>
          <Icon name="sparkle" size={18} /> Plan automático
        </button>
      </div>
      {gen && <Generator onClose={() => setGen(false)} onGenerate={generate} />}
    </div>
  )
}
