// Entreno exportado de Polar Flow en TCX → mismo formato que `polar.exercises` (para los que AccessLink no entrega).
// Puro: `offOf(fecha)` da los minutos respecto a UTC de esa fecha (por defecto, la zona del móvil).
const SPORT = { Running: 'Correr', Biking: 'Bici' }
const STEP = 15

export function parseTcx(xml, offOf = (d) => -d.getTimezoneOffset()) {
  const txt = String(xml || '')
  const act = txt.match(/<Activity\b[^>]*>[\s\S]*?<\/Activity>/)
  if (!act) throw new Error('No es un archivo TCX de entreno')
  const a = act[0]
  const sport = (a.match(/<Activity[^>]*Sport="([^"]*)"/) || [])[1] || ''
  const id0 = (a.match(/<Id>([^<]+)<\/Id>/) || [])[1]
  const t0 = Date.parse(id0 || (a.match(/<Lap[^>]*StartTime="([^"]+)"/) || [])[1])
  if (!t0) throw new Error('El archivo no trae la hora del entreno')
  const sum = (re) => [...a.matchAll(re)].reduce((s, m) => s + Number(m[1] || 0), 0)
  const secs = sum(/<TotalTimeSeconds>([\d.]+)<\/TotalTimeSeconds>/g)
  const kcal = sum(/<Calories>([\d.]+)<\/Calories>/g)
  // pulso: cada punto con hora y pulso, agrupado cada 15 s desde el inicio
  const pts = [...a.matchAll(/<Trackpoint>([\s\S]*?)<\/Trackpoint>/g)]
    .map((m) => ({ t: Date.parse((m[1].match(/<Time>([^<]+)<\/Time>/) || [])[1]), v: Number((m[1].match(/<HeartRateBpm>\s*<Value>(\d+)<\/Value>/) || [])[1]) }))
    .filter((p) => p.t >= t0 && p.v > 30 && p.v < 230)
  const out = {}
  if (pts.length) {
    const n = Math.floor((pts[pts.length - 1].t - t0) / 1000 / STEP) + 1
    const acc = Array.from({ length: n }, () => [0, 0])
    for (const p of pts) {
      const k = Math.floor((p.t - t0) / 1000 / STEP)
      acc[k][0] += p.v
      acc[k][1]++
    }
    out.hr = { step: STEP, v: acc.map(([s, c]) => (c ? Math.round(s / c) : 0)) }
  }
  const vals = pts.map((p) => p.v)
  const avgTag = sum(/<AverageHeartRateBpm>\s*<Value>(\d+)<\/Value>/g)
  const maxTag = Math.max(0, ...[...a.matchAll(/<MaximumHeartRateBpm>\s*<Value>(\d+)<\/Value>/g)].map((m) => +m[1]))
  const off = offOf(new Date(t0))
  const start = new Date(t0 + off * 60000).toISOString().slice(0, 19)
  const dur = secs || (pts.length ? (pts[pts.length - 1].t - t0) / 1000 : 0)
  return {
    id: 'tcx-' + start.replace(/[^0-9]/g, ''),
    date: start.slice(0, 10),
    time: start.slice(11, 16),
    start,
    off,
    min: Math.round(dur / 60),
    kcal: Math.round(kcal),
    hrAvg: vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : avgTag || null,
    hrMax: vals.length ? Math.max(...vals) : maxTag || null,
    sport: SPORT[sport] || 'Fuerza',
    load: null,
    imported: true,
    ...out,
  }
}

// ¿Es el mismo entreno? (misma hora de inicio con 2 min de margen)
export const sameStart = (a, b) => !!a?.start && !!b?.start && Math.abs(Date.parse(a.start + 'Z') - Date.parse(b.start + 'Z')) <= 120000
