import { useState } from 'react'
import Icon from './icons'
import { pushSupported, isStandalone, pushState, enablePush, disablePush, testPush, syncPush, DEFAULT_PREFS, pushPlan } from './push'

const OPTS = [
  { k: 'train', t: 'Entreno del día', s: 'Por la mañana, los días que toca entrenar', time: 'trainAt' },
  { k: 'protein', t: 'Proteína', s: 'Si no llegas, te digo cuánto falta y qué tomar', time: 'proteinAt' },
  { k: 'watch', t: 'Sincronizar el reloj', s: 'Por la noche, si entrenaste y no ha llegado el entreno' },
  { k: 'waist', t: 'Medir la cintura', s: 'Los domingos por la mañana' },
]

export default function PushCard({ data, setData }) {
  const [on, setOn] = useState(!!pushState()?.on)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const pr = { ...DEFAULT_PREFS, ...(data.pushPrefs || {}) }
  const setPr = (p) => setData((d) => ({ ...d, pushPrefs: { ...DEFAULT_PREFS, ...(d.pushPrefs || {}), ...p } }))

  if (!pushSupported() || !isStandalone())
    return (
      <div className="card">
        <p className="muted small" style={{ margin: 0 }}>
          {isStandalone()
            ? 'Este navegador no admite avisos. En iPhone necesitas iOS 16.4 o superior.'
            : 'Para recibir avisos en el iPhone, abre Mi Gym desde el icono de la pantalla de inicio (no desde Safari).'}
        </p>
      </div>
    )

  const activate = async () => {
    setBusy(true)
    setMsg('')
    try {
      await enablePush()
      setOn(true)
      await syncPush(data, true)
      await testPush()
      setMsg('Avisos activados. Te acaba de llegar uno de prueba.')
    } catch (e) {
      setMsg(e.message === 'DENIED' ? 'Has denegado el permiso. Actívalo en Ajustes del iPhone → Notificaciones → Mi Gym.' : 'No se pudieron activar ahora. Prueba otra vez en un momento.')
    }
    setBusy(false)
  }
  const deactivate = async () => {
    setBusy(true)
    await disablePush()
    setOn(false)
    setBusy(false)
    setMsg('Avisos desactivados.')
  }
  const next = on ? pushPlan(data).slice(0, 3) : []
  const fmt = (t) => {
    const d = new Date(t)
    const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    return `${days[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="card">
      {!on ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            Te aviso de lo que toca entrenar, si te falta proteína, si no has sincronizado el reloj y cuándo medir la cintura. Tú eliges cuáles.
          </p>
          <button className="btn primary full" disabled={busy} onClick={activate}>
            <Icon name="sparkle" size={16} /> {busy ? 'Activando…' : 'Activar avisos'}
          </button>
        </>
      ) : (
        <>
          {OPTS.map((o) => (
            <div className="push-opt" key={o.k}>
              <label className="chk-l">
                <input type="checkbox" checked={!!pr[o.k]} onChange={(e) => setPr({ [o.k]: e.target.checked })} />
                <span>
                  <b>{o.t}</b>
                  <span className="muted small"> · {o.s}</span>
                </span>
              </label>
              {o.time && pr[o.k] && (
                <input className="inp time" type="time" value={pr[o.time]} onChange={(e) => e.target.value && setPr({ [o.time]: e.target.value })} />
              )}
            </div>
          ))}
          {next.length > 0 && (
            <div className="push-next">
              <span className="muted small">Próximos avisos:</span>
              {next.map((n) => (
                <div key={n.k} className="small">
                  <b>{fmt(n.at)}</b> · {n.title}
                </div>
              ))}
            </div>
          )}
          <div className="btns">
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await syncPush(data, true)
                  await testPush()
                  setMsg('Aviso de prueba enviado.')
                } catch {
                  setMsg('No se pudo enviar la prueba.')
                }
                setBusy(false)
              }}
            >
              Probar aviso
            </button>
            <button className="btn danger" disabled={busy} onClick={deactivate}>
              Desactivar
            </button>
          </div>
        </>
      )}
      {msg && <p className="toast small">{msg}</p>}
    </div>
  )
}
