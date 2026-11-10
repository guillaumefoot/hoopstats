import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activePlayerIds, canEditStarters, createMatch, deleteEvent, finishMatch, formatClock, getPeriodClock, isAssistable, matchEndState, percentage, recordCount,
  recordShot, remainingClockMs, rotate, selectionAfterShot, setAssist, setClockRunning, setClockTime, setQuarter,
  setStarters, setTracking, startOvertime, summarize, undo,
} from '../src/basket.ts'
import type { Mode, Subject } from '../src/basket.ts'

function fixture(mode: Mode = 'offensive') {
  const roster = ['Hugo', 'Lilian', 'Mika', 'Thomas', 'Nathan', 'Alex'].map((displayName, index) => ({
    id: displayName.toLowerCase(), displayName, number: String(index + 1),
  }))
  return createMatch({
    homeTeamName: 'Notre club', opponentName: 'Visiteurs', date: '2026-11-10',
    season: { id: 'season', name: '2026–2027' }, roster, starters: roster.slice(0, 5).map((player) => player.id),
    mode,
  })
}

const hugo = { team: 'ours', playerId: 'hugo' } satisfies Subject
const lilian = { team: 'ours', playerId: 'lilian' } satisfies Subject
const adversaire = { team: 'opponent', playerId: null } satisfies Subject

test('dérive les points, réussites et tentatives de chaque type de tir', () => {
  let match = recordShot(fixture(), hugo, '2', 'made')
  match = recordShot(match, hugo, '2', 'missed')
  match = recordShot(match, hugo, '3', 'made')
  match = recordShot(match, hugo, '3', 'missed')
  match = recordShot(match, lilian, 'FT', 'made')
  match = recordShot(match, lilian, 'FT', 'missed')
  match = recordShot(match, adversaire, '3', 'made')
  const stats = summarize(match)
  assert.equal(stats.ours.points, 6)
  assert.equal(stats.opponent.points, 3)
  assert.equal(stats.players.hugo.points, 5)
  assert.equal(stats.players.lilian.points, 1)
  for (const zone of Object.values(stats.ours.shots)) assert.deepEqual(zone, { made: 1, attempted: 2 })
  assert.equal(percentage(2, 4), 50)
  assert.equal(percentage(0, 2), 0)
  assert.equal(percentage(0, 0), null)
})

test('garde le tireur après chaque LF et désélectionne après un tir de jeu', () => {
  assert.equal(selectionAfterShot(lilian, 'FT'), lilian)
  assert.equal(selectionAfterShot(lilian, '2'), null)
  assert.equal(selectionAfterShot(adversaire, '3'), null)
  const match = recordShot(recordShot(fixture(), lilian, 'FT', 'made'), lilian, 'FT', 'made')
  assert.equal(summarize(match).players.lilian.points, 2)
  assert.deepEqual(match.events.map((event) => event.sequence), [1, 2])
})

test('associe la passe au panier choisi après un panier adverse, sans doublon', () => {
  let match = recordShot(fixture(), hugo, '2', 'made')
  const shotId = match.events[0].id
  match = recordShot(match, adversaire, '2', 'made')
  match = setAssist(match, shotId, 'lilian')
  assert.equal(setAssist(match, shotId, 'lilian'), match)
  assert.equal(match.events.length, 2)
  assert.equal(summarize(match).ours.points, 2)
  assert.equal(summarize(match).players.lilian.assist, 1)
  assert.equal(summarize(match).coverage.assists, 'partial')
  assert.equal(summarize(setAssist(match, shotId, 'mika')).players.lilian.assist, 0)
  assert.equal(summarize(setAssist(match, shotId, null)).ours.assist, 0)
  const undone = undo(match)
  assert.equal(summarize(undone).ours.assist, 0)
  assert.equal(summarize(undone).opponent.points, 2)
})

