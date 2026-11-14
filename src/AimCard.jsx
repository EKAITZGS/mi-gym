import { useState } from 'react'
import { AIMS, aimPlan, checkStatus, fmt1 } from './aim'
import { aimOf } from './energy'
import { WaistModal, WeightModal, PhotosModal } from './Body'
import { CoachChat } from './Review'
import Icon from './icons'

// Progreso: entrenador de objetivo (definir / recomposición / ganar músculo) con control semanal de peso, cintura y fotos
export default function AimCard({ data, setData }) {
  const aim = aimOf(data)
  const p = aimPlan(data, aim)
  const ctrl = checkStatus(data, data.body?.photos || [])
  const [modal, setModal] = useState(null) // 'weight' | 'waist' | 'frontal' | 'lateral'
  const [chat, setChat] = useState(false)
  const info = AIMS.find((a) => a.id === aim)
  const setAim = (id) => setData((d) => ({ ...d, goals: { ...d.goals, aim: id } }))
  const g = data.goals || {}
  const newKcal = p.target.kcal && !g.auto && Math.abs(p.target.kcal - g.kcal) >= 100 ? p.target.kcal : null
  const newProt = p.target.protein && !g.auto && Math.abs(p.target.protein - g.protein) >= 10 ? p.target.protein : null
  const open = { weight: 'weight', waist: 'waist', front: 'frontal', side: 'lateral' }
  const ago = (r) => (r.date == null ? 'Nunca' : r.days === 0 ? 'Hoy' : r.days === 1 ? 'Ayer' : `Hace ${r.days} días`)

  return (
    <div className="card aim">
      <div className="sec-head nm">
        <b>
          <Icon name="trophy" size={16} className="inl" /> Tu objetivo
        </b>
        <span className="muted small">entrenador y dieta</span>
      </div>
      <div className="seg seg3">
        {AIMS.map((a) => (
          <button key={a.id} className={aim === a.id ? 'on' : ''} onClick={() => setAim(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '6px 0 10px' }}>
        {info.hint}. Es el mismo objetivo que usa Dieta.
      </p>

      <h4 style={{ margin: '4px 0 6px' }}>Control</h4>
      <div className="aim-ctrl">
        {ctrl.map((r) => (
          <button key={r.key} className={'aim-row' + (r.due ? ' due' : '')} onClick={() => setModal(open[r.key])}>
            <span className="grow">
              <b>{r.label}</b>
              <span className="muted small"> · {ago(r)}</span>
            </span>
            <span className={r.due ? 'aim-due' : 'aim-ok'}>{r.due ? 'Toca' : <Icon name="check" size={16} />}</span>
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>
        Peso y cintura 1 vez por semana; fotos cada 2 semanas. Juntos te dicen si pierdes grasa o músculo: la báscula sola engaña.
      </p>

      <div className="sleep-stats">
        <div>
          <b>{p.kg ? fmt1(p.kg) : '—'}</b>
          <span>kg (media)</span>
        </div>
        <div>
          <b>{p.rate != null ? `${p.rate >= 0 ? '+' : ''}${fmt1(p.rate)}` : '—'}</b>
          <span>kg/semana</span>
        </div>
        <div>
          <b>{p.waistDelta != null ? `${p.waistDelta >= 0 ? '+' : ''}${fmt1(p.waistDelta)}` : '—'}</b>
          <span>cm cintura (4 sem.)</span>
        </div>
      </div>

      {p.items.map((it, i) => (
        <div key={i} className={'advice sm ' + (it.tone === 'info' ? '' : it.tone)}>
          <b>{it.title}</b>
          <div>{it.text}</div>
        </div>
      ))}

      {(newKcal || newProt) && (
        <div className="aim-prop">
          <b>Te recomiendo:</b> {newKcal ? `${newKcal} kcal` : `${g.kcal} kcal`}
          {newProt ? ` y ${newProt} g de proteína al día` : ''}
          {p.maint ? <div className="muted small">Tu gasto real calculado con lo que comes y cómo cambia tu peso: unas {p.maint} kcal.</div> : null}
          <button
            className="btn primary full"
            onClick={() => setData((d) => ({ ...d, goals: { ...d.goals, ...(newKcal ? { kcal: newKcal } : {}), ...(newProt ? { protein: newProt } : {}) } }))}
          >
            <Icon name="check" size={16} /> Usar estos objetivos
          </button>
        </div>
      )}

      <button className="btn full" onClick={() => setChat(true)}>
        <Icon name="sparkle" size={16} /> Pedir análisis al entrenador IA
      </button>
      <p className="muted small" style={{ marginBottom: 0 }}>Orientativo: no sustituye a un médico ni a un dietista.</p>

      {modal === 'weight' && <WeightModal data={data} setData={setData} onClose={() => setModal(null)} />}
      {modal === 'waist' && <WaistModal data={data} setData={setData} onClose={() => setModal(null)} />}
      {(modal === 'frontal' || modal === 'lateral') && <PhotosModal data={data} setData={setData} pose={modal} onClose={() => setModal(null)} />}
      {chat && (
        <CoachChat
          data={data}
          onClose={() => setChat(false)}
          initial={`Mi objetivo es ${info.label.toLowerCase()}. Analiza mi progreso (peso, cintura, comida, entreno, fuerza y sueño) y dime qué ajusto esta semana en dieta y entreno.`}
        />
      )}
    </div>
  )
}
