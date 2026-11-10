export type Mode = 'offensive' | 'essential' | 'complete'
export type Team = 'ours' | 'opponent'
export type Zone = '2' | '3' | 'FT'
export type Result = 'made' | 'missed'
export type Coverage = 'not_tracked' | 'tracked' | 'partial'
export type CountAction = 'oreb' | 'dreb' | 'assist' | 'steal' | 'block' | 'turnover' | 'foul'
export type Category = 'rebounds' | 'assists' | 'steals' | 'blocks' | 'turnovers' | 'fouls'
export type Subject = { team: 'ours'; playerId: string } | { team: 'opponent'; playerId: null }

export interface Player {
  id: string
  number?: string
  displayName: string
  firstName?: string
  lastName?: string
}

export interface MatchSetup {
  homeTeamName: string
  opponentName: string
  date: string
  venue?: string
  host?: Team
  season: { id: string; name: string }
  roster: Player[]
  starters: string[]
  mode: Mode
}

interface EventHeader {
  id: string
  matchId: string
  sequence: number
  recordedAt: string
  quarter: number
  clockRemainingMs?: number
}

export type ShotEvent = EventHeader & Subject & {
  type: 'shot'
  zone: Zone
  result: Result
  assistPlayerId: string | null
}

type CountEvent = EventHeader & { type: CountAction; team: 'ours'; playerId: string }
type Substitution = { outPlayerId: string; inPlayerId: string }
type RotationEvent = EventHeader & { type: 'rotation' } & (Substitution | { substitutions: Substitution[] })
export type MatchEvent = ShotEvent | CountEvent | RotationEvent

type Change = { before: MatchEvent | null; after: MatchEvent } | { before: MatchEvent; after: null }

export interface PeriodClock {
  remainingMs: number
  startedAt: number | null
  durationMs?: number
}

export interface Match extends MatchSetup {
  id: string
  kind: 'match' | 'demo'
  quarter: number
  periodClocks?: Partial<Record<number, PeriodClock>>
  clockHasRun?: boolean
  finishedAt?: string
  coverage: { ours: Record<Category, Coverage>; opponent: { shooting: Coverage } }
  events: MatchEvent[]
  undoStack: Change[]
  nextSequence: number
}

export const modes: { id: Mode; label: string }[] = [
  { id: 'offensive', label: 'Offensif' },
  { id: 'essential', label: 'Essentiel' },
  { id: 'complete', label: 'Complet' },
]

export const shots: { zone: Zone; result: Result; label: string }[] = [
  { zone: '2', result: 'made', label: '+2' },
  { zone: '3', result: 'made', label: '+3' },
  { zone: 'FT', result: 'made', label: 'LF +1' },
  { zone: '2', result: 'missed', label: '2 raté' },
  { zone: '3', result: 'missed', label: '3 raté' },
  { zone: 'FT', result: 'missed', label: 'LF raté' },
]

export const countActions: Record<CountAction, { label: string; category: Category; mode: Mode }> = {
  oreb: { label: 'Reb. offensif', category: 'rebounds', mode: 'essential' },
  dreb: { label: 'Reb. défensif', category: 'rebounds', mode: 'essential' },
  assist: { label: 'Passe décisive', category: 'assists', mode: 'essential' },
  steal: { label: 'Interception', category: 'steals', mode: 'complete' },
  block: { label: 'Contre', category: 'blocks', mode: 'complete' },
  turnover: { label: 'Balle perdue', category: 'turnovers', mode: 'complete' },
  foul: { label: 'Faute', category: 'fouls', mode: 'complete' },
}

const categoryModes: Record<Category, Mode> = {
  rebounds: 'essential', assists: 'essential', steals: 'complete',
  blocks: 'complete', turnovers: 'complete', fouls: 'complete',
}
const modeRank: Record<Mode, number> = { offensive: 0, essential: 1, complete: 2 }
const categories = Object.keys(categoryModes) as Category[]

export function actionAvailable(mode: Mode, action: CountAction) {
  return action !== 'assist' && modeRank[mode] >= modeRank[countActions[action].mode]
}

export function localDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

// randomUUID is unavailable on the HTTP LAN address used for a phone preview.
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function categoryCoverage(mode: Mode, category: Category): Coverage {
  return modeRank[mode] >= modeRank[categoryModes[category]] ? 'tracked' : 'not_tracked'
}

function validStarters(roster: Player[], starters: readonly string[]) {
  return starters.length <= 5 && new Set(starters).size === starters.length &&
    starters.every((id) => roster.some((player) => player.id === id))
}

