import { useMemo, useState } from 'react'
import { dayTotals, fmtDate, todayStr, exStats, fmtKg } from './store'
import { EX_BY_ID } from './data/exercises'
import { Ring, Thumb } from './ui'
import { ExerciseModal } from './Workout'
import Icon from './icons'
import { polarExercisesOn } from './polar'
import WeeklyReview from './Review'
import Setup from './Setup'
import { Generator } from './Workout'
import { generatePlan } from './plans'

const greeting = () => {
  const h = new Date().getHours()
  return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Home({ data, setData, onStart, go }) {
  const [open, setOpen] = useState(null)
  const [setup, setSetup] = useState(false)
  const [gen, setGen] = useState(false)
  const wd = new Date().getDay()
  const todays = data.plan.filter((d) => d.weekday === wd)
  const others = data.plan.filter((d) => d.weekday !== wd)
  const t = dayTotals(data.food[todayStr()] || [])
  const monday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return fmtDate(d)
  })()
  const doneDates = new Set(data.sessions.filter((s) => s.date >= monday).map((s) => s.date))
  const done = data.sessions.filter((s) => s.date >= monday).length
  const planned = data.plan.filter((d) => d.weekday != null).length
  const dateTxt = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const progress = useMemo(() => {
    const ids = [...new Set(data.sessions.flatMap((s) => Object.keys(s.entries || {})))]
    return ids
      .map((id) => {
        const st = exStats(data.sessions, id)
        if (!st.length || !EX_BY_ID[id]) return null
        return { id, n: st.length, first: st[0].best.e, last: st[st.length - 1].best.e }
      })
      .filter(Boolean)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
  }, [data.sessions])

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
          <b>Antes de nada: configura tu entrenamiento</b>
          <p className="muted small">Dime qué días entrenas y qué haces cada día, o deja que te haga un plan según tu nivel.</p>
          <div className="btns">
            <button className="btn primary" onClick={() => setSetup(true)}>
              <Icon name="calendar" size={16} /> Configurar
            </button>
            <button className="btn" onClick={() => setGen(true)}>
              <Icon name="sparkle" size={16} /> Automático
            </button>
          </div>
          <button className="link small" style={{ paddingLeft: 0 }} onClick={() => setData((d) => ({ ...d, setupDone: true }))}>
            Usar el plan de ejemplo
          </button>
        </div>
      )}
      {setup && <Setup data={data} setData={setData} onClose={() => setSetup(false)} />}
      {gen && (
        <Generator
          onClose={() => setGen(false)}
          onGenerate={(days, level) => {
            setData((d) => ({ ...d, plan: generatePlan(days, level), active: null, setupDone: true }))
            setGen(false)
          }}
        />
      )}

      {todays.map((d) => {
        const cover = EX_BY_ID[d.items[0]?.ex]
        const doneToday = data.active?.dayId !== d.id && data.sessions.filter((x) => x.date === todayStr() && x.dayId === d.id).pop()
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
                <h2>{d.name}</h2>
                <p className="hero-sum">
                  {nEx} {nEx === 1 ? 'ejercicio' : 'ejercicios'} · {sets} series
                  {watch ? ` · ${watch.min} min · ${watch.kcal} kcal` : ''}
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

      <WeeklyReview data={data} setData={setData} />

      {data.polar && (() => {
        const today = todayStr()
        const ex = polarExercisesOn(data, today)
        const last = Object.values(data.polar.exercises || {}).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0]
        const day = data.polar.days?.[today]
        const show = ex.length ? ex : last ? [last] : []
        return (
          <div className="card polar-card">
            <div className="sec-head nm">
              <b>
                <Icon name="trend" size={16} className="inl" /> Reloj Polar
              </b>
              <span className="muted small">{day?.steps ? `${day.steps.toLocaleString('es-ES')} pasos hoy` : ''}</span>
            </div>
            {show.length === 0 && <p className="muted small">Aún no hay entrenos del reloj. Sube uno a Polar Flow y aparecerá aquí.</p>}
            {show.map((e) => (
              <div className="polar-ex" key={e.id}>
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
              </div>
            ))}
          </div>
        )
      })()}

      <div className="grid2">
        <button className="card tile" onClick={() => go('diet')}>
          <Ring value={t.kcal} max={data.goals.kcal} size={86} stroke={9}>
            <Icon name="flame" size={20} />
          </Ring>
          <div>
            <b className="tile-num">{Math.round(t.kcal)}</b>
            <span className="muted small"> / {data.goals.kcal} kcal</span>
          </div>
        </button>
        <button className="card tile" onClick={() => go('diet')}>
          <Ring value={t.p} max={data.goals.protein} size={86} stroke={9} color="var(--blue)">
            <b className="ring-p">P</b>
          </Ring>
          <div>
            <b className="tile-num">{Math.round(t.p)}</b>
            <span className="muted small"> / {data.goals.protein} g prot.</span>
          </div>
        </button>
      </div>

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

      {progress.length > 0 && (
        <>
          <div className="sec-head">
            <h4>Tu progreso de fuerza</h4>
          </div>
          <div className="card list-card">
            {progress.map((p) => {
              const diff = p.last - p.first
              return (
                <button key={p.id} className="row nob li" onClick={() => setOpen(EX_BY_ID[p.id])}>
                  <Thumb ex={EX_BY_ID[p.id]} size={42} />
                  <div className="grow">
                    <div className="li-t">{EX_BY_ID[p.id].name}</div>
                    <div className="muted small">1RM est. {fmtKg(Math.round(p.last * 10) / 10)} kg</div>
                  </div>
                  {p.n > 1 && (
                    <span className={'delta ' + (diff >= 0 ? 'up' : 'down')}>
                      {diff >= 0 ? '+' : ''}
                      {fmtKg(Math.round(diff * 10) / 10)} kg
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
      {open && <ExerciseModal ex={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  )
}
