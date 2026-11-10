import { createMatch, localDate, recordShot } from './basket.ts'
import { clubShortName } from './club.ts'

export const exampleRoster = Array.from({ length: 10 }, (_, index) => ({ id: `joueur-${index + 1}`, displayName: `Joueur ${index + 1}` }))
export const exampleStarters = exampleRoster.slice(0, 5).map(({ id }) => id)

export const legacyDemoId = '9b1d199d-33aa-4aac-9898-369123d75276'
export const demoId = 'essai-frejus'

export function createDemo() {
  let match = createMatch({
    homeTeamName: clubShortName, opponentName: 'Fréjus', date: localDate(), host: 'ours',
    season: { id: '4c23923f-7aca-44bf-9502-a2089c62d444', name: 'Entraînement' },
    roster: exampleRoster, starters: exampleStarters,
    mode: 'offensive',
  }, 'demo', demoId)

  match = recordShot(match, { team: 'ours', playerId: exampleStarters[2] }, '3', 'made')
  match = recordShot(match, { team: 'opponent', playerId: null }, '3', 'made')
  match = recordShot(match, { team: 'ours', playerId: exampleStarters[4] }, '2', 'made')
  match = recordShot(match, { team: 'ours', playerId: exampleStarters[0] }, '2', 'made')
  match = recordShot(match, { team: 'opponent', playerId: null }, '2', 'made')
  return recordShot(match, { team: 'ours', playerId: exampleStarters[3] }, '3', 'missed')
}