export function createMatch(setup: MatchSetup, kind: Match['kind'] = 'match', id = newId()): Match {
  if (!setup.homeTeamName.trim() || !setup.opponentName.trim() || !setup.date || !setup.season.name.trim()) {
    throw new Error('Renseigner les deux équipes, la date et la saison.')
  }
  if (setup.roster.length < 5 || new Set(setup.roster.map((player) => player.id)).size !== setup.roster.length ||
      setup.roster.some((player) => !player.displayName.trim()) ||
      !validStarters(setup.roster, setup.starters)) {
    throw new Error('Choisir cinq titulaires distincts dans l’effectif.')
  }

  return {
    ...setup, id, kind, quarter: 1, clockHasRun: false, events: [], undoStack: [], nextSequence: 1,
    coverage: {
      ours: Object.fromEntries(categories.map((category) => [category, categoryCoverage(setup.mode, category)])) as Record<Category, Coverage>,
      opponent: { shooting: 'tracked' },
    },
  }
}

function hasClockRun(match: Match) {
  // Older saves did not record whether the clock had ever started.
  return match.clockHasRun ?? Object.values(match.periodClocks ?? {}).some((clock) => clock &&
    (clock.startedAt !== null || (clock.durationMs !== undefined && clock.remainingMs < clock.durationMs)))
}

export function canEditStarters(match: Match) {
  return !match.finishedAt && match.nextSequence === 1 && !hasClockRun(match)
}

export function setStarters(match: Match, starters: readonly string[]) {
  if (!canEditStarters(match)) throw new Error('Le cinq majeur est verrouillé après le début du match.')
  if (starters.length !== 5 || !validStarters(match.roster, starters)) throw new Error('Choisir cinq titulaires distincts dans l’effectif.')
  if (starters.every((id, index) => match.starters[index] === id)) return match
  return { ...match, starters: [...starters] }
}

export function rotationSubstitutions(event: RotationEvent): Substitution[] {
  // Earlier matches stored one substitution directly on the event.
  return 'substitutions' in event ? event.substitutions : [event]
}

export function activePlayerIds(match: Match, beforeSequence = Infinity) {
  let active = match.starters
  for (const event of match.events) {
    if (event.sequence >= beforeSequence) break
    if (event.type === 'rotation') active = lineupAfterRotation(active, event)
  }
  return active
}

export function lineupAfterRotation(active: string[], event: RotationEvent) {
  const substitutions = new Map(rotationSubstitutions(event).map(({ outPlayerId, inPlayerId }) => [outPlayerId, inPlayerId]))
  return active.map((id) => substitutions.get(id) ?? id)
}

function changeEvent(match: Match, after: MatchEvent, before: MatchEvent | null = null): Match {
  if (match.starters.length !== 5) throw new Error('Choisir le cinq majeur avant de commencer.')
  return {
    ...match,
    events: before ? match.events.map((event) => event.id === before.id ? after : event) : [...match.events, after],
    undoStack: [...match.undoStack, { before, after }],
    nextSequence: before ? match.nextSequence : match.nextSequence + 1,
  }
}

function eventHeader(match: Match): EventHeader {
  const now = Date.now()
  const clock = match.periodClocks?.[match.quarter]
  return {
    id: newId(), matchId: match.id, sequence: match.nextSequence,
    recordedAt: new Date(now).toISOString(), quarter: match.quarter,
    ...(clock && { clockRemainingMs: remainingClockMs(clock, now) }),
  }
}

function checkActive(match: Match, playerId: string) {
  if (!activePlayerIds(match).includes(playerId)) throw new Error('Choisir un joueur sur le terrain.')
}

export function recordShot(match: Match, subject: Subject, zone: Zone, result: Result) {
  if (subject.team === 'ours') checkActive(match, subject.playerId)
  return changeEvent(match, { ...eventHeader(match), ...subject, type: 'shot', zone, result, assistPlayerId: null })
}

export function recordCount(match: Match, playerId: string, action: CountAction) {
  checkActive(match, playerId)
  if (!actionAvailable(match.mode, action)) throw new Error('Cette action est masquée dans le profil actif.')
  return changeEvent(match, { ...eventHeader(match), type: action, team: 'ours', playerId })
}

export function rotate(match: Match, outIds: readonly string[], inIds: readonly string[]) {
  if (!outIds.length || outIds.length !== inIds.length) {
    throw new Error('Choisir autant de sortants que d’entrants.')
  }
  if (new Set(outIds).size !== outIds.length || new Set(inIds).size !== inIds.length) {
    throw new Error('Sélectionner chaque joueur une seule fois.')
  }
  const active = activePlayerIds(match)
  if (outIds.some((id) => !active.includes(id))) throw new Error('Choisir les sortants parmi les joueurs sur le terrain.')
  if (inIds.some((id) => active.includes(id) || !match.roster.some((player) => player.id === id))) {
    throw new Error('Choisir les entrants parmi les joueurs du banc.')
  }
  const substitutions = outIds.map((outPlayerId, index) => ({ outPlayerId, inPlayerId: inIds[index] }))
  return changeEvent(match, { ...eventHeader(match), type: 'rotation', substitutions })
}

