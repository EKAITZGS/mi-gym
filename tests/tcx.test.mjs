// Importar entreno TCX exportado de Polar Flow
import assert from 'node:assert/strict'
import { parseTcx, sameStart } from '../src/tcx.js'

const pts = Array.from({ length: 121 }, (_, i) => `<Trackpoint><Time>${new Date(Date.parse('2026-11-18T17:06:00.000Z') + i * 5000).toISOString()}</Time><HeartRateBpm><Value>${100 + (i % 20)}</Value></HeartRateBpm></Trackpoint>`).join('')
const xml = `<?xml version="1.0" encoding="UTF-8"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Other"><Id>2026-11-18T17:06:00.000Z</Id><Lap StartTime="2026-11-18T17:06:00.000Z"><TotalTimeSeconds>600.0</TotalTimeSeconds><Calories>95</Calories><AverageHeartRateBpm><Value>109</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>119</Value></MaximumHeartRateBpm><Track>${pts}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`
const e = parseTcx(xml, () => 60) // Madrid en invierno
assert.equal(e.date, '2026-11-18')
assert.equal(e.time, '18:06')
assert.equal(e.start, '2026-11-18T18:06:00')
assert.equal(e.off, 60)
assert.equal(e.min, 10)
assert.equal(e.kcal, 95)
assert.equal(e.hrMax, 119)
assert.equal(e.sport, 'Fuerza')
assert.equal(e.hr.step, 15)
assert.equal(e.hr.v.length, 41) // 600 s / 15 + 1
assert.ok(e.hr.v.every((v) => v >= 100 && v <= 119))
assert.ok(e.imported && e.id.startsWith('tcx-'))
assert.ok(sameStart(e, { start: '2026-11-18T18:07:30' }))
assert.ok(!sameStart(e, { start: '2026-11-18T18:10:00' }))
assert.throws(() => parseTcx('<html></html>'))
console.log('tcx ok')
