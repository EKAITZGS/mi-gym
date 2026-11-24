// Hoja «Claude o ChatGPT»: prepara tus datos de entreno en un texto para pegar en otra IA y, si te devuelve
// una rutina en el formato de la app, enseña los cambios para aplicarlos (nunca se aplican solos).
import { useMemo, useState } from 'react'
import { Modal } from './ui'
import Icon from './icons'
import { Button, Field, Segmented } from './ds'
import { AiProposal } from './Review'
import { exportText, readReply, AX_KINDS } from './aiExport'

const KEY = 'migym.axopts'
const loadOpts = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
const HINT = {
  plan: 'Ej.: quiero 4 días de 60 min y centrarme en espalda',
  progress: 'Ej.: ¿por qué no subo en press banca?',
  last: 'Ej.: hoy iba cansado, ¿bajo peso la próxima?',
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {}
  // Safari antiguo: copiar desde un campo oculto
  try {
    const ta = document.createElement('textarea')
    ta.value = t
    ta.setAttribute('readonly', '')
    ta.className = 'ax-hidden'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, t.length)
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export default function AiExport({ data, setData, kind: kind0 = 'plan', onClose }) {
  const saved = loadOpts()
  const [kind, setKind] = useState(kind0)
  const [weeks, setWeeks] = useState(saved.weeks || 8)
  const [inc, setInc] = useState({ body: saved.body ?? true, sleep: !!saved.sleep, diet: !!saved.diet })
  const [ask, setAsk] = useState('')
  const [copied, setCopied] = useState(null) // true | false (no se pudo) | null
  const [reply, setReply] = useState('')
  const [res, setRes] = useState(null)
  const [st, setSt] = useState(null)

  const text = useMemo(() => exportText(data, { kind, weeks, ...inc, ask }), [data, kind, weeks, inc, ask])
  const remember = (o) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ weeks, ...inc, ...o }))
    } catch {}
  }
  const change = (fn) => {
    fn()
    setCopied(null)
  }
  const copy = async () => setCopied(await copyText(text))
  const share = async () => {
    try {
      await navigator.share({ text })
    } catch {}
  }
  const read = () => {
    setSt(null)
    setRes(readReply(reply, data))
  }
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <Modal title="Claude o ChatGPT" onClose={onClose}>
      <p className="muted small mt-0">
        Prepara tus datos en un texto para pegarlo en Claude o ChatGPT y que te haga un plan o te diga cómo vas. Solo sale de tu móvil si tú lo pegas.
      </p>
      <Field label="Qué quieres">
        <Segmented label="Qué quieres" options={Object.entries(AX_KINDS).map(([v, label]) => ({ v, label }))} value={kind} onChange={(v) => change(() => setKind(v))} />
      </Field>
      {kind !== 'last' && (
        <Field label="Periodo">
          <Segmented
            label="Periodo"
            options={[4, 8, 12].map((v) => ({ v, label: `${v} semanas` }))}
            value={weeks}
            onChange={(v) => change(() => (setWeeks(v), remember({ weeks: v })))}
          />
        </Field>
      )}
      <Field label="Añadir">
        <div className="chips wrap">
          {[
            ['body', 'Peso y cintura'],
            ...(kind !== 'last'
              ? [
                  ['sleep', 'Sueño'],
                  ['diet', 'Dieta'],
                ]
              : []),
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={'chip' + (inc[k] ? ' on' : '')}
              aria-pressed={!!inc[k]}
              onClick={() =>
                change(() => {
                  const n = { ...inc, [k]: !inc[k] }
                  setInc(n)
                  remember(n)
                })
              }
            >
              {l}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Tu petición (opcional)">
        <textarea className="inp" rows={2} placeholder={HINT[kind]} value={ask} onChange={(e) => change(() => setAsk(e.target.value.slice(0, 600)))} />
      </Field>

      <div className="ax-actions">
        <Button variant="primary" full icon="list" done={copied === true} onClick={copy}>
          {copied === true ? 'Copiado' : 'Copiar texto'}
        </Button>
        {canShare && (
          <Button full icon="chat" onClick={share}>
            Compartir…
          </Button>
        )}
      </div>
      {copied === false && <p className="small hint-warn">No se pudo copiar solo: abre «Ver el texto», mantén pulsado y copia.</p>}
      {copied === true && (
        <div className="ax-open">
          <p className="small m-0">Ya está copiado. Abre una y pégalo en un chat nuevo:</p>
          <div className="btns">
            <a className="btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">
              ChatGPT
            </a>
            <a className="btn" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">
              Claude
            </a>
          </div>
        </div>
      )}
      <details className="ax-prev">
        <summary>
          Ver el texto <span className="muted">· {text.length.toLocaleString('es-ES')} caracteres</span>
        </summary>
        <pre>{text}</pre>
      </details>

      {kind !== 'last' && (
        <div className="ax-back">
          <div className="card-h">
            <Icon name="sparkle" size={16} />
            <h3>Aplicar lo que te proponga</h3>
          </div>
          <p className="muted small mt-0">
            {kind === 'plan'
              ? 'Si te da una rutina, copia su respuesta (o solo el bloque del final) y pégala aquí. Verás los cambios antes de aplicarlos.'
              : 'Si quieres que te cambie la rutina, elige «Un plan»: ese texto lleva el formato para que la app pueda aplicarla.'}
          </p>
          {kind === 'plan' && (
            <>
              <textarea
                className="inp"
                rows={3}
                aria-label="Respuesta de Claude o ChatGPT"
                placeholder="Pega aquí su respuesta"
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value)
                  setRes(null)
                }}
              />
              <Button full icon="sparkle" className="mt-2" disabled={!reply.trim()} onClick={read}>
                Ver cambios
              </Button>
              {res?.error === 'nojson' && (
                <p className="small hint-warn">No encuentro la rutina en el formato de la app. Pídele: «Dame la rutina en el bloque JSON con el formato que te pasé».</p>
              )}
              {res?.error === 'empty' && <p className="small hint-warn">Su propuesta no cambia nada de tu rutina (o los ejercicios no existen en la app).</p>}
              {res?.unknown?.length > 0 && (
                <p className="small muted">
                  Se han quitado {res.unknown.length === 1 ? 'un ejercicio que no está' : `${res.unknown.length} ejercicios que no están`} en la app: {res.unknown.join(', ')}.
                </p>
              )}
              {res?.proposal && <AiProposal p={res.proposal} data={data} setData={setData} status={st} onDecide={setSt} />}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
