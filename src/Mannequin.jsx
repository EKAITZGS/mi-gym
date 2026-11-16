// Maniquí: imagen anatómica (frente y espalda) separada en capas por grupo muscular.
// Cada máscara se pinta con el color del rango de ese músculo; encima van las líneas y las partes neutras.
// Fuente y script de separación en assets-src/.
// onPick(grupo) = al tocar un músculo (se mira el píxel de cada máscara, a 1/4 de resolución).
const FILES = { Pecho: 'pecho', Espalda: 'espalda', Hombro: 'hombro', 'Bíceps': 'biceps', 'Tríceps': 'triceps', Pierna: 'pierna', Core: 'core', Antebrazo: 'antebrazo' }
const url = (f) => `url(body/${f}.png)`
const MW = 250, MH = 229 // máscaras originales 1000 × 914, reducidas para mirar el toque

let masks = null
const loadMasks = () =>
  (masks ??= Promise.all(
    Object.entries(FILES).map(async ([g, f]) => {
      const img = new Image()
      img.src = `body/mask-${f}.png`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = MW
      c.height = MH
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, MW, MH)
      const px = ctx.getImageData(0, 0, MW, MH).data
      const alpha = new Uint8Array(MW * MH)
      for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3]
      return [g, alpha]
    })
  ).catch(() => (masks = null)))

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k)))
  return `rgb(${c.join(',')})`
}

export default function Mannequin({ groups = {}, onPick, picked }) {
  const pick = async (e) => {
    if (!onPick) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * MW)
    const y = Math.floor(((e.clientY - r.top) / r.height) * MH)
    const list = await loadMasks()
    if (!list) return
    // el músculo con más presencia en un pequeño entorno del toque (los dedos no son precisos)
    let best = null, bestN = 0
    for (const [g, alpha] of list) {
      let n = 0
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < MW && yy < MH && alpha[yy * MW + xx] > 80) n++
        }
      if (n > bestN) (best = g), (bestN = n)
    }
    onPick(best)
  }
  return (
    <div
      className={'mq' + (onPick ? ' pickable' : '')}
      role={onPick ? undefined : 'img'}
      aria-label={onPick ? undefined : 'Maniquí con el rango de cada músculo'}
      aria-hidden={onPick ? 'true' : undefined}
      onClick={onPick ? pick : undefined}
      onPointerEnter={onPick ? () => loadMasks() : undefined}
      onTouchStart={onPick ? () => loadMasks() : undefined}
    >
      {Object.entries(FILES).map(([g, f]) => {
        const r = groups[g]?.rank
        const bg = r ? `linear-gradient(170deg, ${shade(r.color, 0.45)} 0%, ${r.color} 35%, ${shade(r.color, -0.3)} 100%)` : 'linear-gradient(170deg, #4a5466, #343c4a)'
        return (
          <div key={g} className={'mq-layer' + (r ? ' lit' : '') + (picked === g ? ' picked' : '')} style={r ? { '--rc': r.color } : undefined}>
            <div className="mq-fill" style={{ background: bg, WebkitMaskImage: url('mask-' + f), maskImage: url('mask-' + f) }} />
          </div>
        )
      })}
      <img src="body/base.png" alt="" className="mq-img" draggable="false" />
      <img src="body/edge.png" alt="" className="mq-img" draggable="false" />
    </div>
  )
}
