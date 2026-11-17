// Panel de administración de MI-GYM (admin.html). Solo lectura.
// Quién es administrador lo decide Supabase (tabla `admins` de supabase/06-admin.sql); la app solo pregunta.
import { useEffect, useMemo, useRef, useState } from 'react'
import { cloudReady, cloudMeta, signIn, adminCheck, adminUsers, adminUserData, sessionUser, authSignOut } from '../cloud'
import Icon from '../icons'
import { SessionCard, fmtDay, hasSet, nameFor } from '../DayDetail'
import PolarSession, { HrSpark } from '../PolarSession'
import { exStats, fmtKg, WEEKDAYS, todayStr, addDays } from '../store'
import { progressRead } from '../stats'
import { Badge, State } from '../ds'

const dShort = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const ago = (iso) => {
  if (!iso) return 'nunca'
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 60) return m < 1 ? 'ahora' : `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  const d = Math.round(m / 1440)
  return d < 31 ? `hace ${d} ${d === 1 ? 'día' : 'días'}` : dShort(iso)
}
const daysAgo = (ymd) => (ymd ? Math.round((Date.parse(todayStr()) - Date.parse(ymd)) / 864e5) : null)
const lastTxt = (ymd) => {
  const n = daysAgo(ymd)
  if (n == null) return '—'
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : n < 31 ? `hace ${n} días` : fmtDay(ymd)
}
const roleTxt = (r) => (r === 'trainer' ? 'Entrenador' : 'Usuario')
const initial = (u) => ((u.name || u.email || '?').trim()[0] || '?').toUpperCase()

export default function AdminApp() {
  // loading | login | noadmin | nosql | ok | error
  const [phase, setPhase] = useState('loading')
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const check = async () => {
    setPhase('loading')
    try {
      const u = await sessionUser()
      if (!u) return setPhase('login')
      setMe(u)
      const ok = await adminCheck()
      setPhase(ok == null ? 'nosql' : ok ? 'ok' : 'noadmin')
    } catch (e) {
      setErr(e.message)
      setPhase('error')
    }
  }
  useEffect(() => {
    if (cloudReady()) check()
    else setPhase('nocloud')
  }, [])
  // si la app está abierta en este navegador, cerrar sesión aquí la cerraría también allí
  const appHere = !!cloudMeta()?.uid
  const out = async () => {
    if (!confirm('¿Cerrar sesión en este navegador?')) return
    await authSignOut()
    setMe(null)
    setPhase('login')
  }

  // panel de ordenador: en pantallas pequeñas se avisa (y se puede abrir igualmente)
  const [wide, setWide] = useState(() => window.innerWidth >= 1000)
  const [force, setForce] = useState(false)
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 1000)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (!wide && !force)
    return (
      <div className="adm-narrow">
        <img src="./logo.svg" alt="" width="56" height="56" />
        <h1>Panel para ordenador</h1>
        <p className="muted">La administración de MI-GYM está pensada para una pantalla grande. Ábrela desde el PC en:</p>
        <p className="adm-url">ekaitzgs.github.io/mi-gym/admin.html</p>
        <a className="btn primary full" href="./">
          Volver a la app
        </a>
        <button className="link small" onClick={() => setForce(true)}>
          Abrir igualmente
        </button>
      </div>
    )

  return (
    <div className="adm">
      <aside className="adm-side">
        <a className="adm-brand" href="./">
          <img src="./logo.svg" alt="" />
          <span>
            MI-GYM
            <small>Administración</small>
          </span>
        </a>
        <nav className="adm-nav" aria-label="Secciones">
          <span className="adm-nav-i on">
            <Icon name="users" size={18} /> Usuarios
          </span>
        </nav>
        <div className="adm-side-foot">
          {me && <div className="adm-email">{me.email}</div>}
          <a className="adm-nav-i" href="./">
            <Icon name="home" size={18} /> Abrir la app
          </a>
          {me && !appHere && (
            <button className="adm-nav-i" onClick={out}>
              <Icon name="logout" size={18} /> Cerrar sesión
            </button>
          )}
        </div>
      </aside>
      <main className="adm-main">
        {phase === 'loading' && <p className="muted">Cargando…</p>}
        {phase === 'nocloud' && <State icon="cloud" title="Sin nube" text="Esta versión de la app no tiene cuentas configuradas." />}
        {phase === 'login' && <Login onDone={check} />}
        {phase === 'noadmin' && (
          <State icon="shield" title="Tu cuenta no es administradora" text="El acceso lo da el propietario desde Supabase. Si crees que es un error, pídeselo." />
        )}
        {phase === 'nosql' && (
          <State icon="info" title="Falta activar el panel" text="Ejecuta supabase/06-admin.sql en Supabase (SQL Editor) y añade tu cuenta a la tabla de administradores." action="Volver a comprobar" onAction={check} />
        )}
        {phase === 'error' && <State icon="offline" error title="No se pudo cargar" text={err} action="Reintentar" onAction={check} />}
        {phase === 'ok' && <Users meId={me?.id} />}
      </main>
    </div>
  )
}

function Login({ onDone }) {
  const [f, setF] = useState({ email: '', pass: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const go = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      await signIn(f.email, f.pass)
      onDone()
    } catch (x) {
      setMsg(x.message)
    }
    setBusy(false)
  }
  return (
    <form className="card adm-login" onSubmit={go}>
      <h2>Entrar</h2>
      <p className="muted small">Con tu cuenta de MI-GYM. Solo las cuentas administradoras ven el panel.</p>
      <label className="lbl">Email</label>
      <input className="inp" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label className="lbl">Contraseña</label>
      <input className="inp" type="password" autoComplete="current-password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} />
      {msg && <div className="advice yellow sm">{msg}</div>}
      <button className="btn primary full" disabled={busy || !f.email || !f.pass} style={{ marginTop: 12 }}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

// columnas: [clave, título, valor para ordenar, numérica]
const COLS = [
  ['name', 'Usuario', (u) => (u.name || u.email || '').toLowerCase()],
  ['role', 'Tipo', (u) => u.role || ''],
  ['created_at', 'Alta', (u) => u.created_at || ''],
  ['last_sign_in_at', 'Última conexión', (u) => u.last_sign_in_at || ''],
  ['last_session', 'Último entreno', (u) => u.last_session || ''],
  ['sessions_30d', 'Entrenos 30 d', (u) => u.sessions_30d || 0, true],
  ['sessions', 'Total', (u) => u.sessions || 0, true],
  ['plan_days', 'Días de rutina', (u) => u.plan_days || 0, true],
  ['has_polar', 'Reloj', (u) => (u.has_polar ? 1 : 0)],
]
const FILTERS = [
  ['all', 'Todos'],
  ['active', 'Activos 30 días'],
  ['inactive', 'Sin entrenar 30 días'],
  ['trainer', 'Entrenadores'],
]

function Users({ meId }) {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ k: 'last_sign_in_at', desc: true })
  const [open, setOpen] = useState(null)
  const searchRef = useRef(null)
  const load = () => {
    setErr('')
    adminUsers()
      .then(setList)
      .catch((e) => setErr(e.message))
  }
  useEffect(load, [])

  const kpi = useMemo(() => {
    const L = list || []
    const since7 = addDays(todayStr(), -7)
    return {
      users: L.length,
      trainers: L.filter((u) => u.role === 'trainer').length,
      active7: L.filter((u) => u.last_session && u.last_session >= since7).length,
      w30: L.reduce((t, u) => t + (u.sessions_30d || 0), 0),
    }
  }, [list])

  const shown = useMemo(() => {
    const n = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const words = n(q).split(/\s+/).filter(Boolean)
    const out = (list || []).filter((u) => {
      if (filter === 'active' && !u.sessions_30d) return false
      if (filter === 'inactive' && u.sessions_30d) return false
      if (filter === 'trainer' && u.role !== 'trainer') return false
      const hay = n(`${u.name || ''} ${u.email || ''}`)
      return words.every((w) => hay.includes(w))
    })
    const col = COLS.find((c) => c[0] === sort.k) || COLS[0]
    const val = col[2]
    const dir = sort.desc ? -1 : 1
    return out.sort((a, b) => {
      const x = val(a), y = val(b)
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * dir
    })
  }, [list, q, filter, sort])
  const sortBy = (k) => setSort((s0) => (s0.k === k ? { k, desc: !s0.desc } : { k, desc: k !== 'name' && k !== 'role' }))

  // atajos de escritorio: / buscar · ↑ ↓ cambiar de usuario · Esc cerrar la ficha
  useEffect(() => {
    const onKey = (e) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape') {
        if (typing) document.activeElement.blur()
        else setOpen(null)
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !typing && shown.length) {
        e.preventDefault()
        const i = shown.findIndex((u) => u.id === open?.id)
        const j = i < 0 ? 0 : Math.max(0, Math.min(shown.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
        setOpen(shown[j])
        document.querySelector(`[data-uid="${shown[j].id}"]`)?.scrollIntoView({ block: 'nearest' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown, open])

  const csv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Nombre', 'Email', 'Tipo', 'Alta', 'Última conexión', 'Entrenos', 'Entrenos 30 días', 'Último entreno', 'Días de rutina', 'Reloj Polar'],
      ...shown.map((u) => [u.name, u.email, roleTxt(u.role), u.created_at?.slice(0, 10), u.last_sign_in_at?.slice(0, 10), u.sessions, u.sessions_30d, u.last_session, u.plan_days, u.has_polar ? 'sí' : 'no']),
    ]
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mi-gym-usuarios-${todayStr()}.csv`
    a.click()
  }

  if (err) return <State icon="offline" error title="No se pudo cargar la lista" text={err} action="Reintentar" onAction={load} />
  if (!list) return <p className="muted">Cargando usuarios…</p>

  return (
    <div className={'adm-grid' + (open ? ' has-detail' : '')}>
      <section className="adm-list">
        <div className="adm-head">
          <div>
            <h1 className="title">Usuarios</h1>
            <p className="muted small">
              {shown.length === list.length ? `${list.length} cuentas` : `${shown.length} de ${list.length} cuentas`}
              <span className="adm-keys">
                {' '}
                · <kbd>/</kbd> buscar · <kbd>↑</kbd>
                <kbd>↓</kbd> cambiar · <kbd>Esc</kbd> cerrar
              </span>
            </p>
          </div>
          <div className="adm-tools">
            <input ref={searchRef} className="inp" placeholder="Buscar por nombre o email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar usuario" />
            <button className="btn sm-btn" onClick={csv} title="Descargar la lista en CSV (Excel)">
              <Icon name="download" size={15} /> Exportar CSV
            </button>
            <button className="btn sm-btn" onClick={load} aria-label="Actualizar" title="Actualizar">
              <Icon name="refresh" size={15} />
            </button>
          </div>
        </div>
        <div className="adm-kpis">
          <div className="stat accent">
            <div className="st-v">{kpi.users}</div>
            <div className="st-l">cuentas</div>
          </div>
          <div className="stat">
            <div className="st-v">{kpi.active7}</div>
            <div className="st-l">entrenaron esta semana</div>
          </div>
          <div className="stat">
            <div className="st-v">{kpi.w30}</div>
            <div className="st-l">entrenos en 30 días</div>
          </div>
          <div className="stat">
            <div className="st-v">{kpi.trainers}</div>
            <div className="st-l">entrenadores</div>
          </div>
        </div>
        <div className="chips">
          {FILTERS.map(([v, l]) => (
            <button key={v} className={'chip sm' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        {!shown.length && <State icon="search" title="Sin resultados" text="Prueba con otra búsqueda o filtro." />}
        {shown.length > 0 && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  {COLS.map(([k, t, , num]) => (
                    <th key={k} className={num ? 'num' : ''} aria-sort={sort.k === k ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                      <button className={'adm-th' + (sort.k === k ? ' on' : '')} onClick={() => sortBy(k)}>
                        {t}
                        <span className="adm-arrow">{sort.k === k ? (sort.desc ? '↓' : '↑') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr
                    key={u.id}
                    data-uid={u.id}
                    className={open?.id === u.id ? 'on' : ''}
                    tabIndex={0}
                    onClick={() => setOpen(u)}
                    onKeyDown={(e) => e.key === 'Enter' && setOpen(u)}
                  >
                    <td>
                      <div className="adm-user">
                        <span className="adm-av">{initial(u)}</span>
                        <span className="grow">
                          <b>{u.name || 'Sin nombre'}</b>
                          {u.id === meId && <Badge tone="accent">tú</Badge>}
                          {u.admin && <Badge>admin</Badge>}
                          <span className="muted small adm-mail">{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td>{roleTxt(u.role)}</td>
                    <td>{dShort(u.created_at)}</td>
                    <td>{ago(u.last_sign_in_at)}</td>
                    <td className={u.last_session && daysAgo(u.last_session) <= 7 ? 'ok' : ''}>{lastTxt(u.last_session)}</td>
                    <td className="num">{u.sessions_30d || 0}</td>
                    <td className="num">{u.sessions || 0}</td>
                    <td className="num">{u.plan_days || 0}</td>
                    <td>{u.has_polar ? <span className="adm-yes">Polar</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && <UserDetail u={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function UserDetail({ u, onClose }) {
  const [st, setSt] = useState({ loading: true })
  const [tab, setTab] = useState('train')
  const [more, setMore] = useState(15)
  const [px, setPx] = useState(null)
  useEffect(() => {
    setSt({ loading: true })
    setTab('train')
    setMore(15)
    adminUserData(u.id)
      .then((r) => setSt({ row: r }))
      .catch((e) => setSt({ error: e.message }))
  }, [u.id])
  const d = st.row?.data
  const nameOf = useMemo(() => nameFor(d), [d])
  const sessions = useMemo(() => (d?.sessions || []).filter((s) => Object.values(s.entries || {}).some((l) => l.some(hasSet))).slice().reverse(), [d])
  const watch = useMemo(() => Object.values(d?.polar?.exercises || {}).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [d])
  const exRows = useMemo(() => {
    const all = d?.sessions || []
    const ids = [...new Set(all.flatMap((s) => Object.keys(s.entries || {})))]
    return ids
      .map((id) => {
        const stt = exStats(all, id)
        if (!stt.length) return null
        const last = stt[stt.length - 1]
        return { id, n: stt.length, best: Math.max(...stt.map((x) => x.best.e)), last, read: progressRead(stt) }
      })
      .filter(Boolean)
      .sort((a, b) => b.n - a.n)
  }, [d])
  const w = d?.body?.weight || []
  const waist = d?.body?.waist || []
  const KIND = { weight: 'Más peso', reps: 'Más reps', volume: 'Más volumen', flat: 'Estable', down: 'Bajón', few: 'Pocos datos' }

  return (
    <aside className="adm-detail card" aria-label={`Ficha de ${u.name || u.email}`}>
      <div className="adm-dhead">
        <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar ficha">
          <Icon name="x" size={18} />
        </button>
        <span className="adm-av big">{initial(u)}</span>
        <div className="grow">
          <div className="prof-name">{u.name || 'Sin nombre'}</div>
          <div className="muted small adm-mail">{u.email}</div>
          <div className="adm-badges">
            <Badge>{roleTxt(u.role)}</Badge>
            {u.admin && <Badge tone="accent">admin</Badge>}
            {u.has_polar && <Badge>Polar</Badge>}
          </div>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 6 }}>
        Alta {dShort(u.created_at)} · última conexión {ago(u.last_sign_in_at)} · datos guardados {ago(u.updated_at)}
      </p>

      {st.loading && <p className="muted small">Cargando…</p>}
      {st.error && <div className="advice yellow sm">{st.error}</div>}
      {!st.loading && !st.error && !d && <State icon="info" title="Sin datos" text="Esta cuenta aún no ha guardado nada en la app." />}
      {d && (
        <>
          <div className="adm-facts">
            <div>
              <b>{sessions.length}</b>
              <span>entrenos</span>
            </div>
            <div>
              <b>{lastTxt(sessions[0]?.date)}</b>
              <span>último entreno</span>
            </div>
            <div>
              <b>{w.length ? `${fmtKg(w[w.length - 1].kg)} kg` : '—'}</b>
              <span>{w.length ? `peso · ${fmtDay(w[w.length - 1].date)}` : 'peso'}</span>
            </div>
            <div>
              <b>{waist.length ? `${fmtKg(waist[waist.length - 1].cm)} cm` : '—'}</b>
              <span>{waist.length ? `cintura · ${fmtDay(waist[waist.length - 1].date)}` : 'cintura'}</span>
            </div>
          </div>

          <div className="seg adm-tabs">
            {[
              ['train', `Entrenos (${sessions.length})`],
              ['ex', 'Ejercicios'],
              ['plan', 'Rutina'],
              ['watch', `Reloj (${watch.length})`],
            ].map(([v, l]) => (
              <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'train' && (
            <>
              {!sessions.length && <p className="muted small">Aún no ha entrenado.</p>}
              {sessions.slice(0, more).map((s) => (
                <SessionCard key={s.id || s.date} s={s} nameOf={nameOf} watch={watch.filter((e) => e.date === s.date)} onHr={setPx} />
              ))}
              {sessions.length > more && (
                <button className="btn full" onClick={() => setMore(more + 30)}>
                  Ver más ({sessions.length - more})
                </button>
              )}
            </>
          )}

          {tab === 'ex' && (
            <div className="card list-card">
              {!exRows.length && <p className="muted small">Sin ejercicios registrados.</p>}
              {exRows.map((x) => (
                <div className="row nob li" key={x.id}>
                  <div className="grow">
                    <div className="li-t">{nameOf(x.id)}</div>
                    <div className="muted small">
                      {x.n} {x.n === 1 ? 'sesión' : 'sesiones'} · última {fmtKg(x.last.best.w)} kg × {x.last.best.r} ({fmtDay(x.last.date)}) · 1RM est. máx. {fmtKg(Math.round(x.best * 10) / 10)} kg
                    </div>
                  </div>
                  <span className={'prog-kind ' + x.read.kind}>{KIND[x.read.kind]}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'plan' && (
            <>
              {!(d.plan || []).length && <p className="muted small">No tiene rutina.</p>}
              {(d.plan || []).map((day) => (
                <div className="sv-card" key={day.id}>
                  <div className="sv-head">
                    <b>{day.name}</b>
                    <span className={'sv-chip' + (day.weekday != null ? ' on' : '')}>{day.weekday != null ? WEEKDAYS[day.weekday] : 'Sin día'}</span>
                  </div>
                  {(day.items || []).map((it) => (
                    <div className="sv-row" key={it.id}>
                      <span>{nameOf(it.ex)}</span>
                      <b>
                        {it.sets} × {it.reps}
                      </b>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {tab === 'watch' && (
            <>
              {!watch.length && <p className="muted small">{d.polar ? 'Aún no hay entrenos del reloj.' : 'No tiene reloj conectado.'}</p>}
              {watch.slice(0, 40).map((e) => (
                <button className="polar-ex" key={e.id} onClick={() => setPx(e)}>
                  <div className="grow">
                    <div className="li-t">
                      {e.sport} · {e.min} min
                    </div>
                    <div className="muted small">
                      {fmtDay(e.date)} · {e.time} · {e.kcal} kcal
                    </div>
                  </div>
                  <HrSpark hr={e.hr} />
                  <div className="polar-stats">{e.hrAvg ? <span><b>{e.hrAvg}</b>/{e.hrMax} ppm</span> : <span>sin pulso</span>}</div>
                </button>
              ))}
            </>
          )}
          {px && <PolarSession ex={px} data={d} them onClose={() => setPx(null)} />}
          <p className="muted small">Solo lectura: desde aquí no se cambia nada de la cuenta. No incluye dieta, sueño ni fotos.</p>
        </>
      )}
    </aside>
  )
}
