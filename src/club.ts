import type { Player } from './basket.ts'

export const clubName = 'Brignoles Basket Ball'
export const clubShortName = 'Brignoles'
export type ClubPlayer = Player & { archived?: boolean }

export const initialClubRoster: ClubPlayer[] = []

export function shortPlayerName(player: Player) {
  const displayName = player.displayName.trim()
  const { firstName, lastName } = player
  return firstName && lastName && `${firstName} ${lastName}` === displayName
    ? `${firstName} ${lastName[0].toLocaleUpperCase('fr')}.` : displayName
}

export function teamName(name: string) {
  return name === clubName ? clubShortName : name
}
