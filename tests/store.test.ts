import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activePlayerIds, createMatch, finishMatch, getPeriodClock, newId, recordShot, remainingClockMs, rotate,
  setAssist, setClockRunning, setClockTime, setQuarter, summarize, undo,
} from '../src/basket.ts'
import type { MatchEvent } from '../src/basket.ts'
import { createDemo, demoId, legacyDemoId } from '../src/demo.ts'
import { createMatchStore } from '../src/store.ts'

function seedMatch(store: ReturnType<typeof createMatchStore>) {
  return store.saveAndSelect({ ...createDemo(), kind: 'match' })
}

test('l’effectif du club se conserve indépendamment de la convocation déjà enregistrée', async () => {
  const database = newId()
  const store = createMatchStore(database)
  for (const player of createDemo().roster) await store.updateClubPlayer(player)
  const club = await store.clubRoster()
  const roster = club.slice(0, 6)
  const match = await store.saveAndSelect(createMatch({ ...createDemo(), roster, starters: roster.slice(0, 5).map(({ id }) => id) }))
  await store.updateClubPlayer({ ...club[0], displayName: 'Nouveau nom', archived: true })
  const reopened = createMatchStore(database)
  assert.equal((await reopened.clubRoster())[0].archived, true)
  assert.equal((await reopened.clubRoster())[0].number, undefined)
  assert.equal((await reopened.select(match.id)).roster[0].displayName, club[0].displayName)
})

test('retrouve le match actif, le score et l’annulation après réouverture de la base', async () => {
  const database = newId()
  const store = createMatchStore(database)
  const match = await store.saveAndSelect(createMatch({ ...createDemo(), homeTeamName: 'Club réel' }))
  const shot = await store.update(match.id, (previous) =>
    recordShot(previous, { team: 'ours', playerId: match.starters[0] }, '2', 'made'))
  const afterReload = createMatchStore(database)
  assert.deepEqual(await afterReload.select(), shot)
  assert.equal(summarize(await afterReload.update(match.id, undo)).ours.points, 0)
})

test('retrouve un chrono en cours après réouverture du match', async () => {
  const database = newId()
  const store = createMatchStore(database)
  await seedMatch(store)
  await store.update(demoId, (match) => setClockRunning(match, true, 1_000))
  const reopened = await createMatchStore(database).select(demoId)
  assert.equal(remainingClockMs(getPeriodClock(reopened), 17_000), 584_000)
})

test('sérialise deux LF rapprochés et deux écritures concurrentes de la même passe', async () => {
  const database = newId()
  const one = createMatchStore(database)
  const two = createMatchStore(database)
  const demo = await seedMatch(one)
  const shooter = { team: 'ours', playerId: demo.starters[1] } as const
  await Promise.all([one.update(demoId, (match) => recordShot(match, shooter, 'FT', 'made')),
    two.update(demoId, (match) => recordShot(match, shooter, 'FT', 'made'))])
  const recorded = await two.select(demoId)
  assert.equal(summarize(recorded).ours.shots.FT.made, 2)
  const shot = recorded.events.find((event) => event.type === 'shot' && event.team === 'ours' && event.zone === '2')!
  await Promise.all([one.update(demoId, (match) => setAssist(match, shot.id, demo.starters[1])),
    two.update(demoId, (match) => setAssist(match, shot.id, demo.starters[1]))])
  const assisted = await one.select(demoId)
  assert.equal(summarize(assisted).ours.assist, 1)
  assert.equal(assisted.undoStack.length, recorded.undoStack.length + 1)
})

test('un premier lancement démarre sans match ni score préchargé', async () => {
  const store = createMatchStore(newId())
  assert.equal(await store.select(), undefined)
  assert.deepEqual(await store.list(), [])
})

test('supprime seulement le match choisi et oublie sa sélection après réouverture', async () => {
  const database = newId()
  const store = createMatchStore(database)
  const kept = await store.saveAndSelect(createMatch(createDemo()))
  const removed = await store.saveAndSelect(createMatch(createDemo()))
  await store.remove(removed.id)

  const reopened = createMatchStore(database)
  assert.equal(await reopened.select(), undefined)
  assert.deepEqual(await reopened.list(), [kept])
  await assert.rejects(reopened.get(removed.id), /n’est plus disponible/)
  await reopened.select(kept.id)
  await reopened.remove(removed.id)
  assert.deepEqual(await reopened.select(), kept)
})

test('transfère l’effectif et les matchs entre deux bases sans écraser les données présentes', async () => {
  const source = createMatchStore(newId())
  const destination = createMatchStore(newId())
  const player = { id: newId(), displayName: 'Joueur de la sauvegarde' }
  await source.updateClubPlayer(player)
  await destination.updateClubPlayer({ ...player, displayName: 'Nom modifié en ligne' })
  const archived = { id: newId(), displayName: 'Ancien joueur', archived: true }
  await source.updateClubPlayer(archived)
  const match = await seedMatch(source)
  const draft = await destination.saveAndSelect(createMatch(createDemo()))
  const exported = await source.exportBackup()
  const backup = JSON.stringify(exported)

  assert.deepEqual(await destination.importBackup(backup), { players: 1, matches: 1 })
  assert.deepEqual(await destination.importBackup(backup), { players: 0, matches: 0 })
  assert.deepEqual(await destination.get(match.id), match)
  assert.deepEqual(await destination.select(), draft)
  assert.equal((await destination.clubRoster()).find(({ id }) => id === player.id)?.displayName, 'Nom modifié en ligne')
  assert.deepEqual((await destination.clubRoster()).find(({ id }) => id === archived.id), archived)

  const before = await destination.exportBackup()
  await assert.rejects(destination.importBackup(JSON.stringify({ ...exported, matches: [{ ...match, events: [{}] }] })), /incompatible/)
  assert.deepEqual(await destination.exportBackup(), before)
})

