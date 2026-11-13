import { useState } from 'react'
import { dayTotals, fmtDate, todayStr, DEFAULT } from './store'
import { EX_BY_ID } from './data/exercises'
import { Ring, Thumb } from './ui'
import Icon from './icons'
import { polarExercisesOn } from './polar'
import WeeklyReview from './Review'
import PolarSession from './PolarSession'
import { ProteinTip } from './Extras'
import { PlanMaker } from './Workout'
import { GoalCalc } from './Settings'
import { streakWeeks, weekTotals } from './stats'
import { SleepLine } from './Sleep'

const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const greeting = () => {
  const h = new Date().getHours()
  return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Home({ data, setData, onStart, go }) {
  const [maker, setMaker] = useState(false)
  const [welcome, setWelcome] = useState(null) // 'goals' | 'plan': bienvenida paso a paso
  const [polarEx, setPolarEx] = useState(null)
  const wd = new Date().getDay()
  const todays = data.plan.filter((d) => d.weekday === wd)
  const others = data.plan.filter((d) => d.weekday !== wd)
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

  const weekDots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i)
    const s = fmtDate(d)
    return { s, l: 'LMXJVSD'[i], done: doneDates.has(s), today: s === todayStr() }
  })

  return (
    <div className="page">
      <div className="eyebrow cap">{dateTxt}</div>
      <h1 className="title">{greeting()}</h1>

      {!data.setupDone && data.sessions.length === 0 && (
        <div className="card onboard">
          <b>Bienvenido a Mi Gym</b>
          <p className="muted small">En 2 minutos lo dejamos listo:</p>
          <ol className="small welcome-steps">
            <li>Tus objetivos de calorías y proteína.</li>
            <li>Tu plan de entreno (automático o eligiéndolo tú).</li>
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
                <button className="link small hero-again" onClick={() => onStart(d.id)}>
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
              <span className="daypill">Entreno de hoy</span>
              <h2>{d.name}</h2>
              <div className="hero-thumbs">
                {d.items.slice(0, 5).map((i) => (
                  <Thumb key={i.id} ex={EX_BY_ID[i.ex]} size={34} />
                ))}
                <span className="small">{d.items.length ? `${d.items.length} ejercicios` : 'Sin ejercicios aún: añádelos mientras entrenas'}</span>
              </div>
              <button className="btn primary full" onClick={() => onStart(d.id)}>
                <Icon name="play" size={14} fill="currentColor" stroke={0} />
                {data.active?.dayId === d.id ? 'Continuar entreno' : 'Empezar entreno'}
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
            <b>{data.plan.length === 0 ? 'Aún no tienes plan' : 'Hoy toca descanso'}</b>
            <p className="muted small">
              {data.plan.length === 0
                ? 'Crea tus días o genera un plan automático.'
                : 'Recuperar también es entrenar. Si te apetece, elige otro día:'}
            </p>
            <div className="chips wrap">
              {others.map((d) => (
                <button key={d.id} className="chip" onClick={() => onStart(d.id)}>
                  {d.name}
                </button>
              ))}
              {data.plan.length === 0 && (
                <button className="chip on" onClick={() => go('train')}>
                  Ir a Entreno
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <SleepLine data={data} onOpen={() => go('progress')} />
      <WeeklyReview data={data} setData={setData} focusId={todays[0]?.id} rest={todays.length === 0} />

      {data.polar && (() => {
        const today = todayStr()
        const ex = polarExercisesOn(data, today)
        // pasos y kcal van en anillos más abajo; aquí solo los entrenos del reloj de hoy
        if (!ex.length) return null
        const show = ex
        return (
          <div className="card polar-card">
            <div className="sec-head nm">
              <b>
                <Icon name="trend" size={16} className="inl" /> Reloj Polar
              </b>
            </div>
            {show.map((e) => (
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
        <button className="card tile" onClick={() => !data.polar && go('settings')}>
          <Ring value={watchDay?.steps || 0} max={data.goals.steps || 7000} size={86} stroke={9}>
            <Icon name="trend" size={20} />
          </Ring>
          <div>
            <b className="tile-num">{miles(watchDay?.steps || 0)}</b>
            <span className="muted small"> / {miles(data.goals.steps || 7000)} pasos hoy</span>
          </div>
        </button>
        <button className="card tile" onClick={() => !data.polar && go('settings')}>
          {/* el anillo se llena según lo quemado frente a lo que te toca comer al día */}
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
        <p className="muted small" style={{ margin: '-4px 4px 10px' }}>Conecta tu reloj en Ajustes para ver pasos y calorías quemadas.</p>
      ) : !watchDay ? (
        <p className="muted small" style={{ margin: '-4px 4px 10px' }}>Aún no hay datos del reloj de hoy: se actualizan al sincronizar.</p>
      ) : null}

      <ProteinTip data={data} setData={setData} />

      <div className="card">
        <div className="sec-head nm">
          <b>Esta semana</b>
          <span className="muted small">
            {done} {done === 1 ? 'entreno' : 'entrenos'}
            {planned ? ` de ${planned}` : ''}
          </span>
        </div>
        {(() => {
          const streak = streakWeeks(data.sessions)
          const wk = weekTotals(data.sessions)
          const bits = [
            streak > 1 && `🔥 ${streak} semanas seguidas`,
            wk.vol > 0 && `${miles(wk.vol)} kg`,
            wk.min > 0 && (wk.min >= 60 ? `${Math.floor(wk.min / 60)} h ${wk.min % 60} min` : `${wk.min} min`),
          ].filter(Boolean)
          return bits.length > 0 && <p className="muted small" style={{ margin: '0 0 8px' }}>{bits.join(' · ')}</p>
        })()}
        <div className="wdots">
          {weekDots.map((d) => (
            <div key={d.s} className={'wdot' + (d.done ? ' done' : '') + (d.today ? ' today' : '')}>
              <span className="c">{d.done ? <Icon name="check" size={14} stroke={3} /> : ''}</span>
              <span className="l">{d.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
