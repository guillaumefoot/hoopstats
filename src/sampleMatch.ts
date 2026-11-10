import { activePlayerIds, createMatch, recordCount, recordShot, rotate, setAssist, setClockTime, setQuarter } from './basket.ts'
import type { Match, Subject, Zone } from './basket.ts'
import { clubShortName } from './club.ts'
import { exampleRoster, exampleStarters } from './demo.ts'

const periods = [
  [[2, 0, 0, 3, 2, 0, 2, 0, 1, 2, 0, 3, 0, 2], [3, 2, 0, 2, 0, 1, 0, 3, 0, 2, 0, 0, 2, 0]],
  [[0, 2, 3, 2, 0, 2, 0, 2, 3, 0, 1, 2, 0, 2], [2, 0, 0, 3, 0, 2, 2, 0, 0, 0, 2, 0, 2, 2]],
  [[0, 2, 0, 2, 0, 0, 3, 0, 2, 1, 0, 2, 2, 0], [2, 2, 0, 3, 2, 0, 0, 2, 3, 0, 0, 2, 0, 2]],
  [[2, 0, 2, 0, 3, 0, 2, 3, 0, 2, 1, 0, 2, 2], [3, 0, 2, 2, 0, 2, 0, 0, 3, 0, 2, 1, 0, 0]],
]

const opponent: Subject = { team: 'opponent', playerId: null }

function sampleRotation(match: Match, count: number, offset: number) {
  const active = activePlayerIds(match)
  const bench = match.roster.map(({ id }) => id).filter((id) => !active.includes(id))
  const outgoing = [...active.slice(offset), ...active.slice(0, offset)].slice(0, count)
  return rotate(match, outgoing, bench.slice(0, count))
}

export function createSampleMatch(): Match {
  let match = createMatch({
    homeTeamName: clubShortName, opponentName: 'Vidauban', date: '2026-11-10',
    venue: 'Gymnase municipal de Brignoles', host: 'ours', season: { id: 'demo-season', name: '2026–2027' },
    roster: exampleRoster, starters: exampleStarters, mode: 'complete',
  }, 'demo', 'exemple-40')

  periods.forEach(([ours, theirs], index) => {
    match = setClockTime(setQuarter(match, index + 1), 600)
    ours.forEach((points, possession) => {
      const remaining = 582 - possession * 43
      match = setClockTime(match, remaining)
      if (possession === 4) match = sampleRotation(match, 3, index)
      if (possession === 9) match = sampleRotation(match, 2, (index + 2) % 5)

      const active = activePlayerIds(match)
      const playerIndex = (possession + index) % active.length
      const playerId = active[playerIndex]
      const teammate = active[(playerIndex + 2) % active.length]
      const subject: Subject = { team: 'ours', playerId }
      const zone: Zone = points === 1 ? 'FT' : points === 3 || (!points && possession % 3 === 0) ? '3' : '2'
      match = recordShot(match, subject, zone, points ? 'made' : 'missed')
      if (points > 1 && possession % 3 !== 0) match = setAssist(match, match.events.at(-1)!.id, teammate)
      if (!points && possession % 3 === 0) match = recordCount(match, teammate, 'oreb')

      const awayPoints = theirs[possession]
      const awayZone: Zone = awayPoints === 1 ? 'FT' : awayPoints === 3 || (!awayPoints && possession % 4 === 0) ? '3' : '2'
      match = setClockTime(match, remaining - 15)
      match = recordShot(match, opponent, awayZone, awayPoints ? 'made' : 'missed')
      if (!awayPoints) match = recordCount(match, teammate, possession % 7 === 0 ? 'block' : 'dreb')
      if (possession === 2) match = recordCount(match, playerId, 'turnover')
      if (possession === 6) match = recordCount(match, playerId, 'steal')
      if (possession === 11) match = recordCount(match, playerId, 'foul')
    })
    match = setClockTime(match, 0)
  })

  return { ...match, undoStack: [] }
}
