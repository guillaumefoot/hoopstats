import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recordShot, rotate } from '../src/basket.ts'
import { shortPlayerName } from '../src/club.ts'
import { createDemo } from '../src/demo.ts'
import { buildMatchReport } from '../src/matchReport.ts'
import { createSampleMatch } from '../src/sampleMatch.ts'

test('respecte les prénoms composés', () => {
  assert.equal(shortPlayerName({ id: 'other', number: '', displayName: 'Jean Pierre Dupont', firstName: 'Jean Pierre', lastName: 'Dupont' }), 'Jean Pierre D.')
})

test('le plus/minus compte seulement les paniers pendant la présence sur le terrain', () => {
  const demo = createDemo()
  const [out, ...otherStarters] = demo.starters
  const incoming = demo.roster.find((player) => !demo.starters.includes(player.id))!.id
  const rotated = rotate(demo, [out], [incoming])
  const scored = recordShot(rotated, { team: 'opponent', playerId: null }, '3', 'made')
  const before = buildMatchReport(demo)
  const after = buildMatchReport(scored)
  assert.equal(after.plusMinus[out], before.plusMinus[out])
  assert.equal(after.plusMinus[incoming], -3)
  for (const id of otherStarters) assert.equal(after.plusMinus[id], before.plusMinus[id] - 3)
  assert.equal(after.timedFlow, false)
  assert.equal(after.playingTime, null)
})

test('l’essai contre Fréjus reprend l’effectif et le cinq du rapport fictif', () => {
  const demo = createDemo()
  const sample = createSampleMatch()
  assert.equal(demo.opponentName, 'Fréjus')
  assert.deepEqual(demo.roster, sample.roster)
  assert.deepEqual(demo.starters, sample.starters)
})

test('le match fictif a quatre périodes cohérentes et 200 minutes-joueurs', () => {
  const report = buildMatchReport(createSampleMatch())
  assert.deepEqual(report.score, { ours: 69, opponent: 63 })
  assert.equal(report.periods.length, 4)
  assert.equal(report.periods.reduce((total, period) => total + period.ours, 0), report.score.ours)
  assert.deepEqual(report.playByPlay.at(-1)?.score, report.score)
  assert.equal(report.timedFlow, true)
  assert.equal(report.flowEnd, 40)
  assert.equal(Object.values(report.playingTime ?? {}).reduce((sum, time) => sum + time, 0), 200 * 60_000)
  assert.equal(Object.values(report.plusMinus).reduce((sum, value) => sum + value, 0), 5 * (69 - 63))
})
