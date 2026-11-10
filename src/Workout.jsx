import { useEffect, useMemo, useState } from 'react'
import { EXERCISES, EX_BY_ID, GROUPS } from './data/exercises'
import { WEEKDAYS, uid, lastSets, exStats, suggestion, fmtKg, num, pad } from './store'
import { Modal, Thumb, LineChart, ExPhoto } from './ui'
import Icon from './icons'
import WeeklyReview from './Review'
import { generatePlan, PLAN_OPTIONS, LEVELS } from './plans'
import Setup from './Setup'
import { FEELINGS, ZONES, adviceFor, painFor, needsDeload } from './coach'
import Coach from './Coach.jsx'

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
// se busca por nombre, grupo y músculo principal (así "glúteo" encuentra también el hip thrust)
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const searchText = (e) => (e._s ??= norm([e.name, e.group, ...(e.main || []), e.equip || ''].join(' ')))
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
  // se enseñan pocos ejercicios a la vez para que la lista vaya fluida; "Ver más" carga el resto
  const PAGE = 12
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [q, group])
  const list = EXERCISES.filter(
    (e) =>
      (group === 'Todos' || e.group === group) && (!q || q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).every((w) => searchText(e).includes(w)))
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
        {list.slice(0, limit).map((e) => (
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
        {list.length > limit && (
          <button className="btn full more-btn" onClick={() => setLimit(limit + 20)}>
            Ver más ({list.length - limit} restantes)
          </button>
        )}
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
export function Generator({ onClose, onGenerate }) {
  const [level, setLevel] = useState('beginner')
  const lv = LEVELS.find((l) => l.id === level)
  const [days, setDays] = useState(lv.days)
  const pickLevel = (l) => {
    setLevel(l.id)
    setDays(l.days)
  }
  return (
    <Modal title="Plan automático" onClose={onClose}>
      <h4 style={{ marginTop: 0 }}>1. Tu nivel</h4>
      <div className="list">
        {LEVELS.map((l) => (
          <button key={l.id} className={'row opt' + (level === l.id ? ' on' : '')} onClick={() => pickLevel(l)}>
            <div className="grow">
              <b>{l.label}</b>
              <div className="muted small">{l.hint}</div>
            </div>
            {level === l.id && <span className="plus"><Icon name="check" size={18} /></span>}
          </button>
        ))}
      </div>
      <div className="tip">
        <Icon name="sparkle" size={15} /> Para tu nivel te recomiendo ir {lv.range} a la semana.
      </div>
      <h4>2. Días por semana</h4>
      <div className="chips wrap">
        {PLAN_OPTIONS.map((o) => (
          <button key={o.days} className={'chip' + (days === o.days ? ' on' : '')} onClick={() => setDays(o.days)}>
            {o.days} días{o.days === lv.days ? ' ★' : ''}
          </button>
        ))}
      </div>
      <p className="muted small">{PLAN_OPTIONS.find((o) => o.days === days)?.hint}</p>
      {level === 'beginner' && days >= 5 && (
        <p className="toast warn small">Siendo principiante, más de 4 días suele ser demasiado: recuperarás peor.</p>
      )}
      <p className="muted small">
        {level === 'beginner'
          ? 'Principiante: 2-3 series por ejercicio, sin fallo ni drop sets.'
          : level === 'advanced'
            ? 'Avanzado: una serie más por ejercicio.'
            : 'Intermedio: 3 series por ejercicio.'}{' '}
        Esto sustituye tu plan actual; luego puedes cambiar lo que quieras.
      </p>
      <button className="btn primary full" onClick={() => onGenerate(days, level)}>
        Crear plan de {days} días
      </button>
    </Modal>
  )
}

/* ---------- Editor de día ---------- */
// Entradas numéricas: peso con decimales (coma o punto) y repeticiones enteras
const kgIn = (v) => v.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1').slice(0, 6)
const repIn = (v) => v.replace(/\D/g, '').slice(0, 3)

// Cambios sin guardar en el editor de día (App lo consulta antes de cambiar de pestaña)
export const editGuard = { dirty: false }

function DayEditor({ data, setData, dayId, isNew, onBack }) {
  const saved = data.plan.find((d) => d.id === dayId)
  // Se edita una copia: nada cambia en tu plan hasta que pulsas Guardar
  const [day, setDay] = useState(() => (saved ? structuredClone(saved) : { id: dayId, name: 'Nuevo día', weekday: null, items: [] }))
  const [picker, setPicker] = useState(false)
  const [ask, setAsk] = useState(false)
  const base = saved || { id: dayId, name: 'Nuevo día', weekday: null, items: [] }
  const dirty = JSON.stringify(day) !== JSON.stringify(base)
  editGuard.dirty = dirty
  useEffect(() => () => {
    editGuard.dirty = false
  }, [])
  if (!saved && !isNew) return null
  const patchDay = (p) => setDay((d) => ({ ...d, ...p }))
  const patchItem = (id, p) => setDay((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const save = () => {
    const fixed = { ...day, items: day.items.map((i) => ({ ...i, sets: Math.max(1, Math.min(50, Number(i.sets) || 1)) })) }
    const uni = Object.fromEntries(fixed.items.filter((i) => i.uni != null).map((i) => [i.ex, i.uni]))
    setData((d) => ({
      ...d,
      uniEx: { ...(d.uniEx || {}), ...uni },
      plan: d.plan.some((x) => x.id === dayId) ? d.plan.map((x) => (x.id === dayId ? fixed : x)) : [...d.plan, fixed],
    }))
    editGuard.dirty = false
    onBack(isNew ? 'Día creado' : 'Cambios guardados')
  }
  const leave = () => (dirty ? setAsk(true) : onBack())
  const discard = () => {
    editGuard.dirty = false
    onBack()
  }
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
    if (!confirm(isNew ? '¿Descartar este día nuevo?' : `¿Borrar el día "${day.name}"?`)) return
    if (!isNew) setData((d) => ({ ...d, plan: d.plan.filter((x) => x.id !== dayId) }))
    discard()
  }
  return (
    <div className={'page' + (dirty ? ' has-savebar' : '')}>
      <button className="link" onClick={leave}>
        <Icon name="left" size={18} /> Volver
      </button>
      <h2>{isNew ? 'Nuevo día' : 'Editar día'}</h2>
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
              <button className="icon-btn" onClick={() => patchDay({ items: day.items.filter((i) => i.id !== it.id) })} aria-label="Quitar">
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
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    // se puede borrar y escribir libremente; se corrige al salir del campo
                    const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                    patchItem(it.id, { sets: v === '' ? '' : Math.min(50, Number(v)) })
                  }}
                  onBlur={() => !(Number(it.sets) >= 1) && patchItem(it.id, { sets: 1 })}
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
            <label className="chk-l uni-l">
              <input
                type="checkbox"
                checked={!!(it.uni ?? data.uniEx?.[it.ex])}
                onChange={(e) => patchItem(it.id, { uni: e.target.checked })}
              />
              Unilateral (reps de cada lado)
            </label>
          </div>
        )
      })}
      <button className="btn full" onClick={() => setPicker(true)}>
        + Añadir ejercicio
      </button>
      <button className="btn danger full" onClick={del}>
        {isNew ? 'Descartar día' : 'Eliminar este día'}
      </button>
      {picker && <Library data={data} setData={setData} onPick={add} onClose={() => setPicker(false)} />}
      {dirty && (
        <div className="savebar">
          <span className="small">Cambios sin guardar</span>
          <button className="btn primary" onClick={save}>
            <Icon name="check" size={16} /> Guardar
          </button>
        </div>
      )}
      {ask && (
        <Modal title="¿Guardar los cambios?" onClose={() => setAsk(false)}>
          <p className="muted">Has cambiado “{day.name}”. Si sales sin guardar, tu plan se queda como estaba.</p>
          <button className="btn primary full" onClick={save}>
            Guardar cambios
          </button>
          <button className="btn full" onClick={() => setAsk(false)}>
            Seguir editando
          </button>
          <button className="btn danger full" onClick={discard}>
            Salir sin guardar
          </button>
        </Modal>
      )}
    </div>
  )
}

