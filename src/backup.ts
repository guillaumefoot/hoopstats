import { countActions, modes, shots } from './basket.ts'
import type { Match, Player } from './basket.ts'
import type { ClubPlayer } from './club.ts'

export type Backup = {
  format: 'hoopstats-v1'
  roster: ClubPlayer[]
  matches: Match[]
  currentMatchId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const isText = (value: unknown) => typeof value === 'string' && value.trim().length > 0
const isOptionalText = (value: unknown) => value === undefined || typeof value === 'string'
const isTime = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isPositiveInteger = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const isCoverage = (value: unknown) => value === 'tracked' || value === 'partial' || value === 'not_tracked'
const categories = [...new Set(Object.values(countActions).map(({ category }) => category))]

function isPlayer(value: unknown): value is ClubPlayer {
  return isRecord(value) && isText(value.id) && isText(value.displayName) && isOptionalText(value.firstName) &&
    isOptionalText(value.lastName) && isOptionalText(value.number) && (value.archived === undefined || typeof value.archived === 'boolean')
}

function isRoster(value: unknown): value is Player[] {
  return Array.isArray(value) && value.every(isPlayer) && new Set(value.map(({ id }) => id)).size === value.length
}

function isEvent(value: unknown, matchId: unknown, players: Set<unknown>) {
  if (!isRecord(value) || !isText(value.id) || value.matchId !== matchId || !isText(value.recordedAt) ||
    !isPositiveInteger(value.sequence) || !isPositiveInteger(value.quarter) ||
    (value.clockRemainingMs !== undefined && !isTime(value.clockRemainingMs))) return false

  if (value.type === 'rotation') {
    const substitutions = value.substitutions === undefined ? [value] : value.substitutions
    return Array.isArray(substitutions) && substitutions.length > 0 && substitutions.every((entry) =>
      isRecord(entry) && players.has(entry.outPlayerId) && players.has(entry.inPlayerId))
  }

  if (value.type === 'shot') {
    const validShot = shots.some(({ zone, result }) => value.zone === zone && value.result === result)
    if (!validShot) return false
    return value.team === 'ours'
      ? players.has(value.playerId) && (value.assistPlayerId === null || players.has(value.assistPlayerId))
      : value.team === 'opponent' && value.playerId === null && value.assistPlayerId === null
  }

  return typeof value.type === 'string' && Object.hasOwn(countActions, value.type) && value.team === 'ours' && players.has(value.playerId)
}

function isMatch(value: unknown): value is Match {
  if (!isRecord(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value.id) ||
    (value.kind !== 'match' && value.kind !== 'demo') || !isText(value.homeTeamName) || !isText(value.opponentName) ||
    typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !isOptionalText(value.venue) ||
    (value.host !== undefined && value.host !== 'ours' && value.host !== 'opponent') ||
    !isRecord(value.season) || !isText(value.season.id) || !isText(value.season.name) ||
    !modes.some(({ id }) => id === value.mode) || !isPositiveInteger(value.quarter) || !isPositiveInteger(value.nextSequence) ||
    !isOptionalText(value.finishedAt) || (value.clockHasRun !== undefined && typeof value.clockHasRun !== 'boolean') ||
    !isRoster(value.roster) || !Array.isArray(value.starters) || value.starters.length > 5) return false

  const players = new Set<unknown>(value.roster.map(({ id }) => id))
  if (!value.starters.every((id) => players.has(id)) || new Set(value.starters).size !== value.starters.length) return false
  const coverage = value.coverage
  if (!isRecord(coverage) || !isRecord(coverage.ours) || !isRecord(coverage.opponent) ||
    !isCoverage(coverage.opponent.shooting)) return false
  const ownCoverage = coverage.ours
  if (!categories.every((category) => isCoverage(ownCoverage[category]))) return false

  if (value.periodClocks !== undefined && (!isRecord(value.periodClocks) || !Object.values(value.periodClocks).every((clock) =>
    isRecord(clock) && isTime(clock.remainingMs) && (clock.startedAt === null || isTime(clock.startedAt)) &&
    (clock.durationMs === undefined || isTime(clock.durationMs))))) return false

  const validEvent = (event: unknown) => isEvent(event, value.id, players)
  return Array.isArray(value.events) && value.events.every(validEvent) && Array.isArray(value.undoStack) &&
    value.undoStack.every((change) => isRecord(change) && (change.before === null ? validEvent(change.after) :
      validEvent(change.before) && (change.after === null || validEvent(change.after))))
}

export function parseBackup(text: string): Backup {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Ce fichier ne contient pas une sauvegarde HoopStats lisible.')
  }

  if (!isRecord(value) || value.format !== 'hoopstats-v1' || !isRoster(value.roster) ||
    !Array.isArray(value.matches) || !value.matches.every(isMatch) ||
    new Set(value.matches.map(({ id }) => id)).size !== value.matches.length || !isOptionalText(value.currentMatchId)) {
    throw new Error('La sauvegarde HoopStats est incomplète ou incompatible.')
  }
  return value as Backup
}
