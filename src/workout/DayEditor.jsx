// Editor de un día de la rutina: borrador, guardar y confirmación al salir (editGuard).
/* ---------- Editor de día ---------- */
import { useEffect, useState } from 'react'
import { EX_BY_ID } from '../data/exercises'
import { WEEKDAYS, uid } from '../store'
import { Modal, Thumb } from '../ui'
import Icon from '../icons'
import { ORDER, restTxt, editGuard } from './shared'
import { Library } from './Library'

// Nombre del día con un toque: grupos que se combinan ("Pecho y tríceps", "Espalda, bíceps y core") y «Otro…» para escribirlo
export const DAY_PARTS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Brazos', 'Pierna', 'Glúteo', 'Core', 'Torso', 'Empuje', 'Tirón', 'Cuerpo completo']
export const composeName = (parts) =>
  parts.length ? parts.map((p, i) => (i ? p.toLowerCase() : p)).reduce((t, p, i, l) => (i === 0 ? p : t + (i === l.length - 1 ? ' y ' : ', ') + p), '') : ''
// "Pecho y tríceps" → ['Pecho', 'Tríceps']; null si el nombre no sale de los grupos (lo escribiste tú)
export function parseName(name) {
  const bits = String(name || '')
    .trim()
    .split(/\s*,\s*|\s+y\s+/i)
    .filter(Boolean)
  if (!bits.length) return null
  const out = bits.map((b) => DAY_PARTS.find((p) => p.toLowerCase() === b.toLowerCase()))
  return out.every(Boolean) && new Set(out).size === out.length ? out : null
}

