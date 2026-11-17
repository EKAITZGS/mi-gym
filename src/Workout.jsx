// Pantallas Entrenamiento y Rutinas. Biblioteca, generador, editor de día y entreno en curso están en src/workout/.
import { useEffect, useState } from 'react'
import { EXERCISES, EX_BY_ID } from './data/exercises'
import { WEEKDAYS, addDays, uid, lastSets, setTxt, todayStr } from './store'
import { Thumb } from './ui'
import Icon from './icons'
import { CoachChat } from './Review'
import { dayMinutes } from './plans'
import { PlanVolume } from './Extras'
import Coach from './Coach.jsx'
import { DayModal, doneSessions, fmtDay } from './DayDetail'
import { State, Badge } from './ds'
import { ORDER } from './workout/shared'
import { ExerciseModal, Library } from './workout/Library'
import { PlanMaker } from './workout/Generator'
import { DayEditor } from './workout/DayEditor'
import { Session } from './workout/Session'

/* ---------- Pantalla Entreno ---------- */
export default function Workout({ data, setData, view, setView, onStart, onStartFree, mode = 'train', onOpenStart, goTab, cloud, online }) {
  const [maker, setMaker] = useState(false)
  const [chat, setChat] = useState(false)
  const [coach, setCoach] = useState(false)
  const [flash, setFlash] = useState(null)
  const [dayOpen, setDayOpen] = useState(null)
  const [exOpen, setExOpen] = useState(null)
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
  // Tarjeta de día compacta: miniaturas, nombre, día, grupos, series y duración; día de la semana, editar y empezar
  const dayCard = (d) => {
    // grupos del día (sin repetir el nombre si el día ya se llama así)
    const groups = [...new Set(d.items.map((i) => EX_BY_ID[i.ex]?.group).filter(Boolean))].filter((g) => g.toLowerCase() !== d.name.trim().toLowerCase())
    const sets = d.items.reduce((n, i) => n + Number(i.sets || 0), 0)
    const thumbs = d.items.slice(0, 4).map((i) => EX_BY_ID[i.ex])
    return (
      <div className={'dcard' + (d.weekday === today ? ' is-today' : '')} key={d.id}>
        <div className="dcard-top">
          <div className="dcard-thumbs" aria-hidden="true">
            {thumbs.length ? thumbs.map((ex, k) => <Thumb key={k} ex={ex} size={38} />) : <span className="dcard-empty"><Icon name="dumbbell" size={20} /></span>}
          </div>
          <div className="dcard-main">
            <span className="dcard-day">
              {d.weekday != null ? WEEKDAYS[d.weekday] : 'Sin día'}
              {d.weekday === today ? ' · hoy' : ''}
              {d.fromTrainer ? ' · de tu entrenador' : ''}
            </span>
            <h3>{d.name}</h3>
            <span className="muted small">
              {d.items.length ? `${d.items.length} ejercicios · ${sets} series · ~${dayMinutes(d.items)} min` : 'Sin ejercicios: añádelos en editar o al empezar'}
            </span>
            {groups.length > 0 && (
              <span className="dcard-groups">
                {groups.map((g) => (
                  <Badge key={g}>{g}</Badge>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="dcard-foot">
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
      <div className="page wide">
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
        <div className="dgrid">{sorted.map(dayCard)}</div>
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
    <div className="page wide">
      {flash && <div className="notice">{flash}</div>}
      <div className="head">
        <div>
          <h1 className="title">Entrenamiento</h1>
        </div>
        <button className="btn sm-btn head-act" onClick={() => setChat(true)} aria-label="Preguntar al entrenador">
          <Icon name="sparkle" size={16} /> <span className="btn-lbl">Preguntar</span>
        </button>
      </div>

      <div className="cols">
      <div className="col">
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
      {todays.map((d) => (
        <div className="card" key={d.id}>
          <div className="sec-head nm">
            <b>{d.name}</b>
            <span className="muted small">{d.items.length} {d.items.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
          </div>
          {d.items.length === 0 && <p className="muted small">Sin ejercicios: los añades al empezar o en Rutinas.</p>}
          {d.items.map((i) => {
            const ex = EX_BY_ID[i.ex]
            const last = lastSets(data.sessions, i.ex)
            return (
              <div className="row nob li" key={i.id}>
                <Thumb ex={ex} size={38} />
                <div className="grow">
                  <div className="li-t">{ex?.name || i.ex}</div>
                  <div className="muted small">
                    {i.sets}×{i.reps}
                    {i.rir != null ? ` · RIR ${i.rir}` : ''}
                    {last ? ` · última vez ${last.sets.map(setTxt).join(', ')}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      </div>

      <div className="col">
      <div className="sec-head">
        <h4>Últimos entrenos</h4>
      </div>
      {recent.length === 0 && <State icon="dumbbell" title="Todavía no hay entrenos" text="Cuando termines uno, aquí verás series, kg y tu pulso del reloj." />}
      {recent.length > 0 && (
        <div className="card list-card">
          {recent.map((s) => {
            const nSets = Object.values(s.entries || {}).reduce((n, ss) => n + ss.length, 0)
            return (
              <button key={s.id} className="row nob li" onClick={() => setDayOpen(s.date)}>
                <span className="ls-ic ls-ic-sm">
                  <Icon name="dumbbell" size={18} />
                </span>
                <div className="grow">
                  <div className="li-t">{s.dayName || 'Entreno'}</div>
                  <div className="muted small">
                    {fmtDay(s.date)} · {Object.keys(s.entries || {}).length} {Object.keys(s.entries || {}).length === 1 ? 'ejercicio' : 'ejercicios'} · {nSets} series{s.min ? ` · ${s.min} min` : ''}
                  </div>
                </div>
                <Icon name="right" size={16} className="muted" />
              </button>
            )
          })}
        </div>
      )}
      </div>
      </div>

      {exOpen && <ExerciseModal ex={exOpen} data={data} setData={setData} onClose={() => setExOpen(null)} />}
      {maker && <PlanMaker data={data} setData={setData} onClose={() => setMaker(false)} />}
      {chat && <CoachChat data={data} setData={setData} onClose={() => setChat(false)} />}
      {coach && <Coach data={data} setData={setData} onClose={() => setCoach(false)} />}
    </div>
  )
}

// compatibilidad: estos componentes viven ahora en src/workout/
export { ExerciseModal, Library } from './workout/Library'
export { Generator, PlanMaker } from './workout/Generator'
export { editGuard } from './workout/shared'