test('refuse le tireur comme passeur et exclut tirs adverses, ratés et LF', () => {
  let match = recordShot(fixture(), hugo, '2', 'made')
  assert.throws(() => setAssist(match, match.events[0].id, 'hugo'), /autre joueur/)
  assert.throws(() => setAssist(match, match.events[0].id, 'inconnu'), /autre joueur/)
  match = recordShot(match, hugo, 'FT', 'made')
  match = recordShot(match, hugo, '2', 'missed')
  match = recordShot(match, adversaire, '3', 'made')
  for (const event of match.events.slice(1)) {
    assert.equal(isAssistable(event), false)
    assert.throws(() => setAssist(match, event.id, 'lilian'), /ne peut pas/)
  }
})

test('choisit le passeur parmi les coéquipiers sur le terrain au moment du panier', () => {
  const first = recordShot(fixture(), hugo, '2', 'made')
  const rotated = rotate(first, ['lilian'], ['alex'])
  const match = recordShot(rotated, hugo, '3', 'made')
  const [beforeRotation, rotation, afterRotation] = match.events

  assert.throws(() => setAssist(match, beforeRotation.id, 'alex'), /au moment du panier/)
  const withFirstAssist = setAssist(match, beforeRotation.id, 'lilian')
  assert.equal(summarize(withFirstAssist).players.lilian.assist, 1)

  assert.throws(() => setAssist(withFirstAssist, afterRotation.id, 'lilian'), /au moment du panier/)
  const withBothAssists = setAssist(withFirstAssist, afterRotation.id, 'alex')
  assert.equal(summarize(withBothAssists).players.alex.assist, 1)
  assert.throws(() => deleteEvent(withBothAssists, rotation.id), /dépendent de cette rotation/)
})

test('supprime un panier avec sa passe et le restaure à sa place avec Annuler', () => {
  let match = recordShot(fixture(), hugo, '3', 'made')
  const id = match.events[0].id
  match = setAssist(match, id, 'lilian')
  match = recordShot(match, adversaire, '2', 'made')
  const removed = deleteEvent(match, id)
  const stats = summarize(removed)
  assert.deepEqual(removed.events, match.events.slice(1))
  assert.equal(stats.ours.points, 0)
  assert.equal(stats.opponent.points, 2)
  assert.equal(stats.players.hugo.shots['3'].attempted, 0)
  assert.equal(stats.players.lilian.assist, 0)
  assert.equal(deleteEvent(removed, id), removed)
  assert.deepEqual(undo(removed), match)
})

test('annule un tir en recalculant score et tentatives sans réutiliser sa séquence', () => {
  const initial = fixture()
  const first = recordShot(initial, hugo, '2', 'made')
  const undone = undo(first)
  assert.deepEqual(summarize(undone), summarize(initial))
  assert.equal(recordShot(undone, hugo, '2', 'made').events[0].sequence, 2)
})

test('conserve les événements et distingue couverture complète, partielle et absente', () => {
  const initial = fixture()
  assert.equal(summarize(initial).coverage.rebounds, 'not_tracked')
  const full = setTracking(initial, 'essential')
  assert.equal(summarize(full).coverage.rebounds, 'tracked')
  assert.equal(summarize(full).ours.oreb, 0)
  assert.throws(() => recordCount(initial, 'hugo', 'oreb'), /masquée/)
  const started = recordCount(full, 'hugo', 'oreb')
  const complete = setTracking(started, 'complete')
  assert.equal(complete.coverage.ours.steals, 'partial')
  assert.equal(complete.coverage.ours.rebounds, 'tracked')
  const reduced = setTracking(complete, 'offensive')
  assert.equal(reduced.coverage.ours.rebounds, 'partial')
  assert.equal(summarize(reduced).players.hugo.oreb, 1)
  assert.deepEqual(reduced.events, started.events)
  assert.equal(setTracking(setQuarter(initial, 2), 'essential').coverage.ours.rebounds, 'partial')
})

test('enregistre les trois types de tirs ratés adverses sans modifier le score', () => {
  const initial = fixture()
  let match = recordShot(initial, adversaire, '2', 'made')
  for (const zone of ['2', '3', 'FT'] as const) match = recordShot(match, adversaire, zone, 'missed')
  const { shots, points } = summarize(match).opponent
  assert.deepEqual(shots, { '2': { made: 1, attempted: 2 }, '3': { made: 0, attempted: 1 }, FT: { made: 0, attempted: 1 } })
  assert.equal(points, 2)
  assert.equal(setTracking(match, 'complete').coverage.opponent.shooting, 'tracked')
})

