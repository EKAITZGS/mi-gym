import { useMemo, useState } from 'react'
import { EXERCISES } from './data/exercises'
import { WEEKDAYS, uid } from './store'
import { Modal, Thumb } from './ui'
import Icon from './icons'

const ORDER = [1, 2, 3, 4, 5, 6, 0]
// Grupos que se pueden elegir para un día -> grupos de ejercicios
const PARTS = [
  { id: 'Pecho', groups: ['Pecho'] },
  { id: 'Espalda', groups: ['Espalda'] },
  { id: 'Pierna', groups: ['Pierna'] },
  { id: 'Hombro', groups: ['Hombro'] },
  { id: 'Brazo', groups: ['Bíceps', 'Tríceps'] },
  { id: 'Bíceps', groups: ['Bíceps'] },
  { id: 'Tríceps', groups: ['Tríceps'] },
  { id: 'Core', groups: ['Core'] },
  { id: 'Cuerpo completo', groups: ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core'] },
]
const joinParts = (ps) =>
  ps.length <= 1 ? ps[0] || '' : ps.slice(0, -1).join(', ') + ' y ' + ps[ps.length - 1].toLowerCase()

export default function Setup({ data, setData, onClose }) {
  // Estado inicial a partir del plan actual (si un día ya tiene ejercicios, se mantienen)
  const [days, setDays] = useState(() => {
    const m = {}
    for (const w of ORDER) {
      const d = data.plan.find((x) => x.weekday === w)
      m[w] = d
        ? { on: true, parts: [], name: d.name, exs: d.items.map((i) => i.ex) }
        : { on: false, parts: [], name: '', exs: [] }
    }
    return m
  })
  const [step, setStep] = useState(0) // 0 = elegir días; 1..n = ejercicios de cada día; n+1 = resumen
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const active = ORDER.filter((w) => days[w].on)
  const cur = step >= 1 && step <= active.length ? active[step - 1] : null

  const patch = (w, p) => setDays((s) => ({ ...s, [w]: { ...s[w], ...p } }))
  const togglePart = (w, part) => {
    const d = days[w]
    const parts = d.parts.includes(part) ? d.parts.filter((x) => x !== part) : [...d.parts, part]
    const groups = new Set(parts.flatMap((p) => PARTS.find((x) => x.id === p)?.groups || []))
    // quita los ejercicios que ya no encajan con lo que entrena ese día
    const exs = groups.size ? d.exs.filter((id) => groups.has(EXERCISES.find((e) => e.id === id)?.group)) : d.exs
    patch(w, { parts, name: joinParts(parts), exs })
  }

  const list = useMemo(() => {
    if (cur == null) return []
    const d = days[cur]
    const groups = new Set(d.parts.flatMap((p) => PARTS.find((x) => x.id === p)?.groups || []))
    const nq = q.trim().toLowerCase()
    return EXERCISES.filter((e) => {
      if (nq) return e.name.toLowerCase().includes(nq)
      if (showAll || groups.size === 0) return true
      return groups.has(e.group)
    })
  }, [cur, days, q, showAll])

  const toggleEx = (w, id) => {
    const exs = days[w].exs
    patch(w, { exs: exs.includes(id) ? exs.filter((x) => x !== id) : [...exs, id] })
  }

  const finish = () => {
    const plan = active.map((w) => {
      const prev = data.plan.find((x) => x.weekday === w)
      return {
        id: prev?.id || uid(),
        name: days[w].name.trim() || WEEKDAYS[w],
        weekday: w,
        items: days[w].exs.map((ex) => {
          const old = prev?.items.find((i) => i.ex === ex)
          return old || { id: uid(), ex, sets: 3, reps: '10', drop: false }
        }),
      }
    })
    // conserva días sin día fijo que ya tuvieras (p. ej. entrenos libres guardados)
    const loose = data.plan.filter((x) => x.weekday == null)
    setData((d) => ({ ...d, plan: [...plan, ...loose], setupDone: true, active: null }))
    onClose()
  }

  const goStep = (n) => {
    setQ('')
    setShowAll(false)
    setStep(n)
  }

  return (
    <Modal title="Configurar entrenamiento" onClose={onClose}>
      <div className="steps">
        {[0, ...active.map((_, i) => i + 1), active.length + 1].map((n) => (
          <span key={n} className={'stepdot' + (n === step ? ' on' : n < step ? ' done' : '')} />
        ))}
      </div>

      {step === 0 && (
        <>
          <p className="muted">¿Qué días entrenas y qué haces cada día? Toca un día y elige los grupos.</p>
          {ORDER.map((w) => {
            const d = days[w]
            return (
              <div key={w} className={'setup-day' + (d.on ? ' on' : '')}>
                <button className="setup-day-head" onClick={() => patch(w, d.on ? { on: false, parts: [], name: '', exs: [] } : { on: true })}>
                  <span className={'tick' + (d.on ? ' on' : '')}>{d.on && <Icon name="check" size={14} stroke={3} />}</span>
                  <b className="grow">{WEEKDAYS[w]}</b>
                  <span className="muted small">{d.on ? d.name || 'Elige qué entrenas' : 'Descanso'}</span>
                </button>
                {d.on && (
                  <div className="setup-day-body">
                    <div className="chips wrap">
                      {PARTS.map((p) => (
                        <button
                          key={p.id}
                          className={'chip sm' + (d.parts.includes(p.id) ? ' on' : '')}
                          onClick={() => togglePart(w, p.id)}
                        >
                          {p.id}
                        </button>
                      ))}
                    </div>
                    <input
                      className="inp"
                      placeholder="Nombre del día (ej: Pierna)"
                      value={d.name}
                      onChange={(e) => patch(w, { name: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )
          })}
          <p className="muted small">
            ¿Aún no sabes los ejercicios de algún día? Guarda solo los días y los vas añadiendo cuando entrenes.
          </p>
          <div className="wizard-nav">
            <button className="btn" disabled={active.length === 0} onClick={finish}>
              Guardar días
            </button>
            <button className="btn primary" disabled={active.length === 0} onClick={() => goStep(1)}>
              Elegir ejercicios <Icon name="right" size={16} />
            </button>
          </div>
        </>
      )}

      {cur != null && (
        <>
          <div className="eyebrow">
            Día {step} de {active.length} · {WEEKDAYS[cur]}
          </div>
          <h2 style={{ marginTop: 2 }}>{days[cur].name || WEEKDAYS[cur]}</h2>
          <p className="muted small">
            Marca los ejercicios que haces este día ({days[cur].exs.length} elegidos). El orden es el que vayas marcando.
            Si aún no lo sabes, déjalo vacío y los añades el día que entrenes.
          </p>
          <input className="inp" placeholder="Buscar cualquier ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} />
          {days[cur].parts.length > 0 && !q && (
            <button className="link small-left" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver solo ' + days[cur].name.toLowerCase() : 'Ver todos los ejercicios'}
            </button>
          )}
          <div className="list">
            {list.map((e) => {
              const idx = days[cur].exs.indexOf(e.id)
              return (
                <button key={e.id} className={'row opt' + (idx >= 0 ? ' on' : '')} onClick={() => toggleEx(cur, e.id)}>
                  <Thumb ex={e} size={44} />
                  <div className="grow">
                    <div>{e.name}</div>
                    <div className="muted small">
                      {e.group} · {e.equip}
                    </div>
                  </div>
                  <span className={'tick' + (idx >= 0 ? ' on' : '')}>{idx >= 0 ? idx + 1 : ''}</span>
                </button>
              )
            })}
          </div>
          <div className="wizard-nav">
            <button className="btn" onClick={() => goStep(step - 1)}>
              <Icon name="left" size={16} /> Atrás
            </button>
            <button className="btn primary" onClick={() => goStep(step + 1)}>
              {step === active.length ? 'Ver resumen' : 'Siguiente día'} <Icon name="right" size={16} />
            </button>
          </div>
          <button className="link" onClick={finish}>
            Guardar ya y seguir otro día
          </button>
        </>
      )}

      {step === active.length + 1 && step > 0 && (
        <>
          <h2 style={{ marginTop: 0 }}>Tu semana</h2>
          {ORDER.map((w) => (
            <div key={w} className="sum-row">
              <b>{WEEKDAYS[w]}</b>
              <span className="muted small">
                {days[w].on
                  ? `${days[w].name || WEEKDAYS[w]} · ${days[w].exs.length ? days[w].exs.length + ' ejercicios' : 'ejercicios al entrenar'}`
                  : 'Descanso'}
              </span>
            </div>
          ))}
          <p className="muted small">Cada ejercicio empieza con 3 series de 10; puedes cambiarlo luego en Editar.</p>
          <div className="wizard-nav">
            <button className="btn" onClick={() => goStep(step - 1)}>
              <Icon name="left" size={16} /> Atrás
            </button>
            <button className="btn primary" onClick={finish}>
              <Icon name="check" size={16} /> Guardar plan
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