export function isAssistable(event: MatchEvent): event is ShotEvent & { team: 'ours'; playerId: string } {
  return event.type === 'shot' && event.team === 'ours' && event.result === 'made' && event.zone !== 'FT'
}

export function assistCandidateIds(match: Match, shot: ShotEvent & { team: 'ours' }) {
  return activePlayerIds(match, shot.sequence).filter((id) => id !== shot.playerId)
}

export function setAssist(match: Match, shotId: string, playerId: string | null) {
  const shot = match.events.find((event) => event.id === shotId)
  if (!shot || !isAssistable(shot)) throw new Error('Ce panier ne peut pas recevoir de passe décisive.')
  if (playerId !== null && !assistCandidateIds(match, shot).includes(playerId)) {
    throw new Error('Choisir un autre joueur qui était sur le terrain au moment du panier.')
  }
  if (shot.assistPlayerId === playerId) return match
  return changeEvent(match, { ...shot, assistPlayerId: playerId }, shot)
}

export function deleteEvent(match: Match, id: string): Match {
  const index = match.events.findIndex((event) => event.id === id)
  if (index === -1) return match
  const removed = match.events[index]
  const laterEvents = match.events.slice(index + 1)

  if (removed.type === 'rotation') {
    const substitutions = rotationSubstitutions(removed)
    const outgoing = new Set(substitutions.map(({ outPlayerId }) => outPlayerId))
    const incoming = new Set(substitutions.map(({ inPlayerId }) => inPlayerId))
    const hasDependentEvent = laterEvents.some((event) => {
      if (event.type === 'rotation') {
        return rotationSubstitutions(event).some(({ outPlayerId, inPlayerId }) => incoming.has(outPlayerId) || outgoing.has(inPlayerId))
      }
      return event.team === 'ours' && (incoming.has(event.playerId) ||
        (event.type === 'shot' && event.assistPlayerId !== null && incoming.has(event.assistPlayerId)))
    })
    if (hasDependentEvent) throw new Error('Supprime d’abord les actions plus récentes qui dépendent de cette rotation.')
  }

  return {
    ...match,
    events: [...match.events.slice(0, index), ...laterEvents],
    undoStack: [...match.undoStack, { before: removed, after: null }],
  }
}

export function undo(match: Match): Match {
  const last = match.undoStack.at(-1)
  if (!last) return match
  const { before, after } = last
  let events: MatchEvent[]
  if (after === null) {
    events = [...match.events, before].sort((a, b) => a.sequence - b.sequence)
  } else if (before) {
    events = match.events.map((event) => event.id === after.id ? before : event)
  } else {
    events = match.events.filter((event) => event.id !== after.id)
  }
  return {
    ...match,
    events,
    undoStack: match.undoStack.slice(0, -1),
  }
}

export function getPeriodClock(match: Match): PeriodClock {
  const durationMs = (match.quarter <= 4 ? 10 : 5) * 60_000
  return match.periodClocks?.[match.quarter] ?? {
    remainingMs: durationMs,
    durationMs,
    startedAt: null,
  }
}

export function remainingClockMs(clock: PeriodClock, now = Date.now()) {
  const elapsed = clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt)
  return Math.max(0, clock.remainingMs - elapsed)
}

export function formatClock(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function withPeriodClock(match: Match, clock: PeriodClock): Match {
  return { ...match, periodClocks: { ...match.periodClocks, [match.quarter]: clock } }
}

export function setClockRunning(match: Match, running: boolean, now = Date.now()) {
  const clock = getPeriodClock(match)
  const remainingMs = remainingClockMs(clock, now)
  if (running && (clock.startedAt !== null || remainingMs === 0)) return match
  if (!running && clock.startedAt === null) return match
  if (running && match.starters.length !== 5) throw new Error('Choisir le cinq majeur avant de commencer.')
  return withPeriodClock({ ...match, clockHasRun: true }, { ...clock, remainingMs, startedAt: running ? now : null })
}

export function setClockTime(match: Match, seconds: number) {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds >= 100 * 60) throw new Error('Temps restant invalide.')
  const previous = match.periodClocks?.[match.quarter]
  const remainingMs = seconds * 1000
  const hasEvents = match.events.some((event) => event.quarter === match.quarter)
  const durationMs = previous ? previous.durationMs : hasEvents ? undefined : remainingMs
  return withPeriodClock({ ...match, clockHasRun: hasClockRun(match) }, { remainingMs, startedAt: null, durationMs })
}