export function DayEditor({ data, setData, dayId, isNew, onBack }) {
  const saved = data.plan.find((d) => d.id === dayId)
  // Se edita una copia: nada cambia en tu plan hasta que pulsas Guardar
  const [day, setDay] = useState(() => (saved ? structuredClone(saved) : { id: dayId, name: 'Nuevo día', weekday: null, items: [] }))
  const [picker, setPicker] = useState(false)
  const [ask, setAsk] = useState(false)
  const [openIt, setOpenIt] = useState(null) // ejercicio con sus opciones abiertas
  // «Otro…»: nombre escrito a mano (también si el que ya tenía no sale de los grupos)
  const [custom, setCustom] = useState(() => !!saved && !parseName(saved.name))
  const base = saved || { id: dayId, name: 'Nuevo día', weekday: null, items: [] }
  const dirty = JSON.stringify(day) !== JSON.stringify(base)
  editGuard.dirty = dirty
  useEffect(() => () => {
    editGuard.dirty = false
  }, [])
  if (!saved && !isNew) return null
  const patchDay = (p) => setDay((d) => ({ ...d, ...p }))
  const patchItem = (id, p) => setDay((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const sel = custom ? [] : parseName(day.name) || []
  const togglePart = (p) => {
    const next = sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p]
    setCustom(false)
    patchDay({ name: composeName(next) || 'Nuevo día' })
  }
  const writeOwn = () => {
    setCustom(true)
    if (day.name === 'Nuevo día') patchDay({ name: '' })
  }
  const save = () => {
    const fixed = { ...day, name: day.name.trim() || 'Nuevo día', items: day.items.map((i) => ({ ...i, sets: Math.max(1, Math.min(50, Number(i.sets) || 1)) })) }
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
    if (!confirm(isNew ? '¿Descartar este día nuevo?' : `¿Borrar el día "${day.name.trim()}"?`)) return
    if (!isNew) setData((d) => ({ ...d, plan: d.plan.filter((x) => x.id !== dayId) }))
    discard()
  }
  return (
    <div className={'page' + (dirty ? ' has-savebar' : '')}>
      <button className="link" onClick={leave}>
        <Icon name="left" size={18} /> Volver
      </button>
      <h2>{isNew ? 'Nuevo día' : 'Editar día'}</h2>
      <label className="lbl" id="day-name-lbl">
        Nombre
      </label>
      <div className="chips wrap day-parts" role="group" aria-labelledby="day-name-lbl">
        {DAY_PARTS.map((p) => (
          <button key={p} type="button" className={'chip sm' + (sel.includes(p) ? ' on' : '')} aria-pressed={sel.includes(p)} onClick={() => togglePart(p)}>
            {p}
          </button>
        ))}
        <button type="button" className={'chip sm' + (custom ? ' on' : '')} aria-pressed={custom} onClick={writeOwn}>
          Otro…
        </button>
      </div>
      {custom ? (
        <input
          className="inp"
          aria-label="Nombre del día"
          placeholder="Escribe el nombre"
          autoFocus={!saved || parseName(saved.name)}
          value={day.name}
          onChange={(e) => patchDay({ name: e.target.value })}
        />
      ) : (
        <p className="muted small day-name-prev">{sel.length ? <>Se llamará «{day.name}». Toca más grupos para combinarlos.</> : 'Elige uno o varios grupos, o «Otro…» para escribirlo.'}</p>
      )}
      <label className="lbl">Día de la semana</label>
      <select
        className="inp"
        aria-label="Día de la semana"
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
      {day.items.length > 0 && <p className="muted small mo-b2">Toca un ejercicio para el descanso, la intensidad, drop set, unilateral, el orden o quitarlo.</p>}
      {day.items.map((it, idx) => {
        const ex = EX_BY_ID[it.ex]
        const open = openIt === it.id
        const uniOn = !!(it.uni ?? data.uniEx?.[it.ex])
        const extra = [it.rest ? `descanso ${restTxt(it.rest)}` : null, it.rir != null ? `RIR ${it.rir}` : null, it.drop ? 'drop set' : null, uniOn ? 'por lados' : null].filter(Boolean)
        return (
          <div className={'card ed-item' + (open ? ' open' : '')} key={it.id}>
            <div className="ed-row">
              <button type="button" className="ed-id" onClick={() => setOpenIt(open ? null : it.id)} aria-expanded={open} aria-label={`${ex?.name || it.ex}: más opciones`}>
                <span className="ed-n">{idx + 1}</span>
                <Thumb ex={ex} size={36} />
                <span className="ed-t">
                  <b>{ex?.name || it.ex}</b>
                  {extra.length > 0 && <span className="muted small">{extra.join(' · ')}</span>}
                </span>
              </button>
              <div className="ed-sr">
                <input
                  className="inp sm"
                  inputMode="numeric"
                  aria-label="Series"
                  value={it.sets}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    // se puede borrar y escribir libremente; se corrige al salir del campo
                    const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                    patchItem(it.id, { sets: v === '' ? '' : Math.min(50, Number(v)) })
                  }}
                  onBlur={() => !(Number(it.sets) >= 1) && patchItem(it.id, { sets: 1 })}
                />
                <span className="x">×</span>
                <input className="inp sm ed-reps" aria-label="Reps / objetivo" value={it.reps} onChange={(e) => patchItem(it.id, { reps: e.target.value })} />
              </div>
              <button type="button" className="ed-chev" onClick={() => setOpenIt(open ? null : it.id)} aria-label={open ? 'Cerrar opciones' : 'Más opciones'}>
                <Icon name={open ? 'up' : 'down'} size={18} />
              </button>
            </div>
            {open && (
              <div className="ed-more">
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
                <label className="chk-l">
                  <input type="checkbox" checked={!!it.drop} onChange={(e) => patchItem(it.id, { drop: e.target.checked })} />
                  Drop set
                </label>
                <label className="chk-l">
                  <input type="checkbox" checked={uniOn} onChange={(e) => patchItem(it.id, { uni: e.target.checked })} />
                  Unilateral (reps de cada lado)
                </label>
                <div className="ed-acts">
                  <button className="btn sm-btn" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Subir">
                    <Icon name="up" size={16} /> Subir
                  </button>
                  <button className="btn sm-btn" onClick={() => move(idx, 1)} disabled={idx === day.items.length - 1} aria-label="Bajar">
                    <Icon name="down" size={16} /> Bajar
                  </button>
                  <button className="btn sm-btn danger" onClick={() => patchDay({ items: day.items.filter((i) => i.id !== it.id) })} aria-label="Quitar">
                    <Icon name="trash" size={16} /> Quitar
                  </button>
                </div>
              </div>
            )}
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
          <p className="muted">Has cambiado “{day.name.trim()}”. Si sales sin guardar, tu plan se queda como estaba.</p>
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