test('masque les anciens essais et conserve les matchs enregistrés', async () => {
  const store = createMatchStore(newId())
  const real = await store.saveAndSelect(createMatch(createDemo()))
  const oldDemo = { ...createDemo(), id: legacyDemoId, opponentName: 'Visiteurs' }
  await store.saveAndSelect(oldDemo)
  await store.saveAndSelect(createDemo())
  assert.equal(await store.select(), undefined)
  assert.deepEqual(await store.list(), [real])
  await assert.rejects(store.select(legacyDemoId), /match n’est plus disponible/)
  assert.deepEqual(await store.get(legacyDemoId), oldDemo)
  assert.deepEqual(await store.select(real.id), real)
})

test('conserve la validation après rechargement et autorise la correction après réouverture', async () => {
  const database = newId()
  const store = createMatchStore(database)
  const demo = await seedMatch(store)
  await store.update(demoId, (match) => finishMatch(setClockTime(setQuarter(match, 4), 0)))
  const reopenedStore = createMatchStore(database)
  const finished = await reopenedStore.select()
  assert.ok(finished?.finishedAt)
  await assert.rejects(reopenedStore.update(demoId, undo), /match est validé/)
  const reopened = await reopenedStore.reopen(demoId)
  assert.equal(reopened.finishedAt, undefined)
  assert.deepEqual(reopened.events, demo.events)
  assert.equal((await reopenedStore.update(demoId, undo)).events.length, demo.events.length - 1)
})

test('une écriture invalide ne modifie pas le match et la base reste utilisable', async () => {
  const store = createMatchStore(newId())
  const demo = await seedMatch(store)
  const bench = demo.roster.find((player) => !demo.starters.includes(player.id))!
  await assert.rejects(store.update(demoId, (match) =>
    recordShot(match, { team: 'ours', playerId: bench.id }, '2', 'made')), /joueur sur le terrain/)
  assert.deepEqual(await store.select(), demo)
  assert.equal(summarize(await store.update(demoId, (match) =>
    recordShot(match, { team: 'opponent', playerId: null }, '3', 'made'))).opponent.points, 8)
})

test('rend le suivi adverse disponible dans les anciens matchs et signale les historiques incomplets', async () => {
  const store = createMatchStore(newId())
  const demo = await seedMatch(store)
  const coverage = { ...demo.coverage, opponent: { shooting: 'not_tracked' as const } }
  const legacy = { ...demo, coverage, opponentDetailedShots: false }
  const oldMatch = await store.saveAndSelect(legacy)
  const reopened = await store.select(oldMatch.id)
  assert.deepEqual(reopened.events, demo.events)
  assert.equal(reopened.coverage.opponent.shooting, 'partial')
  const updated = await store.update(reopened.id, (match) => recordShot(match, { team: 'opponent', playerId: null }, 'FT', 'missed'))
  assert.equal(updated.coverage.opponent.shooting, 'partial')
  assert.equal(summarize(updated).opponent.shots.FT.attempted, 1)

  const empty = await store.saveAndSelect({ ...createMatch(demo), coverage })
  assert.equal((await store.select(empty.id)).coverage.opponent.shooting, 'tracked')
})

test('annule une rotation multiple en une fois après rechargement, au-dessus d’une ancienne rotation', async () => {
  const database = newId()
  const store = createMatchStore(database)
  const demo = await seedMatch(store)
  const [hugo, lilian, mika, thomas, nathan] = demo.starters
  const [alex, camille] = demo.roster.filter((player) => !demo.starters.includes(player.id)).map((player) => player.id)
  const legacy: MatchEvent = {
    id: newId(), matchId: demo.id, quarter: demo.quarter, sequence: demo.nextSequence,
    recordedAt: new Date().toISOString(), type: 'rotation', outPlayerId: hugo, inPlayerId: alex,
  }
  const before = await store.saveAndSelect({
    ...demo, events: [...demo.events, legacy], nextSequence: demo.nextSequence + 1,
    undoStack: [...demo.undoStack, { before: null, after: legacy }],
  })
  await store.update(demoId, (match) => rotate(match, [lilian, mika], [hugo, camille]))

  const reopened = createMatchStore(database)
  const rotated = await reopened.select(demoId)
  assert.deepEqual(activePlayerIds(rotated), [alex, hugo, camille, thomas, nathan])
  assert.equal(rotated.events.length, before.events.length + 1)
  assert.deepEqual(summarize(rotated), summarize(before))
  const restored = await reopened.update(demoId, undo)
  assert.deepEqual(restored.events, before.events)
  assert.deepEqual(activePlayerIds(restored), [alex, lilian, mika, thomas, nathan])
})
