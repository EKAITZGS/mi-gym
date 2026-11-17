// Generador de rutinas paso a paso y entrada única "Crear o cambiar mi plan".
import { useState } from 'react'
import { EXERCISES, EX_BY_ID } from '../data/exercises'
import { WEEKDAYS, pad } from '../store'
import { Modal, Thumb } from '../ui'
import { levelAuto } from '../aiPlan'
import Icon from '../icons'
import { LEVELS, EQUIP, MINUTES, DAY_TYPES, SPLITS, GOALS, DEFAULT_WEEKDAYS, splitFor, typesFor, pickFor, prescribe, buildDay, buildPlan, stripSlots, analyzePlan } from '../plans'
import Setup from '../Setup'
import { PlanVolume } from '../Extras'
import { ZONES, recentPains, zoneHits } from '../coach'
import { groupsOf } from '../ranks'
import { ORDER, restTxt } from './shared'
import { Library } from './Library'

/* ---------- Generador de plan (paso a paso) ---------- */
const FOCUS = ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core']
// Sustituye el plan con días fijos; conserva los días sin día fijo y no toca el historial
export function Generator({ data, setData, onClose }) {
  // nivel automático: el mismo que usa el entrenador IA (pesos en los ejercicios básicos y tiempo entrenando)
  const guess = levelAuto(data).id
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
          <h4 className="mt-0">¿Qué buscas?</h4>
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
          <h4 className="mt-0">¿Qué días vas al gimnasio?</h4>
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
          <h4 className="mt-0">¿Cómo repartes los músculos?</h4>
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
                className="inp w-auto-m0"
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
          <h4 className="mt-0">¿Qué material tienes?</h4>
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
          <p className="muted small mt-0">
            Revisa y ajusta antes de guardar: cambia ejercicios <Icon name="swap" size={13} className="inl" />, series (− / +), quita o rehaz un día. RIR = reps que te quedan en reserva.
          </p>
          {plan.map((d) => {
            const an = analysis?.days.find((x) => x.id === d.id)
            return (
              <div key={d.id} className="card card-pad-3">
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
                <div key={'n' + i} className="advice sm advice-plain">{w}</div>
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
