import { useMemo, useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { dayTotals, exStats, fmtKg } from './store'
import { EX_BY_ID } from './data/exercises'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Resumen de un mes: entrenos, fuerza, cintura, comida y reloj
export function monthSummary(data, ym) {
  const inM = (d) => d && d.startsWith(ym)
  const ses = data.sessions.filter((s) => inM(s.date))
  const days = new Set(ses.map((s) => s.date)).size
  const sets = ses.reduce((n, s) => n + Object.values(s.entries || {}).reduce((m, x) => m + x.length, 0), 0)

  // fuerza: 1RM estimado, primera vs última sesión del mes de cada ejercicio
  const ids = [...new Set(ses.flatMap((s) => Object.keys(s.entries || {})))]
  const strength = ids
    .map((id) => {
      const st = exStats(ses, id)
      if (st.length < 2 || !EX_BY_ID[id]) return null
      return { id, name: EX_BY_ID[id].name, from: st[0].best.e, to: st[st.length - 1].best.e, n: st.length }
    })
    .filter(Boolean)
    .sort((a, b) => b.to / b.from - a.to / a.from)
    .slice(0, 4)

  const w = (data.body?.waist || []).filter((x) => inM(x.date))
  const waist = w.length ? { from: w[0].cm, to: w[w.length - 1].cm, n: w.length } : null

  const foodDays = Object.entries(data.food || {}).filter(([d, e]) => inM(d) && e.length)
  const tot = foodDays.map(([, e]) => dayTotals(e))
  const avg = (k) => (tot.length ? Math.round(tot.reduce((a, t) => a + t[k], 0) / tot.length) : null)
  const protOk = tot.filter((t) => t.p >= data.goals.protein * 0.9).length

  const pd = Object.entries(data.polar?.days || {}).filter(([d]) => inM(d))
  const steps = pd.length ? Math.round(pd.reduce((a, [, x]) => a + (x.steps || 0), 0) / pd.length) : null
  const pex = Object.values(data.polar?.exercises || {}).filter((e) => inM(e.date))
  const watchKcal = pex.reduce((a, e) => a + (e.kcal || 0), 0)

  return { ses: ses.length, days, sets, strength, waist, foodDays: foodDays.length, kcal: avg('kcal'), prot: avg('p'), protOk, steps, watchKcal, watchN: pex.length }
}

function verdict(s, data) {
  const out = []
  if (s.waist && s.waist.n >= 2) {
    const d = Math.round((s.waist.to - s.waist.from) * 10) / 10
    out.push(d < 0 ? { t: 'green', x: `Cintura ${fmtKg(d)} cm: estás perdiendo grasa.` } : { t: 'yellow', x: 'La cintura no ha bajado este mes: revisa las calorías de los fines de semana y los dulces.' })
  }
  if (s.strength.some((x) => x.to > x.from)) out.push({ t: 'green', x: 'Has ganado fuerza: estás construyendo músculo.' })
  if (s.kcal != null && s.kcal > data.goals.kcal + 150) out.push({ t: 'yellow', x: `Media de ${s.kcal} kcal, por encima de tu objetivo (${data.goals.kcal}).` })
  if (s.foodDays >= 5 && s.protOk < s.foodDays / 2) out.push({ t: 'yellow', x: `Solo ${s.protOk} de ${s.foodDays} días llegaste a la proteína. Es lo que más te ayudará a no perder músculo.` })
  if (s.steps != null && s.steps < 6000) out.push({ t: 'yellow', x: `Media de ${s.steps.toLocaleString('es-ES')} pasos: subir a 7.000–8.000 acelera la pérdida de grasa.` })
  return out
}

export default function MonthModal({ data, onClose }) {
  const now = new Date()
  const [off, setOff] = useState(0)
  const d = new Date(now.getFullYear(), now.getMonth() - off, 1)
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const s = useMemo(() => monthSummary(data, ym), [data, ym])
  const tips = verdict(s, data)
  const Stat = ({ v, l }) => (
    <div>
      <b>{v ?? '—'}</b>
      <span>{l}</span>
    </div>
  )
  return (
    <Modal title={`Resumen de ${MONTHS[d.getMonth()]}`} onClose={onClose}>
      <div className="month-nav">
        <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="Mes anterior">
          <Icon name="left" size={18} />
        </button>
        <span className="muted small">
          {MONTHS[d.getMonth()]} {d.getFullYear()}
        </span>
        <button className="icon-btn" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 1))} aria-label="Mes siguiente">
          <Icon name="right" size={18} />
        </button>
      </div>
      <div className="polar-sum">
        <Stat v={s.days} l="días entrenados" />
        <Stat v={s.sets} l="series" />
        <Stat v={s.waist && s.waist.n >= 2 ? `${s.waist.to - s.waist.from > 0 ? '+' : ''}${fmtKg(Math.round((s.waist.to - s.waist.from) * 10) / 10)}` : s.waist ? fmtKg(s.waist.to) : null} l="cm cintura" />
      </div>
      <div className="polar-sum">
        <Stat v={s.kcal} l="kcal/día" />
        <Stat v={s.prot} l="g prot/día" />
        <Stat v={s.steps != null ? s.steps.toLocaleString('es-ES') : null} l="pasos/día" />
      </div>

      {s.strength.length > 0 && (
        <>
          <h4>Fuerza</h4>
          {s.strength.map((x) => {
            const diff = Math.round((x.to - x.from) * 10) / 10
            return (
              <div className="row nob li" key={x.id}>
                <div className="grow">
                  <div className="li-t">{x.name}</div>
                  <div className="muted small">
                    1RM est. {fmtKg(Math.round(x.from * 10) / 10)} → {fmtKg(Math.round(x.to * 10) / 10)} kg · {x.n} sesiones
                  </div>
                </div>
                <span className={'delta ' + (diff >= 0 ? 'up' : 'down')}>
                  {diff >= 0 ? '+' : ''}
                  {fmtKg(diff)} kg
                </span>
              </div>
            )
          })}
        </>
      )}

      {s.foodDays > 0 && (
        <p className="muted small">
          Comida apuntada {s.foodDays} días · proteína cumplida {s.protOk} días{s.watchN ? ` · reloj: ${s.watchN} entrenos, ${s.watchKcal} kcal` : ''}
        </p>
      )}

      {tips.length > 0 && (
        <>
          <h4>Cómo vas</h4>
          {tips.map((t, i) => (
            <div key={i} className={'advice ' + t.t}>
              {t.x}
            </div>
          ))}
        </>
      )}
      {s.ses === 0 && s.foodDays === 0 && <p className="muted">Aún no hay datos de este mes.</p>}
    </Modal>
  )
}
