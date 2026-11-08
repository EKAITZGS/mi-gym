// Maniquí anatómico propio (SVG). Se dibuja medio cuerpo y se refleja. Cada músculo lleva su grupo.
// viewBox 200 x 400, eje central x = 100.

const BASE =
  'M100,58 L91,58 Q90,66 85,70 Q70,73 58,79 Q45,86 43,104 Q39,130 43,152 Q41,180 44,204 Q40,218 44,232 Q50,239 57,232 Q61,220 58,206 Q66,180 66,158 Q69,142 68,128 Q66,152 66,180 Q66,196 68,208 Q62,240 64,274 Q66,292 69,304 Q63,340 69,372 Q65,382 69,389 L85,389 Q87,380 84,372 Q93,340 92,310 Q97,300 98,252 Q99,232 100,226 Z'

const FRONT = [
  ['Espalda', 'M93,62 Q82,70 66,77 L77,80 Q88,75 97,73 Z'],
  ['Hombro', 'M64,79 Q50,83 46,100 Q45,113 50,123 Q57,110 66,104 Q72,92 76,82 Z'],
  ['Pecho', 'M77,82 Q89,77 99,81 L99,117 Q86,124 73,118 Q67,112 67,105 Q72,93 77,82 Z'],
  ['Bíceps', 'M51,125 Q58,112 66,108 Q69,130 64,150 Q56,156 51,151 Q47,137 51,125 Z'],
  ['Tríceps', 'M46,110 Q42,130 46,151 L49,151 Q46,137 50,124 Z'],
  ['Core', 'M71,122 Q77,124 81,128 L82,170 Q75,176 71,184 Q66,160 68,140 Z'],
  ['Core', 'M84,124 Q92,122 99,123 L99,139 L84,140 Z'],
  ['Core', 'M84,143 L99,142 L99,158 L84,159 Z'],
  ['Core', 'M84,162 L99,161 L99,177 L84,178 Z'],
  ['Core', 'M84,181 L99,180 L99,212 Q92,206 86,198 Z'],
  ['Pierna', 'M70,212 Q63,242 66,272 Q69,289 76,296 Q77,258 80,216 Z'],
  ['Pierna', 'M82,214 Q90,216 93,222 Q93,260 88,289 Q83,296 79,296 Q79,256 82,214 Z'],
  ['Pierna', 'M95,226 Q99,236 98,252 Q97,282 92,298 Q89,300 87,296 Q93,262 95,226 Z'],
  ['Pierna', 'M70,311 Q65,340 72,369 L79,371 Q83,340 81,313 Z'],
  ['Pierna', 'M83,313 Q91,321 91,340 Q89,361 83,371 L81,371 Q85,340 83,313 Z'],
]

const BACK = [
  ['Espalda', 'M100,58 L92,60 Q85,72 66,79 Q84,85 92,103 Q96,119 100,128 Z'],
  ['Hombro', 'M64,80 Q51,84 46,100 Q45,112 50,121 Q57,108 66,102 Q70,92 72,84 Z'],
  ['Espalda', 'M73,86 Q84,90 90,104 Q80,111 69,111 Q67,103 69,96 Z'],
  ['Espalda', 'M69,114 Q82,112 92,106 Q98,124 100,140 L100,150 Q90,169 80,183 Q72,169 70,150 Q68,130 69,114 Z'],
  ['Espalda', 'M90,161 Q96,151 100,151 L100,204 Q92,206 86,200 Q86,180 90,161 Z'],
  ['Tríceps', 'M49,123 Q58,110 66,106 Q70,130 64,152 Q56,156 49,151 Q45,137 49,123 Z'],
  ['Core', 'M69,185 Q75,191 81,187 Q79,200 72,206 Q68,196 69,185 Z'],
  ['Pierna', 'M72,207 Q86,201 100,207 L100,248 Q86,256 74,248 Q66,230 72,207 Z'],
  ['Pierna', 'M72,253 Q78,257 84,258 Q84,281 80,300 Q74,296 72,281 Z'],
  ['Pierna', 'M86,258 Q94,257 98,253 Q98,281 92,300 Q86,302 82,300 Q86,281 86,258 Z'],
  ['Pierna', 'M70,312 Q64,330 68,352 Q74,360 82,356 Q84,334 82,312 Z'],
  ['Pierna', 'M84,312 Q94,316 94,334 Q92,352 86,358 Q82,334 84,312 Z'],
]

const NEUTRAL_FRONT = ['M48,157 Q56,161 64,155 Q62,181 56,204 L46,204 Q42,181 48,157 Z', 'M46,206 L57,206 Q59,220 55,232 Q49,235 44,229 Q42,216 46,206 Z']

export default function Mannequin({ view = 'front', groups = {}, gid }) {
  const parts = view === 'front' ? FRONT : BACK
  const fill = (g) => (groups[g]?.rank ? `url(#${gid}-${groups[g].rank.id})` : `url(#${gid}-none)`)
  const half = (
    <>
      {NEUTRAL_FRONT.map((d, i) => (
        <path key={'n' + i} d={d} fill={`url(#${gid}-none)`} className="mq-seam" />
      ))}
      {parts.map(([g, d], i) => (
        <path key={i} d={d} fill={fill(g)} className={'mq-seam' + (groups[g]?.rank ? ' lit' : '')} style={groups[g]?.rank ? { '--rc': groups[g].rank.color } : undefined} />
      ))}
    </>
  )
  return (
    <svg viewBox="0 0 200 400" className="mannequin" role="img" aria-label={view === 'front' ? 'Vista de frente' : 'Vista de espalda'}>
      <g className="mq-body">
        <path d={BASE} className="mq-base" />
        <path d={BASE} className="mq-base" transform="translate(200,0) scale(-1,1)" />
        <ellipse cx="100" cy="37" rx="17" ry="21" className="mq-head" />
      </g>
      {half}
      <g transform="translate(200,0) scale(-1,1)">{half}</g>
    </svg>
  )
}