test('archive les rotations, garde cinq joueurs et conserve les stats du sortant', () => {
  const match = recordShot(fixture(), hugo, '2', 'made')
  assert.throws(() => rotate(match, ['hugo'], ['lilian']), /joueurs du banc/)
  const rotated = rotate(match, ['hugo'], ['alex'])
  assert.deepEqual(activePlayerIds(rotated), ['alex', 'lilian', 'mika', 'thomas', 'nathan'])
  assert.equal(summarize(rotated).players.hugo.points, 2)
  assert.throws(() => recordShot(rotated, hugo, '2', 'made'), /sur le terrain/)
  assert.equal(summarize(recordShot(rotated, { team: 'ours', playerId: 'alex' }, '2', 'made')).players.alex.points, 2)
  assert.deepEqual(activePlayerIds(undo(rotated)), activePlayerIds(match))
})

test('refuse les rotations déséquilibrées, les doublons et les sortants hors du terrain', () => {
  const match = fixture()
  assert.throws(() => rotate(match, [], []), /autant de sortants/)
  assert.throws(() => rotate(match, ['hugo', 'lilian'], ['alex']), /autant de sortants/)
  assert.throws(() => rotate(match, ['hugo', 'hugo'], ['alex', 'lilian']), /une seule fois/)
  assert.throws(() => rotate(match, ['hugo', 'lilian'], ['alex', 'alex']), /une seule fois/)
  assert.throws(() => rotate(match, ['alex'], ['hugo']), /joueurs sur le terrain/)
})

test('la suppression d’une rotation préserve les actions suivantes et bloque les dépendances', () => {
  const initial = fixture()
  const rotated = rotate(initial, ['hugo'], ['alex'])
  const rotationId = rotated.events[0].id
  const withOpponentShot = recordShot(rotated, adversaire, '2', 'made')
  const removed = deleteEvent(withOpponentShot, rotationId)
  assert.deepEqual(activePlayerIds(removed), initial.starters)
  assert.equal(summarize(removed).opponent.points, 2)
  assert.deepEqual(undo(removed), withOpponentShot)

  const shotByEntrant = recordShot(rotated, { team: 'ours', playerId: 'alex' }, '2', 'made')
  assert.throws(() => deleteEvent(shotByEntrant, rotationId), /dépendent de cette rotation/)
  const laterRotation = rotate(rotated, ['alex'], ['hugo'])
  assert.throws(() => deleteEvent(laterRotation, rotationId), /dépendent de cette rotation/)
})

test('impose un panier pour saisir une nouvelle passe, même en profil Complet', () => {
  const match = recordShot(fixture('complete'), hugo, '2', 'made')
  assert.throws(() => recordCount(match, 'lilian', 'assist'))
  const assisted = setAssist(match, match.events[0].id, 'lilian')
  assert.equal(summarize(assisted).players.lilian.assist, 1)
})

test('enregistre la période de chaque événement dans son ordre d’entrée', () => {
  let match = recordShot(fixture(), hugo, '2', 'made')
  match = recordShot(setQuarter(match, 2), hugo, '3', 'made')
  assert.deepEqual(match.events.map((event) => [event.sequence, event.quarter]), [[1, 1], [2, 2]])
  assert.throws(() => setQuarter(match, 0), /invalide/)
})

test('le chrono reprend au temps mis en pause et s’arrête à zéro', () => {
  const start = setClockRunning(setClockTime(fixture(), 10), true, 1_000)
  assert.equal(formatClock(remainingClockMs(getPeriodClock(start), 3_300)), '00:08')
  const paused = setClockRunning(start, false, 3_300)
  assert.equal(remainingClockMs(getPeriodClock(paused), 20_000), 7_700)
  const resumed = setClockRunning(paused, true, 20_000)
  assert.equal(remainingClockMs(getPeriodClock(resumed), 23_000), 4_700)
  assert.equal(formatClock(remainingClockMs(getPeriodClock(resumed), 30_000)), '00:00')
  assert.equal(setClockRunning(resumed, true, 30_000), resumed)
})

