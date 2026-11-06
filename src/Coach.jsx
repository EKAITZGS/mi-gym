import { useState } from 'react'
import { Modal, Thumb } from './ui'
import Icon from './icons'
import { WEEKDAYS } from './store'
import { EX_BY_ID } from './data/exercises'
import { improvePlan, recentPains, needsDeload } from './coach'
import { generatePlan } from './plans'

const FOCUS = ['Equilibrado', 'Más pierna', 'Más tren superior', 'Más brazos', 'Más hombro', 'Fuerza']
const ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function Coach({ data, setData, onClose }) {
  const current = data.plan.filter((d) => d.weekday != null).length || data.plan.length
  const [days, setDays] = useState(Math.min(7, Math.max(3, current + 1)))
  const [focus, setFocus] = useState('Equilibrado')
  const [notes, setNotes] = useState('')
  const [st, setSt] = useState({ loading: false, err: '', result: null })
  const pains = recentPains(data.sessions)

  const ask = async () => {
    setSt({ loading: true, err: '', result: null })
    try {
      const result = await improvePlan(data, { days, focus, notes })
      setSt({ loading: false, err: '', result })
    } catch (e) {
      setSt({ loading: false, err: e.message, result: null })
    }
  }
  const apply = (plan) => {
    const loose = data.plan.filter((x) => x.weekday == null && !plan.some((p) => p.name === x.name))
    setData((d) => ({ ...d, plan: [...plan, ...loose], setupDone: true }))
    onClose()
  }
  const fallback = () => {
    const level = data.sessions.length < 12 ? 'beginner' : data.sessions.length < 60 ? 'intermediate' : 'advanced'
    apply(generatePlan(days, level))
  }

  const r = st.result
  return (
    <Modal title="Mejorar mi rutina" onClose={onClose}>
      {!r && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            La IA mira tu rutina actual ({current} {current === 1 ? 'día' : 'días'}), tus últimos entrenos, cómo te
            sentiste y tus molestias, y te propone cambios. Tú decides si los aplicas.
          </p>
          {(pains.length > 0 || needsDeload(data.sessions)) && (
            <div className="advice yellow sm">
              Tendrá en cuenta:{' '}
              {[
                ...new Set(pains.map((p) => `molestia en ${p.zone.toLowerCase()}`)),
                ...(needsDeload(data.sessions) ? ['entrenos muy duros últimamente'] : []),
              ].join(', ')}
              .
            </div>
          )}
          <h4>¿Cuántos días quieres ir?</h4>
          <div className="chips wrap">
            {[3, 4, 5, 6, 7].map((n) => (
              <button key={n} className={'chip' + (days === n ? ' on' : '')} onClick={() => setDays(n)}>
                {n} días{n === current ? ' (ahora)' : ''}
              </button>
            ))}
          </div>
          {days - current >= 2 && (
            <p className="toast warn small">
              Subir {days - current} días de golpe es mucho. Lo ideal es añadir 1 día cada 3-4 semanas.
            </p>
          )}
          <h4>Enfoque</h4>
          <div className="chips wrap">
            {FOCUS.map((f) => (
              <button key={f} className={'chip sm' + (focus === f ? ' on' : '')} onClick={() => setFocus(f)}>
                {f}
              </button>
            ))}
          </div>
          <h4>Algo que deba saber (opcional)</h4>
          <textarea
            className="inp"
            rows={2}
            placeholder="Ej: no tengo barra libre los lunes, quiero más pecho, me molesta el hombro…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {st.err === 'NO_KEY' ? (
            <div className="card save-plan">
              <b>Falta la clave de Groq</b>
              <p className="muted small">
                Ponla en Ajustes → IA (es gratis en console.groq.com). Mientras tanto puedo crearte un plan automático de{' '}
                {days} días según tu nivel, aunque sin adaptarlo a tu rutina.
              </p>
              <button className="btn full" onClick={fallback}>
                Crear plan automático de {days} días
              </button>
            </div>
          ) : (
            st.err && <p className="toast warn">{st.err}</p>
          )}
          <button className="btn primary full" disabled={st.loading} onClick={ask}>
            <Icon name="sparkle" size={18} /> {st.loading ? 'Pensando tu rutina…' : 'Pedir propuesta a la IA'}
          </button>
        </>
      )}

      {r && (
        <>
          <div className="advice green">{r.resumen}</div>
          {r.consejos.length > 0 && (
            <ul className="tips-list">
              {r.consejos.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          <h4>Rutina propuesta</h4>
          {[...r.plan]
            .sort((a, b) => ORDER.indexOf(a.weekday ?? 9) - ORDER.indexOf(b.weekday ?? 9))
            .map((d) => (
              <div className="card" key={d.id}>
                <div className="sec-head nm">
                  <b>{d.name}</b>
                  <span className="daypill">{d.weekday != null ? WEEKDAYS[d.weekday] : 'Sin día'}</span>
                </div>
                {d.items.map((i) => (
                  <div className="row nob" key={i.id}>
                    <Thumb ex={EX_BY_ID[i.ex]} size={36} />
                    <div className="grow small">{EX_BY_ID[i.ex]?.name}</div>
                    <span className="muted small">
                      {i.sets}×{i.reps}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          <div className="wizard-nav">
            <button className="btn" onClick={() => setSt({ loading: false, err: '', result: null })}>
              <Icon name="left" size={16} /> Volver
            </button>
            <button className="btn primary" onClick={() => apply(r.plan)}>
              <Icon name="check" size={16} /> Aplicar rutina
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
