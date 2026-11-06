// Semáforo de alimentos pensado para perder grasa y ganar músculo.
// Usa valores por 100 g: kcal, p (proteína), s (azúcares), sf (grasa saturada), ns (Nutri-Score a-e).
// natural: true => azúcares propios de fruta/lácteo natural (no penaliza).

export function rateFood(f) {
  if (!f || f.quick) return null
  const kcal = Number(f.kcal) || 0
  const p = Number(f.p) || 0
  const s = f.s == null ? null : Number(f.s)
  const sf = f.sf == null ? null : Number(f.sf)
  const ns = (f.ns || '').toLowerCase()
  let score = 0
  const pros = []
  const cons = []

  if (s != null && !f.natural) {
    if (s >= 8 && p < 3) {
      score += 3
      cons.push(`mucho azúcar (${round(s)} g/100 g) y casi sin proteína`)
    } else if (s >= 10) {
      score += 2
      cons.push(`mucho azúcar (${round(s)} g/100 g)`)
    } else if (s >= 5) {
      score += 1
      cons.push(`algo de azúcar (${round(s)} g/100 g)`)
    }
  }
  const share = kcal > 0 ? (p * 4) / kcal : 0
  if (share >= 0.3) {
    score -= 2
    pros.push('alto en proteína')
  } else if (share >= 0.2) {
    score -= 1
    pros.push('buena proteína')
  }
  if (kcal >= 450) {
    score += 1
    cons.push('muy calórico, controla la cantidad')
  } else if (kcal <= 60 && (s == null || s < 5 || f.natural)) {
    score -= 1
    pros.push(kcal <= 5 ? 'casi sin calorías' : 'pocas calorías')
  }
  if (sf != null) {
    if (sf >= 15) {
      score += 2
      cons.push('mucha grasa saturada')
    } else if (sf >= 5) {
      score += 1
      cons.push('bastante grasa saturada')
    }
  }
  if (ns === 'a' || ns === 'b') score -= 1
  else if (ns === 'd') score += 1
  else if (ns === 'e') score += 2

  const level = score <= 0 ? 'green' : score <= 2 ? 'yellow' : 'red'
  const label = { green: 'Recomendado', yellow: 'Con moderación', red: 'No recomendado' }[level]
  const why = level === 'green' ? (pros.length ? pros : ['sin azúcar añadido ni grasas en exceso']) : cons.length ? cons : pros
  return { level, label, why, ns: ns || null }
}

const round = (n) => Math.round(n * 10) / 10

// Pastilla de color corta
export const RATE_COLORS = { green: 'var(--accent)', yellow: 'var(--amber)', red: 'var(--danger)' }
