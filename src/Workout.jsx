import { useEffect, useMemo, useState } from 'react'
import { EXERCISES, EX_BY_ID, GROUPS } from './data/exercises'
import { WEEKDAYS, addDays, uid, lastSets, prefillSets, exStats, suggestion, fmtKg, num, pad, TRACKS, trackOf, setFilled, setTxt, todayStr } from './store'
import { Modal, Thumb, LineChart, ExPhoto } from './ui'
import { techFor } from './data/technique'
import { nightsOf, progressRead } from './stats'
import Icon from './icons'
import WeeklyReview, { CoachChat } from './Review'
import { LEVELS, EQUIP, MINUTES, DAY_TYPES, SPLITS, GOALS, DEFAULT_WEEKDAYS, splitFor, typesFor, pickFor, prescribe, buildDay, buildPlan, stripSlots, analyzePlan } from './plans'
import Setup from './Setup'
import { PlanVolume } from './Extras'
import { FEELINGS, ZONES, adviceFor, painFor, needsDeload, recentPains, zoneHits } from './coach'
import { groupsOf } from './ranks'
import Coach from './Coach.jsx'
import { DayModal, doneSessions, fmtDay } from './DayDetail'
import { State, SyncPill, Badge, fmtMin } from './ds'

const ORDER = [1, 2, 3, 4, 5, 6, 0] // lunes primero

/* ---------- Modal de ejercicio ---------- */
export function ExerciseModal({ ex, data, setData, onClose, onPick, pickLabel, onDelete }) {
  const fav = (data.favEx || []).includes(ex.id)
  const toggleFav = () =>
    setData((d) => ({ ...d, favEx: fav ? (d.favEx || []).filter((x) => x !== ex.id) : [...(d.favEx || []), ex.id] }))
  const stats = useMemo(() => exStats(data.sessions, ex.id), [data.sessions, ex.id])
  const [metric, setMetric] = useState('e1rm')
  const [allHist, setAllHist] = useState(false)
  const bestAll = stats.reduce((m, x) => (!m || x.best.e > m.e ? x.best : m), null)
  const bestReps = stats.reduce((m, x) => (!m || x.best.r > m.r || (x.best.r === m.r && x.best.w > m.w) ? x.best : m), null)
  const read = useMemo(() => progressRead(stats), [stats])
  const history = useMemo(() => {
    const out = []
    for (let i = data.sessions.length - 1; i >= 0 && out.length < (allHist ? 200 : 5); i--) {
      const sets = data.sessions[i].entries?.[ex.id]
      if (sets) out.push({ date: data.sessions[i].date, sets })
    }
    return out
  }, [data.sessions, ex.id, allHist])
  const nHist = useMemo(() => data.sessions.filter((s) => s.entries?.[ex.id]).length, [data.sessions, ex.id])
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
        {ex.kind && <span className="tag eq">{ex.kind}</span>}
        {setData && (
          <button className={'tag fav' + (fav ? ' on' : '')} onClick={toggleFav} aria-pressed={fav}>
            {fav ? '★ Favorito' : '☆ Favorito'}
          </button>
        )}
      </div>
      {!ex.custom && (
        <p className="tech small">
          <b>Técnica:</b> {techFor(ex)}
        </p>
      )}
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
            {bestReps && bestReps.r !== bestAll.r ? ` · más reps: ${bestReps.r} con ${fmtKg(bestReps.w)} kg` : ''}
          </p>
          <p className="prog-read">
            <span className={'prog-kind ' + read.kind}>{{ weight: 'Progresas en peso', reps: 'Progresas en repeticiones', volume: 'Más volumen', flat: 'Estable', down: 'Por debajo', few: 'Pocos datos' }[read.kind]}.</span> {read.text}
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
      {history.map((h, hi) => (
        <div key={h.date + hi} className="hist">
          <b>{h.date}</b>
          <div>
            {h.sets.map((s, i) => (
              <span key={i} className="pill">
                {s.s || s.m || s.km || s.min ? setTxt(s) : `${s.w || '?'}kg×${s.r || '?'}`}
                {s.drops?.length ? ' ↓' + s.drops.map((d) => `${d.w || '?'}×${d.r || '?'}`).join('↓') : ''}
              </span>
            ))}
          </div>
        </div>
      ))}
      {!allHist && nHist > 5 && (
        <button className="link small" onClick={() => setAllHist(true)}>
          Ver las {nHist} sesiones
        </button>
      )}
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
  const [track, setTrack] = useState('reps')
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
      <label className="lbl">Cómo se mide</label>
      <select className="inp" value={track} onChange={(e) => setTrack(e.target.value)}>
        {Object.entries(TRACKS).map(([id, t]) => (
          <option key={id} value={id}>
            {t.label}
          </option>
        ))}
      </select>
      <button className="btn primary full" disabled={!name.trim()} onClick={() => onCreate(name.trim(), group, track)}>
        Crear
      </button>
    </Modal>
  )
}

