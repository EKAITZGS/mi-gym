import { useState } from 'react'
import { sleepAnalysis, nightsOf, hm, hmc } from './stats'
import Icon from './icons'

// Apartado de sueño (Progreso): noches del reloj Polar, medias de 7 días y análisis con consejos
export default function SleepCard({ data, setData }) {
  const a = sleepAnalysis(nightsOf(data), data.polar?.recharge)
  const [fix, setFix] = useState(null) // { start, end } mientras se corrige la última noche
  const saveFix = (v) =>
    setData((d) => {
      const all = { ...(d.sleepFix || {}) }
      if (v) all[a.lastDate] = v
      else delete all[a.lastDate]
      return { ...d, sleepFix: all }
    })
  if (!data.polar) return null
  if (!a)
    return (
      <div className="card">
        <div className="sec-head nm">
          <b>
            <Icon name="calendar" size={16} className="inl" /> Sueño
          </b>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Aún no hay noches del reloj. Duerme con él puesto y sincroniza con Polar Flow: aquí verás tus horas, la regularidad y
          consejos.
        </p>
      </div>
    )
  const max = Math.max(a.goal, ...a.week.map((n) => n.len || 0))
  return (
    <div className="card sleep">
      <div className="sec-head nm">
        <b>
          <Icon name="calendar" size={16} className="inl" /> Sueño
        </b>
        <span className="muted small">últimas 7 noches · medido por el reloj</span>
      </div>
      {(() => {
        // sensación subjetiva de los check-ins de los últimos 7 días (lo que tú marcaste, no el reloj)
        const since = new Date(); since.setDate(since.getDate() - 7)
        const f = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`
        const marks = (data.sessions || []).filter((s) => s.date >= f && s.checkin?.sleep).map((s) => s.checkin.sleep)
        if (!marks.length) return null
        const c = [1, 2, 3].map((v) => marks.filter((m) => m === v).length)
        return (
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Tu sensación (check-in): {[c[2] && `bien ×${c[2]}`, c[1] && `normal ×${c[1]}`, c[0] && `mal ×${c[0]}`].filter(Boolean).join(' · ')}.
          </p>
        )
      })()}
      {a.last && (
        <div className="sleep-last">
          <b className="tile-num">{hm(a.last.len)}</b>
          <span className="muted small">
            {' '}
            de sueño anoche{a.last.start ? ` · ${a.last.start}–${a.last.end}` : ''}
            {a.last.total < a.last.len ? ` · sueño real ${hm(a.last.total)} (${Math.round((a.last.total / a.last.len) * 100)} %)` : ''}
            {a.last.score > 0 ? ` · puntuación ${a.last.score}` : ''}
            {a.last.fixed ? ' · corregida' : ''}
          </span>
          {!fix && (
            <button className="link small" style={{ paddingLeft: 0, display: 'block' }} onClick={() => setFix({ start: a.last.start, end: a.last.end })}>
              ¿No es correcto? Corregir la hora
            </button>
          )}
          {fix && (
            <div className="sleep-fix">
              <p className="muted small" style={{ margin: '4px 0' }}>
                Si te pusiste el reloj antes de dormirte, el reloj cuenta ese rato como sueño. Pon tus horas reales:
              </p>
              <div className="fields">
                <label>
                  Me dormí
                  <input className="inp sm" type="time" value={fix.start} onChange={(e) => setFix({ ...fix, start: e.target.value })} />
                </label>
                <label>
                  Me desperté
                  <input className="inp sm" type="time" value={fix.end} onChange={(e) => setFix({ ...fix, end: e.target.value })} />
                </label>
              </div>
              <div className="btns">
                {a.last.fixed && (
                  <button className="btn" onClick={() => (saveFix(null), setFix(null))}>
                    Quitar corrección
                  </button>
                )}
                <button className="btn" onClick={() => setFix(null)}>
                  Cancelar
                </button>
                <button className="btn primary" disabled={!fix.start || !fix.end} onClick={() => (saveFix(fix), setFix(null))}>
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="sleep-bars" aria-label="Horas de sueño por noche">
        {a.week.map((n) => (
          <div key={n.date} className="sleep-col">
            <span className={'sleep-bar' + (n.len && n.len < a.goal - 60 ? ' low' : '')} style={{ height: `${n.len ? Math.max(6, (n.len / max) * 100) : 0}%` }} />
            <span className="sleep-day">{'DLMXJVS'[new Date(n.date + 'T12:00').getDay()]}</span>
          </div>
        ))}
      </div>
      <div className="sleep-stats">
        <div>
          <b>{hmc(a.avg)}</b>
          <span>
            media
            {a.prevAvg ? ` (${a.avg >= a.prevAvg ? '+' : '−'}${Math.abs(a.avg - a.prevAvg)} min)` : ''}
          </span>
        </div>
        {a.bed && (
          <div>
            <b>{a.bed}</b>
            <span>te acuestas{a.spread != null ? ` ±${a.spread} min` : ''}</span>
          </div>
        )}
        <div>
          <b>{a.interr} min</b>
          <span>despierto por noche</span>
        </div>
      </div>
      {(a.deepPct != null || a.cont != null) && (
        <p className="muted small" style={{ margin: '0 0 6px' }}>
          {a.deepPct != null ? `Fases: profundo ${a.deepPct} % · REM ${a.remPct} %` : ''}
          {a.deepPct != null && a.cont != null ? ' · ' : ''}
          {a.cont != null ? `Continuidad ${String(a.cont).replace('.', ',')}/5` : ''}
        </p>
      )}
      {a.hrv != null && (
        <p className="muted small" style={{ margin: '0 0 6px' }}>
          Recarga nocturna: VFC media {a.hrv} ms{a.hr ? ` · pulso en reposo ${a.hr} ppm` : ''}
        </p>
      )}
      <ul className="tips-list">
        {a.tips.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

// Resumen corto para Inicio
export function SleepLine({ data, onOpen }) {
  const a = sleepAnalysis(nightsOf(data), data.polar?.recharge)
  if (!a?.last || !a.lastIsToday) return null
  return (
    <button className="card sleep-line" onClick={onOpen}>
      <span className="rest-ic">
        <Icon name="calendar" size={18} />
      </span>
      <div className="grow">
        <div className="li-t">
          Anoche dormiste {hm(a.last.len)}
          {a.last.score > 0 ? ` · ${a.last.score}/100` : ''}
        </div>
        <div className="muted small">{a.tips[0]}</div>
      </div>
      <Icon name="right" size={16} className="muted" />
    </button>
  )
}
