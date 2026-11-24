// Entreno en curso: series, descanso, cabecera, check-in y resumen al terminar.
import { useEffect, useState } from 'react'
import { EX_BY_ID } from '../data/exercises'
import { uid, lastSets, prefillSets, exStats, suggestion, fmtKg, num, pad, TRACKS, trackOf, setFilled, setTxt, todayStr } from '../store'
import { Modal, Thumb } from '../ui'
import { techFor } from '../data/technique'
import { nightsOf } from '../stats'
import Icon from '../icons'
import { FEELINGS, ZONES, adviceFor, painFor, needsDeload } from '../coach'
import { queueTrainerNote, cloudMeta } from '../cloud'
import { SyncPill, Badge, fmtMin, IconButton, ListRow } from '../ds'
import { restTxt, kgIn, repIn, setsVol, setsTxt } from './shared'
import { ExerciseModal, Library } from './Library'
import AiExport from '../AiExport'
import { compareSets, compareTag, compareTxt, preFatigue, liveFatigue, fatigueNote, setTargets, targetsTxt, pairCmp } from '../progression'

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
      <p className="muted small mt-0">
        Con esto ajusto los consejos y te aviso en los próximos entrenos.
      </p>
      <h4>Sensación del entreno</h4>
      <div className="feels">
        {FEELINGS.map((f) => (
          <button key={f.id} className={'feel' + (feel === f.id ? ' on' : '')} data-l={f.id} onClick={() => setFeel(f.id)} aria-pressed={feel === f.id}>
            <span className="fe-bars" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((k) => (
                <i key={k} className={k <= f.id ? 'on' : ''} />
              ))}
            </span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <h4>¿Cómo dormiste anoche?</h4>
      {night && <p className="muted small mt-neg">Según el reloj: {Math.floor(night.total / 60)} h {night.total % 60} min</p>}
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
          <p className="muted small mt-neg">
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
          <div className="seg mt-3">
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
function RestTimer({ rest, onAdd, onPause, onClose, next }) {
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
      <span className="rest-main">
        <span className="rest-t">{left > 0 ? `${Math.floor(left / 60)}:${pad(left % 60)}` : '¡Siguiente serie!'}</span>
        <span className="rest-sub">
          {left > 0 ? (paused ? 'en pausa' : 'descanso') : ''}
          {next ? `${left > 0 ? ' · ' : ''}${next}` : ''}
        </span>
      </span>
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
function SesHead({ a, items, cloud, online, onGo }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])
  const mins = a.start ? Math.max(0, Math.round((Date.now() - a.start) / 60000)) : null
  let total = 0, done = 0
  for (const it of items) {
    const sets = a.entries?.[it.ex] || []
    for (const s of sets) {
      if (s.warm) continue
      total++
      if (s.done || s.r || s.r2 || s.s || s.m || s.km || s.min) done++
    }
  }
  // lo que toca ahora: primera serie sin hacer
  let now = null
  for (const it of items) {
    const sets = a.entries?.[it.ex] || []
    const k = sets.findIndex((s) => !(s.done || s.r || s.r2 || s.s || s.m || s.km || s.min))
    if (k >= 0) {
      now = { it, k, n: sets.length }
      break
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
      </div>
      <SyncPill cloud={cloud} online={online} />
      {now ? (
        <button type="button" className="ses-now" onClick={() => onGo?.(now.it.id)}>
          <span className="ses-now-l">Ahora</span>
          <span className="ses-now-t">{EX_BY_ID[now.it.ex]?.name || 'Ejercicio'}</span>
          <span className="ses-now-s">
            serie {now.k + 1}/{now.n}
          </span>
          <Icon name="down" size={16} />
        </button>
      ) : (
        total > 0 && <div className="ses-now done">Todo hecho: termina el entreno abajo</div>
      )}
    </div>
  )
}
const lastNote = (sessions, exId) => {
  for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].notes?.[exId]) return sessions[i].notes[exId]
  return null
}
export function Session({ data, setData, onExit, cloud, online }) {
  const a = data.active
  const day = a ? data.plan.find((d) => d.id === a.dayId) : null
  const items = a?.items || day?.items || []
  const name = a?.name || day?.name || 'Entreno'
  const [detail, setDetail] = useState(null)
  const [picker, setPicker] = useState(null) // { mode: 'add' } | { mode: 'swap', itemId }
  const [ax, setAx] = useState(false)
  const [done, setDone] = useState(null) // { prs, changed, items, dayId, name } al terminar
  const [exMenu, setExMenu] = useState(null) // id del ejercicio con su menú abierto
  const [setMenu, setSetMenu] = useState(null) // { ex, i } serie con su menú abierto
  const goEx = (id) => {
    document.getElementById('ex-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
              <h4 className="mt-0">Para tu próximo entreno</h4>
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
              {done.cmp.map((c) => {
                // con más fatiga que la otra vez, rendir menos no se marca como peor
                const excused = c.tired?.more && (c.kind === 'down' || c.kind === 'mixed')
                const tone = excused ? 'tired' : c.kind === 'up' ? 'up' : c.kind === 'down' ? 'down' : 'flat'
                return (
                  <div className="cmp" key={c.name}>
                    <div className="cmp-h">
                      <b>{c.name}</b>
                      {c.tag ? (
                        <span className={tone}>{excused ? 'Con fatiga' : c.tag}</span>
                      ) : (
                        c.d != null && <span className={c.d >= 0 ? 'up' : 'down'}>{c.d > 0 ? '+' : ''}{c.d} %</span>
                      )}
                    </div>
                    <div className="muted small">Hoy: {c.now}</div>
                    <div className="muted small">{c.prev ? `Antes: ${c.prev}` : 'Primera vez que lo registras'}</div>
                    {c.tag && (
                      <div className="muted small">
                        Serie a serie: {c.txt}
                        {c.sets ? ` · hoy\u00a0${c.sets}` : ''}
                      </div>
                    )}
                    {c.tired && c.kind && (
                      <div className="muted small cmp-tired">
                        Hoy lo hiciste {c.tired.text}
                        {excused
                          ? '. Rendir algo menos así es normal: no es un retroceso.'
                          : c.tired.more
                            ? c.kind === 'up'
                              ? ', y aun así mejoraste.'
                              : ', e igualaste: buen resultado.'
                            : c.kind === 'up'
                              ? ': parte de la mejora puede venir de ahí.'
                              : '.'}
                      </div>
                    )}
                  </div>
                )
              })}
              <p className="muted small">
                Cada serie se compara con la misma de la última vez (con otro peso, por el 1RM estimado) y se tiene en cuenta el orden: después de otros
                ejercicios de los mismos músculos se rinde menos.
              </p>
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
          <button className="link small month-link" onClick={() => setAx(true)}>
            <Icon name="chat" size={15} /> Pedir opinión a Claude o ChatGPT
          </button>
          <button className="btn primary full" onClick={onExit}>
            Listo
          </button>
          {ax && <AiExport data={data} setData={setData} kind="last" onClose={() => setAx(false)} />}
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

  // `touch` = cuándo empezaste cada ejercicio (primera serie con algo hecho): da el orden real en que los hiciste
  const patchSet = (exId, si, fn) =>
    setData((d) => {
      if (!d.active) return d
      // hora de cada serie (`t`, ms): al marcarla hecha (= al terminarla) o, si no la marcas, al apuntar sus reps;
      // con ella se cruza el pulso del reloj para saber en qué ejercicio subes más
      const filled = (x) => x.done || x.r || x.r2 || x.s || x.m || x.km || x.min
      const list = d.active.entries[exId].map((s, i) => {
        if (i !== si) return s
        const n = fn(s)
        if (n.done && !s.done) return { ...n, t: Date.now() }
        if (!n.t && filled(n) && !filled(s)) return { ...n, t: Date.now() }
        return n
      })
      const started = list.some((x) => x.done || x.r || x.r2 || x.s || x.m || x.km || x.min)
      const touch = started && !d.active.touch?.[exId] ? { ...(d.active.touch || {}), [exId]: Date.now() } : d.active.touch
      return { ...d, active: { ...d.active, entries: { ...d.active.entries, [exId]: list }, ...(touch ? { touch } : {}) } }
    })

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
          const base = { w: s.w || '', r: s.r || '', ...extra, drops, ...(s.warm ? { warm: true } : {}), ...(s.t ? { t: s.t } : {}) }
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
    // orden real en que los hiciste (el primero que empezaste primero; los no tocados, por la lista); se guarda en `order`
    const touch = a.touch || {}
    const pos = (k) => items.findIndex((i) => i.ex === k)
    const order = Object.keys(entries).sort((x, y) => (touch[x] ?? Infinity) - (touch[y] ?? Infinity) || pos(x) - pos(y))
    const today = { entries, order }
    // comparación con la última vez de cada ejercicio (data.sessions aún no incluye el de hoy): serie a serie y con la fatiga previa
    const cmp = order.map((exId) => {
      const sets = entries[exId]
      const prev = lastSets(data.sessions, exId)
      const pv = prev ? setsVol(prev.sets) : 0
      const c = prev ? compareSets(prev.sets, sets) : null
      const tired = prev ? fatigueNote(preFatigue(today, exId), preFatigue(prev.ses, exId, data.plan)) : null
      return {
        name: EX_BY_ID[exId]?.name || exId,
        now: setsTxt(sets),
        prev: prev && setsTxt(prev.sets),
        d: pv > 0 ? Math.round((setsVol(sets) / pv - 1) * 100) : null,
        kind: c?.n ? c.kind : null,
        sets: c ? (c.missing ? `${c.missing}\u00a0${c.missing === 1 ? 'serie' : 'series'}\u00a0menos` : c.extra ? `${c.extra}\u00a0${c.extra === 1 ? 'serie' : 'series'}\u00a0más` : '') : '',
        tag: compareTag(c),
        txt: compareTxt(c),
        tired,
      }
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
    // si tiene entrenador, le llega un aviso (va en cola si no hay cobertura)
    queueTrainerNote(
      `${cloudMeta()?.name || 'Tu alumno'} ha terminado ${String(name).trim()}: ${nEx} ejercicio${nEx === 1 ? '' : 's'}, ${nSets} series${min ? `, ${min} min` : ''}${prs.length ? `, ${prs.length} récord${prs.length === 1 ? '' : 's'} 🏆` : ''}`,
      { sid, date: a.date }
    )
    setData((d) => ({
      ...d,
      active: null,
      sessions: [...d.sessions, { id: sid, date: a.date, dayId: a.dayId, dayName: name, entries, ...(order.length > 1 ? { order } : {}), ...(a.start ? { start: a.start } : {}), ...(Object.keys(notes).length ? { notes } : {}), ...(min ? { min } : {}) }],
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
      <SesHead a={a} items={items} cloud={cloud} online={online} onGo={goEx} />
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
        // fatiga con la que lo haces hoy (por el orden) frente a la última vez: con bastante más, el objetivo es igualar
        const tired = last ? fatigueNote(liveFatigue(items, a.entries, a.touch, it.ex), preFatigue(last.ses, it.ex, data.plan)) : null
        const sug = s0?.action === 'up' && !tired?.more ? s0 : null
        const hold = s0?.action === 'hold' ? s0 : null
        // objetivo de cada serie según lo que hiciste en esa misma serie la otra vez
        const prevWork = last ? last.sets.filter((x) => !x.warm && num(x.r) > 0) : []
        const targets = tr === 'reps' && last && !pain ? setTargets(last.sets, it.reps, ex?.equip, { rir: last.ses?.checkin?.rir?.[it.ex], fatigue: tired }) : null
        const workIdx = (i) => sets.slice(0, i).filter((x) => !x.warm).length
        // referencia: solo el PESO de la última vez. Las reps de hoy empiezan vacías y nunca se copian.
        const phOf = (i) => {
          const b0 = last?.sets[i] || last?.sets[last.sets.length - 1] || {}
          return { w: b0.w, drops: (b0.drops || []).map((x) => ({ w: x.w })) }
        }
        const note = lastNote(data.sessions, it.ex)
        const first = items[0]?.id === it.id
        return (
          <div className="card ex-card" key={it.id} id={'ex-' + it.id}>
            <div className="ex-top">
              <button type="button" className="ex-id" onClick={() => ex && setDetail(ex)} aria-label={`Ficha de ${ex?.name || it.ex}`}>
                <Thumb ex={ex} />
                <span className="ex-id-t">
                  <b>{ex?.name || it.ex}</b>
                  <span className="muted small">
                    {tr === 'reps' ? `${it.sets}×${it.reps}` : `${it.sets} series · ${T.label.toLowerCase()}`}
                    {it.drop ? ' · drop set' : ''}
                    {it.rir != null ? ` · RIR ${it.rir}` : ''}
                    {it.rest ? ` · descanso ${restTxt(it.rest)}` : ''}
                    {uni ? ' · por lados' : ''}
                  </span>
                </span>
              </button>
              <IconButton icon="more" label={`Opciones de ${ex?.name || 'este ejercicio'}`} ghost onClick={() => setExMenu(it.id)} />
            </div>
            {last && (
              <div className="ex-last">
                Última vez ({last.date.slice(8)}/{last.date.slice(5, 7)}): <b>{last.sets.map(setTxt).join(', ')}</b>
              </div>
            )}
            {targets && (
              <div className="ex-last ex-target">
                Objetivo hoy: <b>{tired?.more ? 'igualar ' : ''}{targetsTxt(targets)}</b>
              </div>
            )}
            {tired && (
              <div className="muted small ex-tired">
                Hoy lo haces {tired.text}
                {tired.more ? ': igualar ya es buen resultado y la subida de peso puede esperar.' : ': buen día para superarte.'}
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
            {note && <div className="muted small ex-note">Nota anterior: {note}</div>}
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
            {ex && !ex.custom && (
              <details className="tech-d">
                <summary>Técnica</summary>
                <p>{techFor(ex)}</p>
              </details>
            )}
            {uni && sets.length > 0 && (
              <div className="setrow uni-head">
                <span className="setn" />
                <span className="uh">kg</span>
                <span className="x is-hidden">kg</span>
                <span className="uh">Izq</span>
                <span className="uh">Der</span>
                <span className="chk-sp" />
              </div>
            )}
            {sets.map((s, i) => {
              const ph = phOf(i)
              const wi = workIdx(i)
              const tg = !s.warm ? targets?.[wi] : null
              // reps objetivo para el peso que tienes puesto: el del objetivo → sus reps; el de la otra vez → igualar o superar
              const wNow = num(s.w || ph.w)
              const pv = prevWork[wi]
              const repPh = !tg ? null : wNow >= tg.w - 0.01 ? tg.r : pv && Math.abs(wNow - num(pv.w)) < 0.01 ? num(pv.r) : null
              // ¿esta serie ya supera a la misma serie de la otra vez?
              const rNow = uni && s.r && s.r2 ? Math.min(num(s.r), num(s.r2)) : num(s.r) || num(s.r2)
              const beat = !s.warm && tr === 'reps' && rNow > 0 && prevWork[wi] && pairCmp(prevWork[wi], { w: s.w || ph.w, r: rNow }) > 0
              return (
                <div key={i}>
                  <div className={'setrow' + (s.warm ? ' warm' : '')}>
                    <button
                      type="button"
                      className={'setn' + (beat ? ' beat' : '')}
                      title={s.warm ? 'Calentamiento' : beat ? 'Mejor que la misma serie la última vez' : undefined}
                      aria-label={`Opciones de la serie ${i + 1}${s.warm ? ' (calentamiento)' : ''}${beat ? ' (mejor que la última vez)' : ''}`}
                      onClick={() => setSetMenu({ ex: it.ex, i })}
                    >
                      {s.warm ? 'C' : i + 1}
                    </button>
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
                      aria-label={uni ? 'Reps izquierdo' : repPh ? `${T.b[1]} (objetivo ${repPh})` : T.b[1]}
                      placeholder={uni ? 'izq' : repPh ? String(repPh) : T.b[1]}
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
                        aria-label="Quitar drop"
                        onClick={() => patchSet(it.ex, i, (x) => ({ ...x, drops: x.drops.filter((_, k) => k !== j) }))}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
            <div className="ex-foot">
              <button type="button" className="btn sm-btn ghost" onClick={() => addSet(it.ex)}>
                <Icon name="plus" size={15} /> Serie
              </button>
              {first && sets.length > 0 && <span className="muted small">Toca el número de una serie para drop, calentamiento o quitarla</span>}
            </div>
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
      {rest && (
        <RestTimer
          rest={rest}
          onAdd={addRest}
          onPause={pauseRest}
          onClose={() => setRest(null)}
          next={(() => {
            // qué toca después del descanso: la siguiente serie de ese ejercicio o el siguiente ejercicio
            const k0 = items.findIndex((x) => x.id === rest.item)
            for (let k = Math.max(0, k0); k < items.length; k++) {
              const ss = a.entries[items[k].ex] || []
              const j = ss.findIndex((x) => !(x.done || x.r || x.r2 || x.s || x.m || x.km || x.min))
              if (j >= 0) return k === k0 ? `serie ${j + 1}/${ss.length}` : EX_BY_ID[items[k].ex]?.name || 'siguiente ejercicio'
            }
            return ''
          })()}
        />
      )}
      {exMenu &&
        (() => {
          const it = items.find((x) => x.id === exMenu)
          if (!it) return null
          const ex = EX_BY_ID[it.ex]
          const tr = trackOf(it, ex)
          const close = () => setExMenu(null)
          return (
            <Modal title={ex?.name || 'Ejercicio'} onClose={close}>
              <div className="menu-list">
                <ListRow icon="swap" title="Cambiar por otro ejercicio" onClick={() => (close(), setPicker({ mode: 'swap', itemId: it.id }))} />
                <ListRow icon="plus" title="Añadir una serie" onClick={() => (close(), addSet(it.ex))} />
                {ex && <ListRow icon="book" title="Ver ficha, historial y técnica" onClick={() => (close(), setDetail(ex))} />}
              </div>
              <h4>Ajustes del ejercicio</h4>
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
                <button className={'uni-tg' + (uniOf(it) ? ' on' : '')} onClick={() => toggleUni(it)}>
                  <span className="uni-dot" /> {uniOf(it) ? 'Por lados: izquierdo / derecho' : 'Unilateral (un lado y luego otro)'}
                </button>
              )}
              <button className="btn danger full mt-4" onClick={() => confirm('¿Quitar este ejercicio de hoy?') && (close(), removeItem(it.id))}>
                <Icon name="x" size={16} /> Quitar de hoy
              </button>
            </Modal>
          )
        })()}
      {setMenu &&
        (() => {
          const ss = a.entries[setMenu.ex] || []
          const st = ss[setMenu.i]
          const it = items.find((x) => x.ex === setMenu.ex)
          if (!st || !it) return null
          const tr = trackOf(it, EX_BY_ID[it.ex])
          const close = () => setSetMenu(null)
          const { ex: exId, i } = setMenu
          return (
            <Modal title={`Serie ${i + 1} · ${EX_BY_ID[exId]?.name || 'ejercicio'}`} onClose={close}>
              <div className="menu-list">
                <ListRow icon="plus" title="Añadir drop set" sub="Bajas el peso y sigues sin descansar" onClick={() => (close(), patchSet(exId, i, (x) => ({ ...x, drops: [...x.drops, { w: '', r: '' }] })))} />
                {tr === 'reps' && (
                  <ListRow
                    icon="flame"
                    title={st.warm ? 'Quitar marca de calentamiento' : 'Marcar como calentamiento'}
                    sub="El calentamiento no cuenta en volumen ni récords"
                    onClick={() => (close(), patchSet(exId, i, (x) => ({ ...x, warm: !x.warm })))}
                  />
                )}
                {ss.length > 1 && <ListRow icon="trash" title="Quitar esta serie" className="danger-row" onClick={() => (close(), removeSet(exId, i))} />}
              </div>
            </Modal>
          )
        })()}
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
