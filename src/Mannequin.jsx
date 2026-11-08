// Maniquí: imagen anatómica (frente y espalda) separada en capas por grupo muscular.
// Cada máscara se pinta con el color del rango de ese músculo; encima van las líneas y las partes neutras.
// Fuente y script de separación en assets-src/.
const FILES = { Pecho: 'pecho', Espalda: 'espalda', Hombro: 'hombro', 'Bíceps': 'biceps', 'Tríceps': 'triceps', Pierna: 'pierna', Core: 'core', Antebrazo: 'antebrazo' }
const url = (f) => `url(body/${f}.png)`

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k)))
  return `rgb(${c.join(',')})`
}

export default function Mannequin({ groups = {} }) {
  return (
    <div className="mq" role="img" aria-label="Maniquí con el rango de cada músculo">
      {Object.entries(FILES).map(([g, f]) => {
        const r = groups[g]?.rank
        const bg = r ? `linear-gradient(170deg, ${shade(r.color, 0.45)} 0%, ${r.color} 35%, ${shade(r.color, -0.3)} 100%)` : 'linear-gradient(170deg, #4a5466, #343c4a)'
        return (
          <div key={g} className={'mq-layer' + (r ? ' lit' : '')} style={r ? { '--rc': r.color } : undefined}>
            <div className="mq-fill" style={{ background: bg, WebkitMaskImage: url('mask-' + f), maskImage: url('mask-' + f) }} />
          </div>
        )
      })}
      <img src="body/base.png" alt="" className="mq-img" draggable="false" />
      <img src="body/edge.png" alt="" className="mq-img" draggable="false" />
    </div>
  )
}
