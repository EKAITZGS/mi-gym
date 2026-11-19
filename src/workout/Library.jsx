// Ficha de ejercicio y biblioteca (selector, búsqueda, filtros, ejercicios propios).
import { useEffect, useMemo, useState } from 'react'
import { EXERCISES, GROUPS } from '../data/exercises'
import { uid, exStats, fmtKg, TRACKS, setTxt } from '../store'
import { Modal, Thumb, LineChart, ExPhoto } from '../ui'
import { techFor, errorsFor } from '../data/technique'
import { progressRead } from '../stats'
import { exHistory } from '../progression'
import Icon from '../icons'
import { State, ListRow } from '../ds'

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
  const read = useMemo(() => progressRead(exHistory(data.sessions, ex.id, data.plan)), [data.sessions, data.plan, ex.id])
  const history = useMemo(() => {
    const out = []
    for (let i = data.sessions.length - 1; i >= 0 && out.length < (allHist ? 200 : 5); i--) {
      const sets = data.sessions[i].entries?.[ex.id]
      if (sets) out.push({ date: data.sessions[i].date, sets })
    }
    return out
  }, [data.sessions, ex.id, allHist])
  const nHist = useMemo(() => data.sessions.filter((s) => s.entries?.[ex.id]).length, [data.sessions, ex.id])
  // variantes: mismo grupo y mismo músculo principal (primero los de siempre, luego los demás de la base)
  const variants = useMemo(
    () =>
      (() => {
        // primero el mismo tipo de movimiento (misma clave de técnica), luego los de siempre y por nombre
        const tech = techFor(ex)
        return EXERCISES.filter((e) => e.id !== ex.id && e.group === ex.group && e.main?.[0] === ex.main?.[0])
          .sort((a, b) => (techFor(b) === tech) - (techFor(a) === tech) || !!a.more - !!b.more || a.name.localeCompare(b.name, 'es'))
          .slice(0, 6)
      })(),
    [ex.id]
  )
  const [vOpen, setVOpen] = useState(null)
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
        <>
          <p className="tech small">
            <b>Técnica:</b> {techFor(ex)}
          </p>
          <div className="ex-errs">
            <b className="ex-sub">Errores habituales</b>
            <ul>
              {errorsFor(ex).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </>
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
            {read.kind !== 'few' && <span className={'prog-kind ' + read.kind}>{{ weight: 'Progresas en peso', reps: 'Progresas en repeticiones', volume: 'Más volumen', flat: 'Estable', down: 'Por debajo' }[read.kind]}.</span>} {read.text}
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
      {history.length === 0 ? (
        <State icon="trend" title="Aún sin registros" text="Cuando lo hagas, aquí verás tu mejor serie, la gráfica de fuerza y cada sesión." />
      ) : (
        <h4>Historial</h4>
      )}
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
      {variants.length > 0 && (
        <>
          <h4>Variantes</h4>
          <div className="ex-vars">
            {variants.map((v) => (
              <ListRow key={v.id} thumb={<Thumb ex={v} size={40} />} title={v.name} sub={v.equip} onClick={() => setVOpen(v)} />
            ))}
          </div>
        </>
      )}
      {vOpen && <ExerciseModal ex={vOpen} data={data} setData={setData} onClose={() => setVOpen(null)} />}
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
      <div className="chips bleed lib-groups">
        {['Todos', ...(favs.length ? ['★'] : []), ...GROUPS, 'Cardio', 'Estiramientos'].map((g) => (
          <button key={g} className={'chip' + (g === group ? ' on' : '')} onClick={() => setGroup(g)}>
            {g === '★' ? '★ Favoritos' : g}
          </button>
        ))}
      </div>
      {more && (
        <div className="lib-filters">
          <div className="chips bleed lib-equip">
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
      <p className="muted small lib-count">{list.length} {list.length === 1 ? 'ejercicio' : 'ejercicios'}</p>
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