export function setQuarter(match: Match, quarter: number, now = Date.now()) {
  if (!Number.isSafeInteger(quarter) || quarter < 1) throw new Error('Quart-temps invalide.')
  if (quarter === match.quarter) return match
  return { ...setClockRunning(match, false, now), quarter }
}

export function matchEndState(match: Match, now = Date.now()) {
  if (match.finishedAt) return 'finished'
  if (match.starters.length !== 5 || match.quarter < 4 || remainingClockMs(getPeriodClock(match), now) > 0) return 'playing'
  const playedLaterPeriod = match.events.some((event) => event.quarter > match.quarter)
    || Object.keys(match.periodClocks ?? {}).some((quarter) => Number(quarter) > match.quarter)
  if (playedLaterPeriod) return 'playing'
  const { ours, opponent } = summarize(match)
  return ours.points === opponent.points ? 'overtime' : 'ready'
}

export function finishMatch(match: Match, now = Date.now()): Match {
  if (matchEndState(match, now) !== 'ready') throw new Error('Valide le score à 00:00 en fin de match, après avoir départagé les équipes.')
  return { ...setClockRunning(match, false, now), finishedAt: new Date(now).toISOString() }
}

export function startOvertime(match: Match, now = Date.now()): Match {
  if (matchEndState(match, now) !== 'overtime') throw new Error('La prolongation est proposée en cas d’égalité à la fin du temps de jeu.')
  return setQuarter(match, match.quarter + 1, now)
}

function changeCoverage(previous: Coverage, wasEnabled: boolean, willBeEnabled: boolean, started: boolean): Coverage {
  if (!started) return willBeEnabled ? 'tracked' : 'not_tracked'
  if (wasEnabled === willBeEnabled) return previous
  return 'partial'
}

export function setTracking(match: Match, mode: Mode) {
  // nextSequence remembers play even after the user undoes all recorded events.
  const started = match.nextSequence > 1 || match.quarter > 1
  const ours = { ...match.coverage.ours }
  for (const category of categories) {
    ours[category] = changeCoverage(ours[category], categoryCoverage(match.mode, category) === 'tracked',
      categoryCoverage(mode, category) === 'tracked', started)
  }
  return { ...match, mode, coverage: { ...match.coverage, ours } }
}

export function selectionAfterShot(subject: Subject, zone: Zone) {
  return zone === 'FT' ? subject : null
}

export function shotPoints(event: MatchEvent) {
  if (event.type !== 'shot' || event.result === 'missed') return 0
  return event.zone === 'FT' ? 1 : Number(event.zone)
}

export function percentage(made: number, attempted: number) {
  return attempted === 0 ? null : made / attempted * 100
}

export function playerStats() {
  return {
    points: 0,
    shots: { '2': { made: 0, attempted: 0 }, '3': { made: 0, attempted: 0 }, FT: { made: 0, attempted: 0 } },
    oreb: 0, dreb: 0, assist: 0, steal: 0, block: 0, turnover: 0, foul: 0,
  }
}

type Line = ReturnType<typeof playerStats>

function countShot(line: Line, event: ShotEvent, points: number) {
  const zone = line.shots[event.zone]
  zone.attempted++
  if (event.result === 'made') zone.made++
  line.points += points
}

export function summarize(match: Match) {
  const players = Object.fromEntries(match.roster.map((player) => [player.id, playerStats()]))
  const ours = playerStats()
  const opponent = playerStats()
  for (const event of match.events) {
    if (event.type === 'rotation') continue
    if (event.type === 'shot') {
      const points = shotPoints(event)
      if (event.team === 'opponent') {
        countShot(opponent, event, points)
      } else {
        countShot(ours, event, points)
        countShot(players[event.playerId], event, points)
        if (event.assistPlayerId) {
          players[event.assistPlayerId].assist++
          ours.assist++
        }
      }
    } else {
      players[event.playerId][event.type]++
      ours[event.type]++
    }
  }
  const coverage = { ...match.coverage.ours }
  if (coverage.assists === 'not_tracked' && ours.assist > 0) coverage.assists = 'partial'
  return { players, ours, opponent, coverage }
}

export function eventLabel(event: MatchEvent) {
  if (event.type === 'rotation') return 'Rotation'
  if (event.type !== 'shot') return countActions[event.type].label
  return shots.find((shot) => shot.zone === event.zone && shot.result === event.result)!.label
}