export function Library({ data, setData, onPick, onClose, inline, title, noCreate, pickLabel }) {
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('Todos')
  const [open, setOpen] = useState(null)
  const [equipF, setEquipF] = useState('Todo')
  const [sort, setSort] = useState('rel') // rel (favoritos y usados primero) | az | used
  const [more, setMore] = useState(false)
  // se enseñan pocos ejercicios a la vez para que la lista vaya fluida; "Ver más" carga el resto
  const PAGE = 12
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [q, group, equipF, sort])
  const favs = data.favEx || []
  // veces que has hecho cada ejercicio (para ordenar por uso)
  const used = useMemo(() => {
    const m = {}
    for (const s of data.sessions || []) for (const id of Object.keys(s.entries || {})) m[id] = (m[id] || 0) + 1
    return m
  }, [data.sessions])
  const EQ = ['Todo', 'Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal', 'Otro']
  const list = EXERCISES.filter(
    (e) =>
      (group === 'Todos' || (group === '★' ? favs.includes(e.id) : e.group === group)) &&
      (equipF === 'Todo' || e.equip === equipF || (equipF === 'Barra' && e.equip === 'Barra Z') || (equipF === 'Otro' && !['Barra', 'Barra Z', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal'].includes(e.equip))) &&
      (!q || q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean).every((w) => searchText(e).includes(w)))
  )
  const cmp = (a, b) => a.name.localeCompare(b.name, 'es')
  if (sort === 'az') list.sort(cmp)
  else if (sort === 'used') list.sort((a, b) => (used[b.id] || 0) - (used[a.id] || 0) || cmp(a, b))
  else list.sort((a, b) => favs.includes(b.id) - favs.includes(a.id) || (used[b.id] ? 1 : 0) - (used[a.id] ? 1 : 0))
  const body = (
    <>
      <div className="lib-search">
        <input className="inp" placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
        <button className={'icon-btn' + (more || equipF !== 'Todo' || sort !== 'rel' ? ' on' : '')} onClick={() => setMore((v) => !v)} aria-label="Filtros y orden" aria-expanded={more}>
          <Icon name="list" size={18} />
        </button>
      </div>
      <div className="chips">
        {['Todos', ...(favs.length ? ['★'] : []), ...GROUPS, 'Cardio', 'Estiramientos'].map((g) => (
          <button key={g} className={'chip' + (g === group ? ' on' : '')} onClick={() => setGroup(g)}>
            {g === '★' ? '★ Favoritos' : g}
          </button>
        ))}
      </div>
      {more && (
        <div className="lib-filters">
          <div className="chips wrap">
            {EQ.map((e) => (
              <button key={e} className={'chip sm' + (equipF === e ? ' on' : '')} onClick={() => setEquipF(e)}>
                {e}
              </button>
            ))}
          </div>
          <div className="seg seg3">
            {[['rel', 'Relevancia'], ['used', 'Más hechos'], ['az', 'A–Z']].map(([v, l]) => (
              <button key={v} className={sort === v ? 'on' : ''} onClick={() => setSort(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="muted small" style={{ margin: '0 0 6px' }}>{list.length} {list.length === 1 ? 'ejercicio' : 'ejercicios'}</p>
      <div className="list">
        {list.slice(0, limit).map((e) => (
          <button key={e.id} className="row" onClick={() => setOpen(e)}>
            <Thumb ex={e} />
            <div className="grow">
              <div>
                {favs.includes(e.id) && <span className="gold">★ </span>}
                {e.name}
              </div>
              <div className="muted small">
                {e.main?.length ? e.main.join(', ') : e.group} · {e.equip}
                {used[e.id] ? ` · ${used[e.id]}×` : ''}
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
      {!noCreate && (
        <button className="btn full" onClick={() => setCreating(true)}>
          + Crear ejercicio propio
        </button>
      )}
      {creating && (
        <CreateExercise
          onClose={() => setCreating(false)}
          onCreate={(name, grp, track) => {
            setData((d) => ({ ...d, myExercises: [...(d.myExercises || []), { id: 'c-' + uid(), name, group: grp, ...(track !== 'reps' ? { track } : {}) }] }))
            setCreating(false)
          }}
        />
      )}
      {open && (
        <ExerciseModal
          ex={open}
          data={data}
          setData={setData}
          onClose={() => setOpen(null)}
          onPick={onPick ? () => (onPick(open), setOpen(null)) : null}
          pickLabel={pickLabel}
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

/* ---------- Generador de plan (paso a paso) ---------- */
const FOCUS = ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core']
const restTxt = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s} s`)

// Sustituye el plan con días fijos; conserva los días sin día fijo y no toca el historial
export function Generator({ data, setData, onClose }) {
  const guess = data.sessions.length < 12 ? 'beginner' : data.sessions.length < 60 ? 'intermediate' : 'advanced'
  // preferencias permanentes del generador (nivel, objetivo, material, exclusiones) guardadas en data.prefs.gen
  const pref = data.prefs?.gen || {}
  const [step, setStep] = useState(0) // 0 nivel+objetivo, 1 días, 2 reparto, 3 material/preferencias, 4 resultado
  const [level, setLevel] = useState(pref.level || guess)
  const [goal, setGoal] = useState(pref.goal || 'hyper')
  const [wds, setWds] = useState(() => {
    const cur = [...new Set(data.plan.filter((d) => d.weekday != null).map((d) => d.weekday))]
    return cur.length ? cur : DEFAULT_WEEKDAYS[LEVELS.find((l) => l.id === pref.level || l.id === guess).days]
  })
  const [n, setN] = useState(pref.n || 6)
  const [types, setTypes] = useState({}) // día de la semana -> tipo elegido a mano
  const [equip, setEquip] = useState(pref.equip || EQUIP)
  const [focus, setFocus] = useState(pref.focus || null)
  const [exclude, setExclude] = useState(pref.exclude || []) // ids que no quiere
  const [zones, setZones] = useState(pref.zones || []) // molestias/limitaciones elegidas
  const [picker, setPicker] = useState(false)
  const [plan, setPlan] = useState(null)
  const lv = LEVELS.find((l) => l.id === level)
  const days = ORDER.filter((w) => wds.includes(w))
  const auto = typesFor(splitFor(days.length), days.length)
  const dayList = days.map((w, i) => ({ weekday: w, type: types[w] || auto[i] }))
  const minutes = MINUTES.find((m) => m.n === n)?.min || 60
  // molestias recientes del check-in: se evitan solas (y se enseñan)
  const pains = [...new Set(recentPains(data.sessions).map((p) => p.zone))]
  const allZones = [...new Set([...zones, ...pains])]
  const zoneExclude = allZones.length ? EXERCISES.filter((x) => allZones.some((z) => zoneHits(z, x.id))).map((x) => x.id) : []
  const prefer = data.favEx || []
  const opts = { level, n, equip, focus, goal, exclude: [...exclude, ...zoneExclude], prefer }
  const usedIn = (p) => new Set(p.flatMap((d) => d.items.map((i) => i.ex)))
  const analysis = plan ? analyzePlan(plan, { minutes }, groupsOf) : null

  const make = (list = dayList) => {
    setPlan(buildPlan({ days: list, ...opts }))
    setStep(4)
  }
  const applySplit = (s) => {
    const t = typesFor(s, days.length)
    setTypes(Object.fromEntries(days.map((w, i) => [w, t[i]])))
    return days.map((w, i) => ({ weekday: w, type: t[i] }))
  }
  const surprise = () => {
    const ok = SPLITS.filter((s) => s.cycle.length <= Math.max(1, days.length))
    make(applySplit(ok[Math.floor(Math.random() * ok.length)]))
  }
  const toggleWd = (w) => setWds((s) => (s.includes(w) ? s.filter((x) => x !== w) : [...s, w]))
  const regenDay = (id) =>
    setPlan((p) => p.map((d) => (d.id === id ? { ...d, items: buildDay(d.type, opts, usedIn(p)) } : d)))
  const swap = (dayId, itemId) =>
    setPlan((p) => {
      const used = usedIn(p)
      return p.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              items: d.items.map((i) => {
                if (i.id !== itemId) return i
                const x = pickFor(i.slot, { ...opts, used, avoid: d.items.map((o) => o.ex) })
                return x ? { ...i, ex: x.id, ...prescribe(x, level, focus, goal) } : i
              }),
            },
      )
    })
  const patchItem = (dayId, itemId, p) => setPlan((pl) => pl.map((d) => (d.id !== dayId ? d : { ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, ...p } : i)) })))
  const dropItem = (dayId, itemId) => setPlan((pl) => pl.map((d) => (d.id !== dayId ? d : { ...d, items: d.items.filter((i) => i.id !== itemId) })))
  const save = () => {
    setData((d) => ({
      ...d,
      plan: [...stripSlots(plan), ...d.plan.filter((x) => x.weekday == null)],
      setupDone: true,
      prefs: { ...(d.prefs || {}), gen: { level, goal, n, equip, focus, exclude, zones } },
    }))
    onClose(true)
  }
  const nav = (back, next, label = 'Siguiente', disabled = false) => (
    <div className="wizard-nav">
      {back != null && (
        <button className="btn" onClick={() => setStep(back)}>
          <Icon name="left" size={16} /> Atrás
        </button>
      )}
      <button className="btn primary" disabled={disabled} onClick={next}>
        {label} <Icon name="right" size={16} />
      </button>
    </div>
  )

  return (
    <Modal title="Generar rutina" onClose={() => onClose(false)}>
      <div className="steps">
        {[0, 1, 2, 3, 4].map((s) => (
          <span key={s} className={'stepdot' + (s === step ? ' on' : s < step ? ' done' : '')} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h4 style={{ marginTop: 0 }}>¿Qué buscas?</h4>
          <div className="list">
            {GOALS.map((g) => (
              <button key={g.id} className={'row opt' + (goal === g.id ? ' on' : '')} onClick={() => setGoal(g.id)}>
                <div className="grow">
                  <b>{g.label}</b>
                  <div className="muted small">{g.hint}</div>
                </div>
                {goal === g.id && <span className="plus"><Icon name="check" size={18} /></span>}
              </button>
            ))}
          </div>
          <h4>¿Cuál es tu nivel?</h4>
          <div className="list">
            {LEVELS.map((l) => (
              <button key={l.id} className={'row opt' + (level === l.id ? ' on' : '')} onClick={() => setLevel(l.id)}>
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
          {nav(null, () => setStep(1))}
          <button className="btn full" onClick={surprise} disabled={!days.length}>
            <Icon name="sparkle" size={16} /> Sorpréndeme, decide por mí
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <h4 style={{ marginTop: 0 }}>¿Qué días vas al gimnasio?</h4>
          <div className="chips wrap">
            {ORDER.map((w) => (
              <button key={w} className={'chip' + (wds.includes(w) ? ' on' : '')} onClick={() => toggleWd(w)}>
                {WEEKDAYS[w].slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="muted small">
            {days.length} {days.length === 1 ? 'día' : 'días'} a la semana · recomendado: {lv.range}. Puede ser una semana desigual (p. ej. lunes, martes y viernes).
          </p>
          {level === 'beginner' && days.length >= 5 && (
            <p className="toast warn small">Siendo principiante, más de 4 días suele ser demasiado: recuperarás peor.</p>
          )}
          {days.length === 7 && <p className="toast warn small">Sin ningún día de descanso: el séptimo será suave (core).</p>}
          <h4>¿Cuánto tiempo tienes por entreno?</h4>
          <div className="chips wrap">
            {MINUTES.map((m) => (
              <button key={m.min} className={'chip' + (n === m.n ? ' on' : '')} onClick={() => setN(m.n)}>
                {m.min} min
              </button>
            ))}
          </div>
          <p className="muted small">Unos {level === 'beginner' ? Math.min(n, 5) : n} ejercicios por día.</p>
          {nav(0, () => setStep(2), 'Siguiente', !days.length)}
        </>
      )}

      {step === 2 && (
        <>
          <h4 style={{ marginTop: 0 }}>¿Cómo repartes los músculos?</h4>
          <div className="chips wrap">
            {SPLITS.map((s) => (
              <button key={s.id} className="chip sm" onClick={() => applySplit(s)}>
                {s.label}
                {s === splitFor(days.length) ? ' ★' : ''}
              </button>
            ))}
          </div>
          <p className="muted small">Toca un reparto o decide tú qué toca cada día: nadie te obliga a dos días de pierna.</p>
          {dayList.map((d) => (
            <div key={d.weekday} className="sum-row">
              <b>{WEEKDAYS[d.weekday]}</b>
              <select
                className="inp"
                style={{ width: 'auto', margin: 0 }}
                aria-label={`Qué entrenas el ${WEEKDAYS[d.weekday]}`}
                value={d.type}
                onChange={(e) => setTypes((t) => ({ ...t, [d.weekday]: e.target.value }))}
              >
                {Object.entries(DAY_TYPES).map(([id, t]) => (
                  <option key={id} value={id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {nav(1, () => setStep(3))}
        </>
      )}

      {step === 3 && (
        <>
          <h4 style={{ marginTop: 0 }}>¿Qué material tienes?</h4>
          <div className="chips wrap">
            {EQUIP.map((e) => (
              <button
                key={e}
                className={'chip' + (equip.includes(e) ? ' on' : '')}
                onClick={() => setEquip((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]))}
              >
                {e}
              </button>
            ))}
          </div>
          <h4>¿Quieres priorizar algún músculo?</h4>
          <div className="chips wrap">
            <button className={'chip' + (!focus ? ' on' : '')} onClick={() => setFocus(null)}>
              Ninguno
            </button>
            {FOCUS.map((g) => (
              <button key={g} className={'chip' + (focus === g ? ' on' : '')} onClick={() => setFocus(g)}>
                {g}
              </button>
            ))}
          </div>
          {focus && <p className="muted small">{focus}: una serie más en cada ejercicio.</p>}
          <h4>Molestias o limitaciones</h4>
          <div className="chips wrap">
            {ZONES.filter((z) => z.id !== 'Otra').map((z) => {
              const on = zones.includes(z.id)
              const auto = pains.includes(z.id)
              return (
                <button key={z.id} className={'chip sm' + (on || auto ? ' on' : '')} onClick={() => setZones((s) => (on ? s.filter((x) => x !== z.id) : [...s, z.id]))}>
                  {z.id}
                  {auto ? ' ·' : ''}
                </button>
              )
            })}
          </div>
          <p className="muted small">
            {pains.length ? `Por tus check-ins recientes evitaré lo que carga: ${pains.join(', ')}. ` : ''}
            Se evitan los ejercicios que cargan esas zonas.
          </p>
          <h4>Ejercicios que no quieres</h4>
          <div className="chips wrap">
            {exclude.map((id) => (
              <button key={id} className="chip sm on" onClick={() => setExclude((s) => s.filter((x) => x !== id))} aria-label={`Quitar exclusión de ${EX_BY_ID[id]?.name || id}`}>
                {EX_BY_ID[id]?.name || id} ×
              </button>
            ))}
            <button className="chip sm" onClick={() => setPicker(true)}>
              + Añadir
            </button>
          </div>
          {prefer.length > 0 && <p className="muted small">Tus {prefer.length} favoritos tienen prioridad al elegir.</p>}
          {picker && <Library data={data} setData={setData} noCreate title="Ejercicio a evitar" pickLabel="Evitar este ejercicio" onPick={(x) => (setExclude((s) => (s.includes(x.id) ? s : [...s, x.id])), setPicker(false))} onClose={() => setPicker(false)} />}
          {nav(2, () => make(), 'Crear rutina')}
        </>
      )}

      {step === 4 && plan && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            Revisa y ajusta antes de guardar: cambia ejercicios <Icon name="swap" size={13} className="inl" />, series (− / +), quita o rehaz un día. RIR = reps que te quedan en reserva.
          </p>
          {plan.map((d) => {
            const an = analysis?.days.find((x) => x.id === d.id)
            return (
              <div key={d.id} className="card" style={{ padding: 12 }}>
                <div className="sec-head nm">
                  <b>
                    {WEEKDAYS[d.weekday]} · {d.name}
                  </b>
                  <span className="muted small">{an ? `~${an.minutes} min · ${an.sets} series` : ''}</span>
                </div>
                {d.items.map((i) => {
                  const ex = EX_BY_ID[i.ex]
                  return (
                    <div key={i.id} className="row nob gen-item">
                      <Thumb ex={ex} size={40} />
                      <div className="grow">
                        <div>{ex?.name}</div>
                        <div className="muted small">
                          {i.sets}×{i.reps} · RIR {i.rir} · descanso {restTxt(i.rest)}
                        </div>
                      </div>
                      <div className="gen-ctl">
                        <button className="icon-btn ghost" aria-label="Una serie menos" disabled={i.sets <= 1} onClick={() => patchItem(d.id, i.id, { sets: i.sets - 1 })}>−</button>
                        <button className="icon-btn ghost" aria-label="Una serie más" disabled={i.sets >= 8} onClick={() => patchItem(d.id, i.id, { sets: i.sets + 1 })}>+</button>
                        <button className="icon-btn ghost" aria-label={`Cambiar ${ex?.name}`} onClick={() => swap(d.id, i.id)}>
                          <Icon name="swap" size={17} />
                        </button>
                        <button className="icon-btn ghost" aria-label={`Quitar ${ex?.name}`} onClick={() => dropItem(d.id, i.id)}>
                          <Icon name="x" size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
                <button className="link small" onClick={() => regenDay(d.id)}>
                  Rehacer este día
                </button>
              </div>
            )
          })}
          {analysis && (
            <div className="card">
              <div className="sec-head nm">
                <b>Análisis de la semana</b>
                <span className="muted small">{analysis.total.sets} series · ~{analysis.total.minutes} min</span>
              </div>
              <div className="gen-freq">
                {Object.entries(analysis.groups)
                  .filter(([g]) => g !== 'Antebrazo')
                  .map(([g, v]) => (
                    <span key={g} className="badge">
                      {g}: {v.eff} series · {v.freq}×/sem
                    </span>
                  ))}
              </div>
              <p className="muted small">Series efectivas = directas + la mitad de las que tocan el músculo de rebote (p. ej. el press suma a tríceps). Supuesto habitual: 10-20 por músculo y semana; no es una regla fija.</p>
              {analysis.warnings.map((w, i) => (
                <div key={'w' + i} className="advice yellow sm">{w}</div>
              ))}
              {analysis.notes.map((w, i) => (
                <div key={'n' + i} className="advice sm" style={{ borderColor: 'var(--line)' }}>{w}</div>
              ))}
              {!analysis.warnings.length && !analysis.notes.length && <div className="advice green sm">Volumen, frecuencia y duración coherentes con tu objetivo.</div>}
            </div>
          )}
          <PlanVolume days={plan} />
          <p className="muted small">Sustituye tus días con día fijo. Tu historial de entrenos no se toca.</p>
          <div className="wizard-nav">
            <button className="btn" onClick={() => setStep(3)}>
              <Icon name="left" size={16} /> Atrás
            </button>
            <button className="btn primary" onClick={save} disabled={!plan.some((d) => d.items.length)}>
              <Icon name="check" size={16} /> Guardar rutina
            </button>
          </div>
          <button className="link" onClick={() => make(plan.map((d) => ({ weekday: d.weekday, type: d.type })))}>
            Rehacer todo
          </button>
        </>
      )}
    </Modal>
  )
}

/* ---------- Crear o cambiar el plan: una sola entrada ---------- */
export function PlanMaker({ data, setData, onClose }) {
  const [mode, setMode] = useState(null) // 'auto' | 'manual'
  if (mode === 'auto') return <Generator data={data} setData={setData} onClose={onClose} />
  if (mode === 'manual') return <Setup data={data} setData={setData} onClose={onClose} />
  return (
    <Modal title="Crear o cambiar mi plan" onClose={() => onClose(false)}>
      <div className="list">
        <button className="row opt" onClick={() => setMode('auto')}>
          <span className="rest-ic"><Icon name="sparkle" size={20} /></span>
          <div className="grow">
            <b>Hazlo tú por mí</b>
            <div className="muted small">Te pregunto nivel, días, tiempo y material, y te monto el plan. Luego puedes cambiar lo que quieras.</div>
          </div>
          <Icon name="right" size={18} />
        </button>
        <button className="row opt" onClick={() => setMode('manual')}>
          <span className="rest-ic"><Icon name="calendar" size={20} /></span>
          <div className="grow">
            <b>Lo elijo yo</b>
            <div className="muted small">Marcas qué días entrenas y qué ejercicios haces cada día.</div>
          </div>
          <Icon name="right" size={18} />
        </button>
      </div>
      <p className="muted small">Tu historial de entrenos no se toca en ningún caso.</p>
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
            <div className="fields">
              <label>
                Descanso
                <select
                  className="inp sm"
                  value={it.rest || ''}
                  onChange={(e) => patchItem(it.id, { rest: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">Por defecto</option>
                  {[45, 60, 75, 90, 120, 150, 180, 240].map((v) => (
                    <option key={v} value={v}>
                      {restTxt(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Intensidad (RIR)
                <select
                  className="inp sm"
                  value={it.rir ?? ''}
                  onChange={(e) => patchItem(it.id, { rir: e.target.value === '' ? undefined : Number(e.target.value) })}
                >
                  <option value="">Sin indicar</option>
                  {[0, 1, 2, 3, 4].map((v) => (
                    <option key={v} value={v}>
                      {v === 0 ? '0 (al fallo)' : `${v} en reserva`}
                    </option>
                  ))}
                </select>
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
function CheckIn({ onSave, onSkip, exercises = [], night }) {
  const [feel, setFeel] = useState(null)
  const [rir, setRir] = useState({})
  const [hasPain, setHasPain] = useState(false)
  const [zone, setZone] = useState(null)
  const [level, setLevel] = useState('leve')
  const [note, setNote] = useState('')
  // si el reloj tiene la noche de hoy, viene marcado: menos de 6 h mal, hasta 7 h 30 normal, más bien
  const [sleep, setSleep] = useState(night ? (night.total < 360 ? 1 : night.total < 450 ? 2 : 3) : null)
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
      <h4>¿Cómo dormiste anoche?</h4>
      {night && <p className="muted small" style={{ marginTop: -4 }}>Según el reloj: {Math.floor(night.total / 60)} h {night.total % 60} min</p>}
      <div className="seg seg3">
        {[
          [1, 'Mal'],
          [2, 'Normal'],
          [3, 'Bien'],
        ].map(([v, l]) => (
          <button key={v} className={sleep === v ? 'on' + (v === 1 ? ' warn' : '') : ''} onClick={() => setSleep(sleep === v ? null : v)}>
            {l}
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
        onClick={() => onSave({ feel, rir, pain: hasPain && zone ? { zone, level } : null, note: note.trim(), ...(sleep ? { sleep } : {}) })}
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
// cuenta atrás al marcar una serie (se puede apagar en Ajustes)
const restOn = () => {
  try {
    return localStorage.getItem('migym.restOn') !== '0'
  } catch {
    return true
  }
}
const restSecs = () => {
  try {
    return Number(localStorage.getItem(REST_KEY)) || 90
  } catch {
    return 90
  }
}
// shortcut: sin sonido (iOS no deja sonar ni vibrar a una PWA sin toque), solo aviso visual; si hace falta, usar un aviso push
// rest = { end (ms), item, left? }: con `left` (segundos) está en pausa
function RestTimer({ rest, onAdd, onPause, onClose }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const paused = rest.left != null
  const left = paused ? rest.left : Math.ceil((rest.end - now) / 1000)
  useEffect(() => {
    if (paused) return
    if (left === 0) navigator.vibrate?.(300)
    if (left < -8) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, paused])
  return (
    <div className={'restbar' + (left <= 0 ? ' go' : '') + (paused ? ' paused' : '')} role="timer" aria-live="polite">
      <span className="rest-t">{left > 0 ? `${Math.floor(left / 60)}:${pad(left % 60)}` : '¡Siguiente serie!'}</span>
      {left > 0 && <span className="muted small grow">{paused ? 'en pausa' : 'descanso'}</span>}
      {left > 0 && <button onClick={() => onAdd(-15)} aria-label="Quitar 15 segundos">−15</button>}
      {left > 0 && <button onClick={() => onAdd(15)} aria-label="Añadir 15 segundos">+15</button>}
      {left > 0 && (
        <button onClick={onPause} aria-label={paused ? 'Reanudar descanso' : 'Pausar descanso'}>
          <Icon name={paused ? 'play' : 'pause'} size={15} fill={paused ? 'currentColor' : 'none'} stroke={paused ? 0 : 2.2} />
        </button>
      )}
      <button aria-label={left > 0 ? 'Omitir descanso' : 'Cerrar'} onClick={onClose}>
        <Icon name={left > 0 ? 'skip' : 'x'} size={16} />
      </button>
    </div>
  )
}

// Cabecera del entreno en curso: cronómetro, series hechas y estado de guardado
function SesHead({ a, items, cloud, online }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])
  const mins = a.start ? Math.max(0, Math.round((Date.now() - a.start) / 60000)) : null
  let total = 0, done = 0, kg = 0
  for (const it of items) {
    const sets = a.entries?.[it.ex] || []
    for (const s of sets) {
      if (s.warm) continue
      total++
      if (s.done || s.r || s.r2 || s.s || s.m || s.km || s.min) done++
      kg += num(s.w) * num(s.r) + (s.drops || []).reduce((q, x) => q + num(x.w) * num(x.r), 0)
    }
  }
  return (
    <div className="ses-head">
      <div className="ses-stats">
        <div>
          <b>{mins != null ? fmtMin(mins) : '—'}</b>
          <span>tiempo</span>
        </div>
        <div>
          <b>
            {done}
            <small>/{total}</small>
          </b>
          <span>series</span>
        </div>
        <div>
          <b>{kg ? Math.round(kg).toLocaleString('es-ES') : '0'}</b>
          <span>kg</span>
        </div>
      </div>
      <SyncPill cloud={cloud} online={online} />
    </div>
  )
}
const lastNote = (sessions, exId) => {
  for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].notes?.[exId]) return sessions[i].notes[exId]
  return null
}
const setsVol = (sets) =>
  sets.reduce((t, s) => t + num(s.w) * num(s.r) + (s.drops || []).reduce((q, x) => q + num(x.w) * num(x.r), 0), 0)
const setsTxt = (sets) => sets.map(setTxt).join(', ')

function Session({ data, setData, onExit, cloud, online }) {
  const a = data.active
  const day = a ? data.plan.find((d) => d.id === a.dayId) : null
  const items = a?.items || day?.items || []
  const name = a?.name || day?.name || 'Entreno'
  const [detail, setDetail] = useState(null)
  const [picker, setPicker] = useState(null) // { mode: 'add' } | { mode: 'swap', itemId }
  const [done, setDone] = useState(null) // { prs, changed, items, dayId, name } al terminar

  // series nuevas: ya traen el peso de la última vez (las reps de hoy, vacías)
  const newSets = (exId, n, drop, from = 0) => prefillSets(data.sessions, exId, n, drop, from)
  const curItems = (act) => act.items || day?.items || []
  const setTrack = (it, v) => setActive((act) => ({ ...act, items: curItems(act).map((i) => (i.id === it.id ? { ...i, track: v } : i)) }))
  const setActive = (fn) => setData((d) => (d.active ? { ...d, active: fn(d.active) } : d))
  // descanso: { end (ms), item }; vive en el entreno para que no se pierda al cambiar de pestaña
  const rest = a?.rest
  const setRest = (r) => setActive((act) => ({ ...act, rest: r }))
  const clampRest = (s) => Math.min(600, Math.max(15, s))
  const addRest = (d) =>
    setActive((act) => {
      if (!act.rest) return act
      const its = curItems(act)
      const it = its.find((i) => i.id === act.rest.item)
      if (!it?.rest) {
        try {
          localStorage.setItem(REST_KEY, clampRest(restSecs() + d))
        } catch {}
      }
      return {
        ...act,
        items: it?.rest ? its.map((i) => (i === it ? { ...i, rest: clampRest(i.rest + d) } : i)) : act.items,
        rest: act.rest.left != null ? { ...act.rest, left: Math.max(1, act.rest.left + d) } : { ...act.rest, end: act.rest.end + d * 1000 },
      }
    })
  // pausar / reanudar: en pausa se guardan los segundos que quedan (sobrevive a cerrar la app)
  const pauseRest = () =>
    setActive((act) => {
      if (!act.rest) return act
      if (act.rest.left != null) return { ...act, rest: { end: Date.now() + act.rest.left * 1000, item: act.rest.item } }
      return { ...act, rest: { ...act.rest, end: null, left: Math.max(1, Math.ceil((act.rest.end - Date.now()) / 1000)) } }
    })
  const uniOf = (it) => it.uni ?? !!data.uniEx?.[it.ex]
  const toggleUni = (it) => {
    const v = !uniOf(it)
    setData((d) => ({
      ...d,
      uniEx: { ...(d.uniEx || {}), [it.ex]: v },
      active: d.active ? { ...d.active, items: (d.active.items || day?.items || []).map((i) => (i.id === it.id ? { ...i, uni: v } : i)) } : d.active,
    }))
  }
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
    setActive((act) => ({ ...act, entries: { ...act.entries, [exId]: [...(act.entries[exId] || []), ...newSets(exId, 1, false, (act.entries[exId] || []).length)] } }))
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
        entries[ex.id] = newSets(ex.id, old.sets, old.drop)
        return { ...act, items: its.map((i) => (i.id === p.itemId ? { ...i, ex: ex.id } : i)), entries }
      }
      entries[ex.id] = newSets(ex.id, 3, false)
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
          night={nightsOf(data)[todayStr()]}
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
          <div className="sum-stats">
            {done.min > 0 && (
              <div>
                <b>{done.min}</b>
                <span>min</span>
              </div>
            )}
            <div>
              <b>{done.nEx}</b>
              <span>{done.nEx === 1 ? 'ejercicio' : 'ejercicios'}</span>
            </div>
            <div>
              <b>{done.nSets}</b>
              <span>series</span>
            </div>
            {done.vol > 0 && (
              <div>
                <b>{done.vol.toLocaleString('es-ES')}</b>
                <span>kg movidos</span>
              </div>
            )}
          </div>
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
          {done.nWarm > 0 && <p className="muted small">{done.nWarm} {done.nWarm === 1 ? 'serie de calentamiento' : 'series de calentamiento'} (no cuentan en volumen ni récords).</p>}
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
      // el peso precargado de la última vez no cuenta solo: hace falta hacer la serie (reps o marcarla)
      const own = (x) => !!x.w && x.w !== x.pw
      const kept = sets
        .filter((s) => s.done || own(s) || setFilled({ ...s, w: '' }) || s.r2 || s.drops.some((x) => own(x) || x.r))
        .map((s) => {
          const extra = Object.fromEntries(['s', 'm', 'km', 'min'].filter((k) => s[k]).map((k) => [k, s[k]]))
          const drops = s.drops.filter((x) => own(x) || x.r).map((x) => ({ w: x.w || '', r: x.r || '' }))
          const base = { w: s.w || '', r: s.r || '', ...extra, drops, ...(s.warm ? { warm: true } : {}) }
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
    // duración: si pasa de 4 h es que se quedó abierto, no se guarda
    const mins = a.start ? Math.round((Date.now() - a.start) / 60000) : 0
    const min = mins > 0 && mins <= 240 ? mins : 0
    const vol = Math.round(Object.values(entries).reduce((t, ss) => t + setsVol(ss), 0))
    const nSets = Object.values(entries).reduce((t, ss) => t + ss.filter((x) => !x.warm).length, 0)
    const nWarm = Object.values(entries).reduce((t, ss) => t + ss.filter((x) => x.warm).length, 0)
    const nEx = Object.keys(entries).length
    // sin ninguna serie no se guarda un entreno vacío (contaría como día entrenado)
    if (!nSets && !nWarm) {
      if (!confirm('No has apuntado ninguna serie, así que no se guarda nada. ¿Cerrar el entreno?')) return
      setData((d) => ({ ...d, active: null }))
      onExit()
      return
    }
    setData((d) => ({
      ...d,
      active: null,
      sessions: [...d.sessions, { id: sid, date: a.date, dayId: a.dayId, dayName: name, entries, ...(Object.keys(notes).length ? { notes } : {}), ...(min ? { min } : {}) }],
    }))
    const before = (day?.items || []).map((i) => i.ex).join('|')
    const after = items.map((i) => i.ex).join('|')
    const changed = items.length > 0 && (a.dayId === 'free' || (day && before !== after))
    setDone({ prs, cmp, changed, items, dayId: a.dayId, name, sid, step: 'checkin', exs: Object.keys(entries), entries, min, vol, nSets, nWarm, nEx })
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
      <SesHead a={a} items={items} cloud={cloud} online={online} />
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
        const tr = trackOf(it, ex)
        const T = TRACKS[tr]
        const uni = tr === 'reps' && uniOf(it)
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
            <div className="row nob" onClick={() => ex && setDetail(ex)} role="button" tabIndex={0} aria-label={`Ficha de ${ex?.name || it.ex}`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ex && (e.preventDefault(), setDetail(ex))}>
              <Thumb ex={ex} />
              <div className="grow">
                <div>
                  <b>{ex?.name || it.ex}</b>
                </div>
                <div className="muted small">
                  Objetivo: {tr === 'reps' ? `${it.sets}×${it.reps}` : `${it.sets} series`}
                  {it.drop ? ' · drop set' : ''}
                  {it.rir != null ? ` · RIR ${it.rir}` : ''}
                  {it.rest ? ` · descanso ${restTxt(it.rest)}` : ''}
                </div>
                {last && (
                  <div className="muted small">
                    Última vez ({last.date.slice(8)}/{last.date.slice(5, 7)}): {last.sets.map(setTxt).join(', ')}
                  </div>
                )}
                {ex && (
                  <div className="ex-badges">
                    {ex.main.map((m) => (
                      <Badge key={m} tone="accent">{m}</Badge>
                    ))}
                    {ex.sec.slice(0, 3).map((m) => (
                      <Badge key={m}>{m}</Badge>
                    ))}
                    {ex.equip && <Badge>{ex.equip}</Badge>}
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
            {ex && !ex.custom && (
              <details className="tech-d">
                <summary>Técnica</summary>
                <p>{techFor(ex)}</p>
              </details>
            )}
            <div className="track-row">
              <span className="muted small">Medir por</span>
              <select className="inp sm" aria-label="Cómo se mide" value={tr} onChange={(e) => setTrack(it, e.target.value)}>
                {Object.entries(TRACKS).map(([id, t]) => (
                  <option key={id} value={id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {tr === 'reps' && (
              <button className={'uni-tg' + (uni ? ' on' : '')} onClick={() => toggleUni(it)}>
                <span className="uni-dot" /> {uni ? 'Por lados: izquierdo / derecho' : 'Unilateral (un lado y luego otro)'}
              </button>
            )}
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
                  <div className={'setrow' + (s.warm ? ' warm' : '')}>
                    <span className="setn" title={s.warm ? 'Calentamiento' : undefined}>{s.warm ? 'C' : i + 1}</span>
                    <input
                      className="inp sm"
                      inputMode="decimal"
                      aria-label={T.a[1]}
                      placeholder={(T.a[0] === 'w' && ph.w) || T.a[1]}
                      value={s[T.a[0]] || ''}
                      onChange={(e) => patchSet(it.ex, i, (x) => ({ ...x, [T.a[0]]: kgIn(e.target.value) }))}
                    />
                    <span className="x">{tr !== 'reps' ? T.a[1] : uni ? 'kg' : 'kg ×'}</span>
                    <input
                      className="inp sm"
                      inputMode={T.b[0] === 'min' ? 'decimal' : 'numeric'}
                      data-b
                      aria-label={uni ? 'Reps izquierdo' : T.b[1]}
                      placeholder={uni ? 'izq' : T.b[1]}
                      value={s[T.b[0]] || ''}
                      onChange={(e) => patchSet(it.ex, i, (x) => ({ ...x, [T.b[0]]: T.b[0] === 'min' ? kgIn(e.target.value) : repIn(e.target.value) }))}
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
                        if (!s.done && !(s[T.b[0]] || (uni && s.r2)))
                          return e.currentTarget.parentElement.querySelector('input[data-b]')?.focus()
                        if (!s.done && restOn()) setRest({ end: Date.now() + (it.rest || restSecs()) * 1000, item: it.id })
                        patchSet(it.ex, i, (x) =>
                          x.done
                            ? { ...x, done: false }
                            : {
                                ...x,
                                done: true,
                                w: T.a[0] === 'w' ? x.w || ph.w || '' : x.w,
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
                      + drop
                    </button>
                    {tr === 'reps' && (
                      <button className={'link small' + (s.warm ? ' on-link' : '')} onClick={() => patchSet(it.ex, i, (x) => ({ ...x, warm: !x.warm }))}>
                        {s.warm ? 'Calentamiento ✓' : 'Calentamiento'}
                      </button>
                    )}
                    {sets.length > 1 && (
                      <button className="link small danger-link" onClick={() => removeSet(it.ex, i)} aria-label="Quitar serie">
                        Quitar
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
      {rest && <RestTimer rest={rest} onAdd={addRest} onPause={pauseRest} onClose={() => setRest(null)} />}
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
      {detail && <ExerciseModal ex={detail} data={data} setData={setData} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ---------- Pantalla Entreno ---------- */
export default function Workout({ data, setData, view, setView, onStart, onStartFree, mode = 'train', onOpenStart, goTab, cloud, online }) {
  const [maker, setMaker] = useState(false)
  const [chat, setChat] = useState(false)
  const [coach, setCoach] = useState(false)
  const [flash, setFlash] = useState(null)
  const [dayOpen, setDayOpen] = useState(null)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash])

  if (view.name === 'session') return <Session data={data} setData={setData} cloud={cloud} online={online} onExit={() => setView({ name: 'list' })} />
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
  const sorted = [...data.plan].sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7)
  const todays = byWeekday(today)
  const recent = doneSessions(data).slice(-6).reverse()
  const dayCard = (d) => {
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
            <span className="daypill">
              {d.weekday != null ? WEEKDAYS[d.weekday] : 'Sin día'}
              {d.weekday === today ? ' · Hoy' : ''}
              {d.fromTrainer ? ' · de tu entrenador' : ''}
            </span>
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
  }

  if (mode === 'routines')
    return (
      <div className="page">
        {flash && <div className="notice">{flash}</div>}
        <div className="head">
          <div>
            <div className="eyebrow">Tu plan semanal</div>
            <h1 className="title">Rutinas</h1>
          </div>
          <button className="icon-btn" onClick={() => setView({ name: 'library' })} aria-label="Biblioteca de ejercicios">
            <Icon name="book" size={18} />
          </button>
        </div>
        <div className="sec-head">
          <h4>Mis días</h4>
          <span className="muted small">{data.plan.length} {data.plan.length === 1 ? 'día' : 'días'}</span>
        </div>
        {data.plan.length === 0 && (
          <State icon="calendar" title="Aún no tienes rutina" text="Genera un plan a tu medida o crea tus días uno a uno." action="Crear mi plan" onAction={() => setMaker(true)} />
        )}
        {sorted.map(dayCard)}
        <PlanVolume days={data.plan.filter((d) => d.weekday != null)} />
        <div className="sec-head">
          <h4>Herramientas</h4>
        </div>
        <div className="tiles">
          <button className="tile2 accent" onClick={() => setMaker(true)}>
            <span className="tile2-ic"><Icon name="sparkle" size={18} /></span>
            <span className="tile2-t">Generar plan</span>
            <span className="tile2-s">Paso a paso o sorpréndeme</span>
          </button>
          <button className="tile2" onClick={addDay}>
            <span className="tile2-ic"><Icon name="plus" size={18} /></span>
            <span className="tile2-t">Nuevo día</span>
            <span className="tile2-s">Crear uno vacío</span>
          </button>
          <button className="tile2" onClick={() => setView({ name: 'library' })}>
            <span className="tile2-ic"><Icon name="book" size={18} /></span>
            <span className="tile2-t">Biblioteca</span>
            <span className="tile2-s">{EXERCISES.length} ejercicios</span>
          </button>
          <button className="tile2 accent" onClick={() => setCoach(true)}>
            <span className="tile2-ic"><Icon name="sparkle" size={18} /></span>
            <span className="tile2-t">Mejorar con IA</span>
            <span className="tile2-s">Ajusta tu rutina</span>
          </button>
        </div>
        {maker && <PlanMaker data={data} setData={setData} onClose={() => setMaker(false)} />}
        {coach && <Coach data={data} setData={setData} onClose={() => setCoach(false)} />}
      </div>
    )

  return (
    <div className="page">
      {flash && <div className="notice">{flash}</div>}
      <div className="head">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="title">Entrenamiento</h1>
        </div>
        <button className="icon-btn" onClick={() => setChat(true)} aria-label="Preguntar al entrenador">
          <Icon name="sparkle" size={18} />
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

      <button className="cta" onClick={onOpenStart}>
        <Icon name="play" size={18} fill="currentColor" stroke={0} /> {data.active ? 'Continuar entrenamiento' : 'Comenzar entrenamiento'}
      </button>

      <div className="week">
        {ORDER.map((w) => {
          const ds = byWeekday(w)
          // fecha de ese día en esta semana (lunes primero)
          const date = addDays(todayStr(), ORDER.indexOf(w) - ORDER.indexOf(today))
          const done = doneSessions(data, date).length > 0
          return (
            <button className={'wday' + (w === today ? ' today' : '') + (ds.length ? ' has' : '') + (done ? ' done' : '')} key={w} onClick={() => setDayOpen(date)} aria-label={WEEKDAYS[w]}>
              <span className="wd">{'DLMXJVS'[w]}</span>
              {done ? <Icon name="check" size={12} stroke={3} className="wcheck" /> : <span className="dot" />}
            </button>
          )
        })}
      </div>
      {dayOpen && <DayModal data={data} date={dayOpen} onClose={() => setDayOpen(null)} />}

      <div className="sec-head">
        <h4>Hoy</h4>
        {todays.length > 0 && <span className="muted small">{WEEKDAYS[today]}</span>}
      </div>
      {todays.length === 0 && (
        <div className="card rest">
          <div className="rest-ic">
            <Icon name="calendar" size={22} />
          </div>
          <div className="grow">
            <b>{data.plan.length === 0 ? 'Aún no tienes rutina' : 'Hoy toca descanso'}</b>
            <p className="muted small">
              {data.plan.length === 0 ? 'Créala en Rutinas o empieza un entreno libre.' : 'Si te apetece entrenar igual, elige otra rutina desde Comenzar.'}
            </p>
            {data.plan.length === 0 && (
              <button className="btn sm-btn" onClick={() => goTab?.('routines')}>
                Ir a Rutinas
              </button>
            )}
          </div>
        </div>
      )}
      {todays.map(dayCard)}

      <WeeklyReview data={data} setData={setData} focusId={todays[0]?.id} rest={todays.length === 0} />

      <div className="sec-head">
        <h4>Últimos entrenos</h4>
        {recent.length > 0 && <span className="muted small">{doneSessions(data).length} en total</span>}
      </div>
      {recent.length === 0 && <State icon="dumbbell" title="Todavía no hay entrenos" text="Cuando termines uno, aquí verás series, kg y tu pulso del reloj." />}
      {recent.length > 0 && (
        <div className="card list-card">
          {recent.map((s) => {
            const nSets = Object.values(s.entries || {}).reduce((n, ss) => n + ss.length, 0)
            const vol = Math.round(Object.values(s.entries || {}).reduce((t, ss) => t + setsVol(ss), 0))
            return (
              <button key={s.id} className="row nob li" onClick={() => setDayOpen(s.date)}>
                <span className="ls-ic" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--card2)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="dumbbell" size={18} />
                </span>
                <div className="grow">
                  <div className="li-t">{s.dayName || 'Entreno'}</div>
                  <div className="muted small">
                    {fmtDay(s.date)} · {Object.keys(s.entries || {}).length} ej. · {nSets} series{vol ? ` · ${vol.toLocaleString('es-ES')} kg` : ''}{s.min ? ` · ${s.min} min` : ''}
                  </div>
                </div>
                <Icon name="right" size={16} className="muted" />
              </button>
            )
          })}
        </div>
      )}

      <div className="tiles">
        <button className="tile2 accent" onClick={onStartFree}>
          <span className="tile2-ic"><Icon name="bolt" size={18} /></span>
          <span className="tile2-t">Entreno libre</span>
          <span className="tile2-s">Sin plan, a tu aire</span>
        </button>
        <button className="tile2" onClick={() => setChat(true)}>
          <span className="tile2-ic"><Icon name="sparkle" size={18} /></span>
          <span className="tile2-t">Preguntar</span>
          <span className="tile2-s">Chat con el entrenador</span>
        </button>
      </div>
      {maker && <PlanMaker data={data} setData={setData} onClose={() => setMaker(false)} />}
      {chat && <CoachChat data={data} onClose={() => setChat(false)} />}
      {coach && <Coach data={data} setData={setData} onClose={() => setCoach(false)} />}
    </div>
  )
}
