import { useMemo, useState } from 'react'
import { dayTotals, fmtDate, todayStr, DEFAULT, fmtKg } from './store'
import { EX_BY_ID } from './data/exercises'
import { Ring, Thumb } from './ui'
import Icon from './icons'
import { polarExercisesOn, getPolar, connectPolar } from './polar'
import WeeklyReview from './Review'
import PolarSession from './PolarSession'
import { PlanMaker, ExerciseModal } from './Workout'
import { GoalCalc } from './Settings'
import { streakWeeks, weekTotals, recentPRs, sessionVol } from './stats'
import { SleepLine } from './Sleep'
import { DayModal, doneSessions, fmtDay } from './DayDetail'
import { Stat, State, miles, fmtMin } from './ds'

const greeting = () => {
  const h = new Date().getHours()
  return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Home({ data, setData, onStart, go, onOpenStart, name }) {
  const [maker, setMaker] = useState(false)
  const [welcome, setWelcome] = useState(null) // 'goals' | 'plan': bienvenida paso a paso
  const [polarEx, setPolarEx] = useState(null)
  const [dayOpen, setDayOpen] = useState(null)
  const [exOpen, setExOpen] = useState(null)
  const wd = new Date().getDay()
  const todays = data.plan.filter((d) => d.weekday === wd)
  const t = dayTotals(data.food[todayStr()] || [])
  // datos del reloj de hoy (pasos y kcal del día)
  const watchDay = (() => {
    const d = data.polar?.days?.[todayStr()]
    return d && (d.steps > 0 || d.kcal > 0) ? d : null
  })()
  const monday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return fmtDate(d)
  })()
  const doneDates = new Set(data.sessions.filter((s) => s.date >= monday).map((s) => s.date))
  const done = data.sessions.filter((s) => s.date >= monday).length
  const planned = data.plan.filter((d) => d.weekday != null).length
  const dateTxt = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = (name || '').trim().split(' ')[0]

  const weekDots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i)
    const s = fmtDate(d)
    return { s, l: 'LMXJVSD'[i], done: doneDates.has(s), today: s === todayStr() }
  })
  const streak = streakWeeks(data.sessions)
  const wk = weekTotals(data.sessions)
  const prs = useMemo(() => recentPRs(data.sessions, 7).slice(0, 3), [data.sessions])
  const lastSes = useMemo(() => doneSessions(data).slice(-1)[0] || null, [data.sessions])
  const nextDay = useMemo(() => {
    // próxima sesión programada (hoy si aún no está hecha; si no, el siguiente día con rutina)
    const todayDone = doneDates.has(todayStr())
    for (let k = todayDone ? 1 : 0; k < 8; k++) {
      const w = (wd + k) % 7
      const d = data.plan.find((x) => x.weekday === w)
      if (d) return { d, k }
    }
    return null
  }, [data.plan, data.sessions])
  const hasAny = data.sessions.length > 0 || data.plan.length > 0

  // sin reloj conectado: tocar pasos/kcal lleva directo a conectar Polar
  const askPolar = () => {
    if (getPolar()?.token) return
    if (confirm('¿Conectar tu reloj Polar? Entrarás con tu cuenta de Polar para dar permiso y volverás aquí.')) connectPolar()
  }
  return (
    <div className="page">
      <div className="eyebrow cap">{dateTxt}</div>
      <h1 className="title">
        {greeting()}
        {firstName ? `, ${firstName}` : ''}
      </h1>

      {!data.setupDone && data.sessions.length === 0 && (
        <div className="card onboard">
          <b>Bienvenido a MI-GYM</b>
          <p className="muted small">En 2 minutos lo dejamos listo:</p>
          <ol className="small welcome-steps">
            <li>Tus objetivos de calorías y proteína.</li>
            <li>Tu rutina (generada a tu medida o eligiéndola tú).</li>
            <li>¡A entrenar! Todo se guarda en tu cuenta.</li>
          </ol>
          <button className="btn primary full" onClick={() => setWelcome('goals')}>
            <Icon name="play" size={14} fill="currentColor" stroke={0} /> Empezar
          </button>
          <button className="link small" style={{ paddingLeft: 0 }} onClick={() => setData((d) => ({ ...d, setupDone: true, plan: d.plan.length ? d.plan : DEFAULT.plan }))}>
            Usar el plan de ejemplo
          </button>
        </div>
      )}
      {maker && <PlanMaker data={data} setData={setData} onClose={() => setMaker(false)} />}
      {welcome === 'goals' && (
        <GoalCalc
          skipLabel="Saltar: lo pondré luego en Ajustes"
          onClose={() => setWelcome('plan')}
          onApply={(r) => {
            setData((d) => ({ ...d, goals: { ...d.goals, kcal: r.kcal, protein: r.protein } }))
            setWelcome('plan')
          }}
        />
      )}
      {welcome === 'plan' && <PlanMaker data={data} setData={setData} onClose={() => setWelcome(null)} />}

      {todays.map((d) => {
        const cover = EX_BY_ID[d.items[0]?.ex]
        const todayS = data.sessions.filter((x) => x.date === todayStr())
        // cuenta como hecho si hoy ya entrenaste, aunque fuera un entreno libre u otro día del plan
        const doneToday = data.active?.dayId !== d.id && (todayS.filter((x) => x.dayId === d.id).pop() || todayS.pop())
        if (doneToday) {
          const sets = Object.values(doneToday.entries || {}).reduce((n, ss) => n + ss.length, 0)
          const nEx = Object.keys(doneToday.entries || {}).length
          const watch = polarExercisesOn(data, todayStr()).pop()
          return (
            <div className="hero done" key={d.id}>
              {cover?.imgs?.[0] && <img src={cover.imgs[0]} alt="" />}
              <div className="hero-shade" />
              <div className="hero-txt">
                <span className="daypill ok">
                  <Icon name="check" size={13} /> Hecho hoy
                </span>
                <h2>{doneToday.dayId === d.id ? d.name : doneToday.dayName || d.name}</h2>
                <p className="hero-sum">
                  {nEx} {nEx === 1 ? 'ejercicio' : 'ejercicios'} · {sets} {sets === 1 ? 'serie' : 'series'}
                  {watch ? ` · ${watch.min} min · ${watch.kcal} kcal` : doneToday.min ? ` · ${doneToday.min} min` : ''}
                </p>
                <p className="small hero-note">¡Buen trabajo! Ahora toca comer bien y descansar.</p>
                <button className="link small hero-again" onClick={onOpenStart}>
                  Entrenar otra vez hoy
                </button>
              </div>
            </div>
          )
        }
        return (
          <div className="hero" key={d.id}>
            {cover?.imgs?.[0] && <img src={cover.imgs[0]} alt="" />}
            <div className="hero-shade" />
            <div className="hero-txt">
              <span className="daypill">{data.active?.dayId === d.id ? 'Entreno en curso' : 'Entreno de hoy'}</span>
              <h2>{d.name}</h2>
              <div className="hero-thumbs">
                {d.items.slice(0, 5).map((i) => (
                  <Thumb key={i.id} ex={EX_BY_ID[i.ex]} size={34} />
                ))}
                <span className="small">{d.items.length ? `${d.items.length} ejercicios` : 'Sin ejercicios aún: añádelos mientras entrenas'}</span>
              </div>
              <button className="cta" style={{ margin: '12px 0 0' }} onClick={onOpenStart}>
                <Icon name="play" size={16} fill="currentColor" stroke={0} />
                {data.active?.dayId === d.id ? 'Continuar entrenamiento' : 'Comenzar entrenamiento'}
              </button>
            </div>
          </div>
        )
      })}
      {todays.length === 0 && (
        <div className="card rest">
          <div className="rest-ic">
            <Icon name="calendar" size={22} />
          </div>
          <div className="grow">
            <b>{data.plan.length === 0 ? 'Aún no tienes rutina' : data.active ? 'Tienes un entreno a medias' : 'Hoy toca descanso'}</b>
            <p className="muted small">
              {data.plan.length === 0
                ? 'Créala en Rutinas o empieza un entreno libre.'
                : nextDay
                  ? `Recuperar también es entrenar. Siguiente sesión: ${nextDay.d.name} (${nextDay.k === 1 ? 'mañana' : 'en ' + nextDay.k + ' días'}).`
                  : 'Recuperar también es entrenar.'}
            </p>
            {data.plan.length === 0 ? (
              <button className="btn sm-btn" onClick={() => go('routines')}>
                Ir a Rutinas
              </button>
            ) : (
              <button className="link small" style={{ paddingLeft: 0 }} onClick={onOpenStart}>
                {data.active ? 'Continuar entrenamiento' : 'Entrenar hoy igualmente'}
              </button>
            )}
          </div>
        </div>
      )}
      {todays.length > 0 && nextDay && nextDay.k > 0 && (
        <p className="muted small" style={{ margin: '-6px 4px 12px' }}>
          Siguiente sesión: <b>{nextDay.d.name}</b> · {nextDay.k === 1 ? 'mañana' : `en ${nextDay.k} días`}
        </p>
      )}

      <SleepLine data={data} onOpen={() => go('progress')} />
      <WeeklyReview data={data} setData={setData} focusId={todays[0]?.id} rest={todays.length === 0} />

      {data.polar && (() => {
        const today = todayStr()
        const ex = polarExercisesOn(data, today)
        if (!ex.length) return null
        return (
          <div className="card polar-card">
            <div className="sec-head nm">
              <b>
                <Icon name="watch" size={16} className="inl" /> Reloj Polar
              </b>
            </div>
            {ex.map((e) => (
              <button className="polar-ex" key={e.id} onClick={() => setPolarEx(e)}>
                <div className="grow">
                  <div className="li-t">
                    {e.sport} · {e.min} min
                  </div>
                  <div className="muted small">{e.date === today ? `Hoy ${e.time}` : `${e.date.slice(8)}/${e.date.slice(5, 7)} ${e.time}`}</div>
                </div>
                <div className="polar-stats">
                  <span><b>{e.kcal}</b> kcal</span>
                  {e.hrAvg && <span><b>{e.hrAvg}</b>/{e.hrMax} ppm</span>}
                </div>
                <Icon name="right" size={16} className="muted" />
              </button>
            ))}
            {polarEx && <PolarSession ex={polarEx} data={data} onClose={() => setPolarEx(null)} />}
          </div>
        )
      })()}

      {/* Inicio: siempre pasos y kcal quemadas del reloj (lo que comes está en Dieta) */}
      <div className="grid2">
        <button className="card tile" onClick={askPolar}>
          <Ring value={watchDay?.steps || 0} max={data.goals.steps || 7000} size={86} stroke={9}>
            <Icon name="trend" size={20} />
          </Ring>
          <div>
            <b className="tile-num">{miles(watchDay?.steps || 0)}</b>
            <span className="muted small"> / {miles(data.goals.steps || 7000)} pasos hoy</span>
          </div>
        </button>
        <button className="card tile" onClick={askPolar}>
          <Ring value={watchDay?.kcal || 0} max={data.goals.kcal || 2200} size={86} stroke={9} color="var(--amber)">
            <Icon name="flame" size={20} />
          </Ring>
          <div>
            <b className="tile-num">{miles(watchDay?.kcal || 0)}</b>
            <span className="muted small"> kcal quemadas hoy</span>
          </div>
        </button>
      </div>
      {!data.polar ? (
        <p className="muted small" style={{ margin: '-4px 4px 10px' }}>Conecta tu reloj en Perfil para ver pasos y calorías quemadas.</p>
      ) : !watchDay ? (
        <p className="muted small" style={{ margin: '-4px 4px 10px' }}>Aún no hay datos del reloj de hoy: se actualizan al sincronizar.</p>
      ) : null}

      <button className="card last-ses" onClick={() => go('diet')}>
        <span className="ls-ic">
          <Icon name="food" size={20} />
        </span>
        <span className="grow">
          <div className="ls-t">Dieta de hoy</div>
          <div className="ls-d">
            {t.kcal > 0 ? `${miles(t.kcal)} / ${miles(data.goals.kcal || 2200)} kcal · ${Math.round(t.p)} / ${data.goals.protein || 150} g proteína` : 'Aún no has apuntado nada hoy'}
          </div>
        </span>
        <Icon name="right" size={16} className="muted" />
      </button>

      <div className="card">
        <div className="sec-head nm">
          <b>Esta semana</b>
          <span className="muted small">
            {done} {done === 1 ? 'entreno' : 'entrenos'}
            {planned ? ` de ${planned}` : ''}
          </span>
        </div>
        <div className="wdots">
          {weekDots.map((d) => (
            <div key={d.s} className={'wdot' + (d.done ? ' done' : '') + (d.today ? ' today' : '')}>
              <span className="c">{d.done ? <Icon name="check" size={14} stroke={3} /> : ''}</span>
              <span className="l">{d.l}</span>
            </div>
          ))}
        </div>
      </div>
      {dayOpen && <DayModal data={data} date={dayOpen} onClose={() => setDayOpen(null)} />}
      {exOpen && <ExerciseModal ex={exOpen} data={data} setData={setData} onClose={() => setExOpen(null)} />}
    </div>
  )
}