test('changer de période met la précédente en pause et conserve son temps', () => {
  const first = setClockRunning(fixture(), true, 1_000)
  assert.equal(setQuarter(first, 1, 16_000), first)
  const second = setQuarter(first, 2, 16_000)
  assert.equal(getPeriodClock(second).remainingMs, 600_000)
  assert.deepEqual(getPeriodClock(setQuarter(second, 1, 30_000)), { remainingMs: 585_000, durationMs: 600_000, startedAt: null })
  assert.equal(getPeriodClock(setQuarter(second, 5)).remainingMs, 300_000)
  assert.throws(() => setClockTime(first, -1), /Temps restant invalide/)
})

test('une action conserve le temps restant saisi, même après correction du chrono', () => {
  const initial = recordShot(fixture(), hugo, '2', 'made')
  assert.equal(initial.events[0].clockRemainingMs, undefined)
  const withClock = recordShot(setClockTime(initial, 75), hugo, '2', 'made')
  const reset = setClockTime(withClock, 90)
  assert.equal(reset.events[1].clockRemainingMs, 75_000)
  assert.equal(getPeriodClock(undo(reset)).remainingMs, 90_000)
})

test('la fin du match exige un chrono à zéro et départage les équipes en prolongation', () => {
  const early = setClockTime(recordShot(fixture(), hugo, '2', 'made'), 0)
  assert.equal(matchEndState(early), 'playing')
  assert.throws(() => finishMatch(setQuarter(early, 4)), /00:00/)
  const tied = setClockTime(recordShot(setQuarter(early, 4), adversaire, '2', 'made'), 0)
  assert.equal(matchEndState(tied), 'overtime')
  assert.throws(() => finishMatch(tied), /départagé/)
  const overtime = startOvertime(tied)
  assert.equal(overtime.quarter, 5)
  assert.equal(getPeriodClock(overtime).remainingMs, 300_000)
  const won = setClockTime(recordShot(overtime, hugo, '2', 'made'), 0)
  assert.equal(matchEndState(won), 'ready')
  assert.equal(matchEndState(setQuarter(won, 4)), 'playing')
  assert.equal(matchEndState(finishMatch(won)), 'finished')
})

test('refuse les titulaires en double ou hors effectif', () => {
  const setup = fixture()
  assert.throws(() => createMatch({ ...setup, starters: Array(5).fill('hugo') }), /cinq titulaires distincts/)
  assert.throws(() => createMatch({ ...setup, starters: [...setup.starters.slice(0, 4), 'inconnu'] }), /cinq titulaires distincts/)
})

test('prépare le match sans cinq complet et valide cinq titulaires avant de jouer', () => {
  const initial = fixture()
  const draft = createMatch({ ...initial, starters: ['hugo'] })
  assert.equal(canEditStarters(draft), true)
  assert.throws(() => setClockRunning(draft, true, 1_000), /cinq majeur/)
  assert.throws(() => recordShot(draft, adversaire, '2', 'made'), /cinq majeur/)
  assert.throws(() => setStarters(draft, ['hugo']), /cinq titulaires distincts/)
  const ready = setStarters(draft, initial.starters)
  const adjusted = setClockTime(setClockTime(ready, 600), 480)
  const changed = setStarters(adjusted, ['alex', ...ready.starters.slice(1)])
  assert.deepEqual(activePlayerIds(changed), ['alex', 'lilian', 'mika', 'thomas', 'nathan'])
  assert.equal(getPeriodClock(changed).remainingMs, 480_000)
  assert.deepEqual(changed.events, [])
})

test('verrouille le cinq après le départ du chrono ou une action, même annulée', () => {
  const match = fixture()
  const started = setClockRunning(match, true, 1_000)
  const paused = setClockRunning(started, false, 1_000)
  const undone = undo(recordShot(match, hugo, '2', 'made'))
  const legacyPaused = { ...paused, clockHasRun: undefined, periodClocks: { 1: { ...getPeriodClock(paused), remainingMs: 599_000 } } }

  for (const played of [started, setClockTime(paused, 600), undone, setClockTime(legacyPaused, 600)]) {
    assert.equal(canEditStarters(played), false)
    assert.throws(() => setStarters(played, match.starters), /verrouillé/)
  }
})