/* ---------- Check-in al terminar ---------- */
function CheckIn({ onSave, onSkip, exercises = [] }) {
  const [feel, setFeel] = useState(null)
  const [rir, setRir] = useState({})
  const [hasPain, setHasPain] = useState(false)
  const [zone, setZone] = useState(null)
  const [level, setLevel] = useState('leve')
  const [note, setNote] = useState('')
  return (
    <Modal title="¿Cómo ha ido?" onClose={onSkip}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Con esto ajusto los consejos y te aviso en los próximos entrenos.
      </p>
      <h4>Sensación del entreno</h4>
      <div className="feels">
        {FEELINGS.map((f) => (
          <button key={f.id} className={'feel' + (feel === f.id ? ' on' : '')} onClick={() => setFeel(f.id)}>
            <span className="fe">{f.emoji}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      {exercises.length > 0 && (
        <>
          <h4>¿Cuántas repeticiones más podías hacer?</h4>
          <p className="muted small" style={{ marginTop: -4 }}>
            Piensa en la última serie de cada ejercicio. Con esto te digo cuándo subir peso.
          </p>
          {exercises.map((id) => (
            <div className="rir-row" key={id}>
              <span className="rir-name">{EX_BY_ID[id]?.name || id}</span>
              <div className="seg seg3">
                {[
                  [0, 'Ninguna'],
                  [2, '1-2'],
                  [3, '3 o más'],
                ].map(([v, l]) => (
                  <button key={v} className={rir[id] === v ? 'on' + (v === 0 ? ' warn' : '') : ''} onClick={() => setRir({ ...rir, [id]: v })}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      <h4>¿Alguna molestia o incidente?</h4>
      <div className="seg">
        <button className={!hasPain ? 'on' : ''} onClick={() => setHasPain(false)}>
          No, todo bien
        </button>
        <button className={hasPain ? 'on warn' : ''} onClick={() => setHasPain(true)}>
          Sí
        </button>
      </div>
      {hasPain && (
        <>
          <div className="chips wrap">
            {ZONES.map((z) => (
              <button key={z.id} className={'chip sm' + (zone === z.id ? ' on' : '')} onClick={() => setZone(z.id)}>
                {z.id}
              </button>
            ))}
          </div>
          <div className="seg" style={{ marginTop: 10 }}>
            <button className={level === 'leve' ? 'on' : ''} onClick={() => setLevel('leve')}>
              Leve
            </button>
            <button className={level === 'fuerte' ? 'on warn' : ''} onClick={() => setLevel('fuerte')}>
              Fuerte / punzante
            </button>
          </div>
        </>
      )}
      <h4>Notas (opcional)</h4>
      <textarea
        className="inp"
        rows={2}
        placeholder="Ej: me quedé sin fuerza en el tríceps, dormí poco…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        className="btn primary full"
        disabled={!feel || (hasPain && !zone)}
        onClick={() => onSave({ feel, rir, pain: hasPain && zone ? { zone, level } : null, note: note.trim() })}
      >
        Guardar y ver consejos
      </button>
      <button className="link" onClick={onSkip}>
        Saltar
      </button>
    </Modal>
  )
}

/* ---------- Entreno en curso ---------- */
/* ---------- Descanso entre series ---------- */
const REST_KEY = 'migym.rest'
const restSecs = () => {
  try {
    return Number(localStorage.getItem(REST_KEY)) || 90
  } catch {
    return 90
  }
}
// shortcut: sin sonido (iOS no deja sonar ni vibrar a una PWA sin toque), solo aviso visual; si hace falta, usar un aviso push
function RestTimer({ end, onAdd, onClose }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const left = Math.ceil((end - now) / 1000)
  useEffect(() => {
    if (left === 0) navigator.vibrate?.(300)
    if (left < -8) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])
  return (
    <div className={'restbar' + (left <= 0 ? ' go' : '')} role="timer">
      <span className="rest-t">{left > 0 ? `${Math.floor(left / 60)}:${pad(left % 60)}` : '¡Siguiente serie!'}</span>
      {left > 0 && <span className="muted small grow">descanso</span>}
      {left > 0 && <button onClick={() => onAdd(-15)}>−15 s</button>}
      {left > 0 && <button onClick={() => onAdd(15)}>+15 s</button>}
      <button aria-label="Cerrar descanso" onClick={onClose}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
const lastNote = (sessions, exId) => {
  for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].notes?.[exId]) return sessions[i].notes[exId]
  return null
}
const setsVol = (sets) =>
  sets.reduce((t, s) => t + num(s.w) * num(s.r) + (s.drops || []).reduce((q, x) => q + num(x.w) * num(x.r), 0), 0)
const setsTxt = (sets) => sets.map((s) => `${s.w || '?'}×${s.r || '?'}`).join(', ')

function Session({ data, setData, onExit }) {
  const a = data.active
  const day = a ? data.plan.find((d) => d.id === a.dayId) : null
  const items = a?.items || day?.items || []
  const name = a?.name || day?.name || 'Entreno'
  const [detail, setDetail] = useState(null)
  const [picker, setPicker] = useState(null) // { mode: 'add' } | { mode: 'swap', itemId }
  const [done, setDone] = useState(null) // { prs, changed, items, dayId, name } al terminar
  const [rest, setRest] = useState(null) // hora (ms) a la que acaba el descanso
  const addRest = (d) => {
    try {
      localStorage.setItem(REST_KEY, Math.min(600, Math.max(15, restSecs() + d)))
    } catch {}
    setRest((r) => r + d * 1000)
  }

  const newSets = (n, drop) =>
    Array.from({ length: n }, () => ({ w: '', r: '', done: false, drops: drop ? [{ w: '', r: '' }] : [] }))
  const setActive = (fn) => setData((d) => (d.active ? { ...d, active: fn(d.active) } : d))
  const uniOf = (it) => it.uni ?? !!data.uniEx?.[it.ex]
  const toggleUni = (it) => {
    const v = !uniOf(it)
    setData((d) => ({
      ...d,
      uniEx: { ...(d.uniEx || {}), [it.ex]: v },
      active: d.active ? { ...d.active, items: (d.active.items || day?.items || []).map((i) => (i.id === it.id ? { ...i, uni: v } : i)) } : d.active,
    }))
  }
  const curItems = (act) => act.items || day?.items || []
  const removeItem = (itemId) =>
    setActive((act) => {
      const its = curItems(act)
      const it = its.find((i) => i.id === itemId)
      const entries = { ...act.entries }
      if (it) delete entries[it.ex]
      return { ...act, items: its.filter((i) => i.id !== itemId), entries }
    })
  const removeSet = (exId, idx) =>
    setActive((act) => ({ ...act, entries: { ...act.entries, [exId]: (act.entries[exId] || []).filter((_, k) => k !== idx) } }))
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

  if (done && done.step === 'checkin')
    return (
      <div className="page">
        <CheckIn
          exercises={done.exs || []}
          onSkip={() => setDone({ ...done, step: 'summary', tips: [] })}
          onSave={(ck) => {
            setData((d) => ({ ...d, sessions: d.sessions.map((x) => (x.id === done.sid ? { ...x, checkin: ck } : x)) }))
            setDone({ ...done, step: 'summary', tips: adviceFor(ck, data.sessions, done.entries, done.items) })
          }}
        />
      </div>
    )

  if (done)
    return (
      <div className="page">
        <Modal title="Entreno guardado" onClose={onExit}>
          {done.tips?.length > 0 && (
            <>
              <h4 style={{ marginTop: 0 }}>Para tu próximo entreno</h4>
              {done.tips.map((t, i) => (
                <div key={i} className={'advice ' + t.tone}>
                  {t.text}
                </div>
              ))}
            </>
          )}
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
          {done.cmp?.length > 0 && (
            <>
              <h4>Hoy frente a la última vez</h4>
              {done.cmp.map((c) => (
                <div className="cmp" key={c.name}>
                  <div className="cmp-h">
                    <b>{c.name}</b>
                    {c.d != null && <span className={c.d >= 0 ? 'up' : 'down'}>{c.d > 0 ? '+' : ''}{c.d} %</span>}
                  </div>
                  <div className="muted small">Hoy: {c.now}</div>
                  <div className="muted small">{c.prev ? `Antes: ${c.prev}` : 'Primera vez que lo registras'}</div>
                </div>
              ))}
              <p className="muted small">El % compara el volumen (kg × reps de todas las series) con el de la última vez.</p>
            </>
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
    setData((d) =>
      d.active
        ? {
            ...d,
            active: {
              ...d.active,
              entries: { ...d.active.entries, [exId]: d.active.entries[exId].map((s, i) => (i === si ? fn(s) : s)) },
            },
          }
        : d
    )

  const finish = () => {
    const sid = uid()
    const entries = {}
    for (const [k, sets] of Object.entries(a.entries)) {
      const uni = uniOf(items.find((i) => i.ex === k) || { ex: k })
      const kept = sets
        .filter((s) => s.done || s.w || s.r || s.r2 || s.drops.some((x) => x.w || x.r))
        .map((s) => {
          const base = { w: s.w, r: s.r, drops: s.drops.filter((x) => x.w || x.r) }
          if (!uni || !(s.r || s.r2)) return base
          // unilateral: cuenta el lado más flojo para progresar; se guardan los dos
          const l = num(s.r), rr = num(s.r2)
          const weak = l && rr ? Math.min(l, rr) : l || rr
          return { ...base, r: String(weak), rl: s.r, rr: s.r2 }
        })
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
    // comparación con la última vez de cada ejercicio (data.sessions aún no incluye el de hoy)
    const cmp = Object.entries(entries).map(([exId, sets]) => {
      const prev = lastSets(data.sessions, exId)
      const pv = prev ? setsVol(prev.sets) : 0
      return { name: EX_BY_ID[exId]?.name || exId, now: setsTxt(sets), prev: prev && setsTxt(prev.sets), d: pv > 0 ? Math.round((setsVol(sets) / pv - 1) * 100) : null }
    })
    const notes = {}
    for (const [k, v] of Object.entries(a.notes || {})) if (entries[k] && v.trim()) notes[k] = v.trim()
    setRest(null)
    setData((d) => ({
      ...d,
      active: null,
      sessions: [...d.sessions, { id: sid, date: a.date, dayId: a.dayId, dayName: name, entries, ...(Object.keys(notes).length ? { notes } : {}) }],
    }))
    const before = (day?.items || []).map((i) => i.ex).join('|')
    const after = items.map((i) => i.ex).join('|')
    const changed = items.length > 0 && (a.dayId === 'free' || (day && before !== after))
    setDone({ prs, cmp, changed, items, dayId: a.dayId, name, sid, step: 'checkin', exs: Object.keys(entries), entries })
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
      {needsDeload(data.sessions) && (
        <div className="advice yellow">
          Tus últimos entrenos fueron muy duros. Hoy te propongo descarga: un 30% menos de peso y sin llegar al fallo.
        </div>
      )}
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
        const uni = uniOf(it)
        const imb = (() => {
          if (!last) return null
          let d = 0
          for (const x of last.sets) if (x.rl && x.rr) d += num(x.rl) - num(x.rr)
          return d <= -2 ? 'izquierdo' : d >= 2 ? 'derecho' : null
        })()
        const pain = painFor(data.sessions, it.ex)
        const s0 = pain ? null : suggestion(data.sessions, it.ex, it.reps, it.sets, ex?.equip)
        const sug = s0?.action === 'up' ? s0 : null
        const hold = s0?.action === 'hold' ? s0 : null
        // referencia: solo el PESO de la última vez. Las reps de hoy empiezan vacías y nunca se copian.
        const phOf = (i) => {
          const b0 = last?.sets[i] || last?.sets[last.sets.length - 1] || {}
          return { w: b0.w, drops: (b0.drops || []).map((x) => ({ w: x.w })) }
        }
        const note = lastNote(data.sessions, it.ex)
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
                    Última vez: {last.sets.map((s) => `${s.w || '?'}×${s.rl || s.rr ? `${s.rl || '?'}/${s.rr || '?'}` : s.r || '?'}`).join(', ')}
                  </div>
                )}
                {note && <div className="muted small">Nota anterior: {note}</div>}
                {pain && (
                  <div className={'advice ' + (pain.level === 'fuerte' ? 'red' : 'yellow') + ' sm'}>
                    Molestia {pain.level} en {pain.zone.toLowerCase()} el {pain.date.slice(8)}/{pain.date.slice(5, 7)}.{' '}
                    {pain.level === 'fuerte' ? 'Mejor cámbialo por otro o sáltalo hoy.' : 'Baja el peso y no llegues al fallo.'}
                  </div>
                )}
                {hold && (
                  <div className="tip hold">
                    <Icon name="check" size={15} /> Mantén {fmtKg(hold.from)} kg: {hold.why}
                  </div>
                )}
                {sug && (
                  <div className="tip">
                    <Icon name="trend" size={15} /> Sube a {fmtKg(sug.w)} kg: {sug.why}
                  </div>
                )}
                {uni && imb && (
                  <div className="tip hold">
                    <Icon name="swap" size={15} /> El lado {imb} va por detrás: empieza por él y con el otro haz las mismas reps, no más.
                  </div>
                )}
              </div>
            </div>
            <button className={'uni-tg' + (uni ? ' on' : '')} onClick={() => toggleUni(it)}>
              <span className="uni-dot" /> {uni ? 'Por lados: izquierdo / derecho' : 'Unilateral (un lado y luego otro)'}
            </button>
            {uni && sets.length > 0 && (
              <div className="setrow uni-head">
                <span className="setn" />
                <span className="uh">kg</span>
                <span className="x" style={{ visibility: 'hidden' }}>kg</span>
                <span className="uh">Izq</span>
                <span className="uh">Der</span>
                <span className="chk-sp" />
              </div>
            )}
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
                      onChange={(e) => patchSet(it.ex, i, (x) => ({ ...x, w: kgIn(e.target.value) }))}
                    />
                    <span className="x">{uni ? 'kg' : 'kg ×'}</span>
                    <input
                      className="inp sm"
                      inputMode="numeric"
                      aria-label={uni ? 'Reps izquierdo' : 'Reps'}
                      placeholder={uni ? 'izq' : 'reps'}
                      value={s.r}
                      onChange={(e) => patchSet(it.ex, i, (x) => ({ ...x, r: repIn(e.target.value) }))}
                    />
                    {uni && (
                      <input
                        className="inp sm"
                        inputMode="numeric"
                        aria-label="Reps derecho"
                        placeholder="der"
                        value={s.r2 || ''}
                        onChange={(e) => patchSet(it.ex, i, (x) => ({ ...x, r2: repIn(e.target.value) }))}
                      />
                    )}
                    <button
                      className={'chk' + (s.done ? ' on' : '')}
                      aria-label={s.done ? 'Desmarcar serie' : 'Serie hecha'}
                      onClick={(e) => {
                        // sin reps de hoy no se da por hecha: te lleva al campo en vez de inventarlas
                        if (!s.done && !(s.r || (uni && s.r2)))
                          return e.currentTarget.parentElement.querySelector('input[aria-label^="Reps"]')?.focus()
                        if (!s.done) setRest(Date.now() + restSecs() * 1000)
                        patchSet(it.ex, i, (x) =>
                          x.done
                            ? { ...x, done: false }
                            : {
                                ...x,
                                done: true,
                                w: x.w || ph.w || '',
                                drops: x.drops.map((dr, j) => ({ ...dr, w: dr.w || (dr.r && ph.drops?.[j]?.w) || '' })),
                              }
                        )
                      }}
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
                            drops: x.drops.map((y, k) => (k === j ? { ...y, w: kgIn(e.target.value) } : y)),
                          }))
                        }
                      />
                      <span className="x">kg ×</span>
                      <input
                        className="inp sm"
                        inputMode="numeric"
                        placeholder="reps"
                        value={dr.r}
                        onChange={(e) =>
                          patchSet(it.ex, i, (x) => ({
                            ...x,
                            drops: x.drops.map((y, k) => (k === j ? { ...y, r: repIn(e.target.value) } : y)),
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
                  <div className="set-links">
                    <button
                      className="link small"
                      onClick={() => patchSet(it.ex, i, (x) => ({ ...x, drops: [...x.drops, { w: '', r: '' }] }))}
                    >
                      + drop (bajar peso)
                    </button>
                    {sets.length > 1 && (
                      <button className="link small danger-link" onClick={() => removeSet(it.ex, i)}>
                        Quitar serie
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            <input
              className="inp note"
              aria-label="Nota del ejercicio"
              placeholder="Nota: agarre, asiento, sensaciones…"
              maxLength={200}
              value={a.notes?.[it.ex] || ''}
              onChange={(e) => setActive((act) => ({ ...act, notes: { ...(act.notes || {}), [it.ex]: e.target.value } }))}
            />
          </div>
        )
      })}
      {rest && <RestTimer end={rest} onAdd={addRest} onClose={() => setRest(null)} />}
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
  const [setup, setSetup] = useState(false)
  const [coach, setCoach] = useState(false)
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash])

  if (view.name === 'session') return <Session data={data} setData={setData} onExit={() => setView({ name: 'list' })} />
  if (view.name === 'edit')
    return (
      <DayEditor
        key={view.id}
        data={data}
        setData={setData}
        dayId={view.id}
        isNew={!!view.isNew}
        onBack={(msg) => {
          setView({ name: 'list' })
          if (msg) setFlash(msg)
        }}
      />
    )
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
    setView({ name: 'edit', id: uid(), isNew: true })
  }
  const generate = (days, level) => {
    setData((d) => ({ ...d, plan: generatePlan(days, level), active: null, setupDone: true }))
    setGen(false)
  }
  const sorted = [...data.plan].sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7)

  return (
    <div className="page">
      {flash && <div className="notice">{flash}</div>}
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

      <WeeklyReview data={data} setData={setData} />

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
            <div className={'daycover' + (cover?.imgs?.[0] ? '' : ' empty')}>
              {cover?.imgs?.[0] ? (
                <img src={cover.imgs[0]} alt="" loading="lazy" />
              ) : (
                <div className="cover-empty">
                  <Icon name="dumbbell" size={64} stroke={1.5} />
                </div>
              )}
              <div className="daycover-shade" />
              <div className="daycover-txt">
                <span className="daypill">{d.weekday != null ? WEEKDAYS[d.weekday] : 'Sin día'}{d.weekday === today ? ' · Hoy' : ''}</span>
                <h3>{d.name}</h3>
                <span className="small">
                  {d.items.length
                    ? `${d.items.length} ejercicios · ${sets} series${groups.length ? ' · ' + groups.join(', ') : ''}`
                    : 'Sin ejercicios: añádelos al empezar o en editar'}
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

      <div className="sec-head">
        <h4>Herramientas</h4>
      </div>
      <div className="tiles">
        <button className="tile2 accent" onClick={onStartFree}>
          <span className="tile2-ic"><Icon name="play" size={18} fill="currentColor" stroke={0} /></span>
          <span className="tile2-t">Entreno libre</span>
          <span className="tile2-s">Sin plan, a tu aire</span>
        </button>
        <button className="tile2 accent" onClick={() => setCoach(true)}>
          <span className="tile2-ic"><Icon name="sparkle" size={18} /></span>
          <span className="tile2-t">Mejorar con IA</span>
          <span className="tile2-s">Ajusta tu rutina</span>
        </button>
        <button className="tile2" onClick={() => setSetup(true)}>
          <span className="tile2-ic"><Icon name="calendar" size={18} /></span>
          <span className="tile2-t">Configurar</span>
          <span className="tile2-s">Días y ejercicios</span>
        </button>
        <button className="tile2" onClick={() => setGen(true)}>
          <span className="tile2-ic"><Icon name="trend" size={18} /></span>
          <span className="tile2-t">Plan automático</span>
          <span className="tile2-s">Según tu nivel</span>
        </button>
        <button className="tile2" onClick={addDay}>
          <span className="tile2-ic"><Icon name="plus" size={18} /></span>
          <span className="tile2-t">Nuevo día</span>
          <span className="tile2-s">Crear uno vacío</span>
        </button>
        <button className="tile2" onClick={() => setView({ name: 'library' })}>
          <span className="tile2-ic"><Icon name="book" size={18} /></span>
          <span className="tile2-t">Ejercicios</span>
          <span className="tile2-s">Fotos y progreso</span>
        </button>
      </div>
      {gen && <Generator onClose={() => setGen(false)} onGenerate={generate} />}
      {setup && <Setup data={data} setData={setData} onClose={() => setSetup(false)} />}
      {coach && <Coach data={data} setData={setData} onClose={() => setCoach(false)} />}
    </div>
  )
}
