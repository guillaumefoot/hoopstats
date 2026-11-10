import type { Match } from './basket.ts'
import { parseBackup } from './backup.ts'
import type { Backup } from './backup.ts'
import { initialClubRoster } from './club.ts'
import type { ClubPlayer } from './club.ts'

const matchesStore = 'matches'
const sessionStore = 'session'
const currentKey = 'currentMatchId'
const clubRosterKey = 'clubRoster'

function enableOpponentShotTracking(match: Match): Match {
  if (match.coverage.opponent.shooting !== 'not_tracked') return match
  // Past misses cannot be recovered when a match started with tracking disabled.
  const started = match.nextSequence > 1 || match.quarter > 1
  return { ...match, coverage: { ...match.coverage, opponent: { shooting: started ? 'partial' : 'tracked' } } }
}

function request<T>(operation: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () => reject(operation.error)
  })
}

function openDatabase(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const operation = indexedDB.open(name, 1)
    operation.onupgradeneeded = () => {
      const db = operation.result
      db.createObjectStore(matchesStore, { keyPath: 'id' })
      db.createObjectStore(sessionStore)
    }
    operation.onsuccess = () => {
      operation.result.onversionchange = () => operation.result.close()
      resolve(operation.result)
    }
    operation.onerror = () => reject(operation.error)
    operation.onblocked = () => reject(new Error('Fermer les autres onglets de HoopStats et réessayer.'))
  })
}

export function createMatchStore(name = 'stats-basket') {
  let connection: Promise<IDBDatabase> | undefined

  async function transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>) {
    connection ??= openDatabase(name).catch((error: unknown) => {
      connection = undefined
      throw error
    })
    const db = await connection
    const tx = db.transaction([matchesStore, sessionStore], mode)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new Error('Écriture interrompue.'))
    })
    const [value] = await Promise.all([work(tx).catch((error: unknown) => {
      try { tx.abort() } catch { /* IndexedDB may have already aborted. */ }
      throw error
    }), done])
    return value
  }

  function select(id: string): Promise<Match>
  function select(): Promise<Match | undefined>
  function select(id?: string) {
    return transaction('readwrite', async (tx) => {
      const session = tx.objectStore(sessionStore)
      const matches = tx.objectStore(matchesStore)
      const storedId = id ?? await request<string | undefined>(session.get(currentKey))
      const match = storedId ? await request<Match | undefined>(matches.get(storedId)) : undefined
      if (!match || match.kind !== 'match') {
        if (id) throw new Error('Ce match n’est plus disponible.')
        return undefined
      }
      const next = enableOpponentShotTracking(match)
      if (next !== match) await request(matches.put(next))
      await request(session.put(next.id, currentKey))
      return next
    })
  }

  return {
    select,
    exportBackup: () => transaction('readonly', async (tx): Promise<Backup> => {
      const session = tx.objectStore(sessionStore)
      const [roster, matches, currentMatchId] = await Promise.all([
        request<ClubPlayer[] | undefined>(session.get(clubRosterKey)),
        request<Match[]>(tx.objectStore(matchesStore).getAll()),
        request<string | undefined>(session.get(currentKey)),
      ])
      return { format: 'hoopstats-v1', roster: roster ?? initialClubRoster, matches, currentMatchId }
    }),
    importBackup: async (text: string) => {
      const backup = parseBackup(text)
      return transaction('readwrite', async (tx) => {
        const session = tx.objectStore(sessionStore)
        const matches = tx.objectStore(matchesStore)
        const [storedRoster, matchKeys, currentMatchId] = await Promise.all([
          request<ClubPlayer[] | undefined>(session.get(clubRosterKey)),
          request(matches.getAllKeys()),
          request<string | undefined>(session.get(currentKey)),
        ])
        const roster = storedRoster ?? initialClubRoster
        const playerIds = new Set(roster.map(({ id }) => id))
        const matchIds = new Set(matchKeys)
        const newPlayers = backup.roster.filter(({ id }) => !playerIds.has(id))
        const newMatches = backup.matches.filter(({ id }) => !matchIds.has(id))
        if (newPlayers.length) await request(session.put([...roster, ...newPlayers], clubRosterKey))
        await Promise.all(newMatches.map((match) => request(matches.add(match))))
        if ((!currentMatchId || !matchIds.has(currentMatchId)) &&
          backup.matches.some(({ id, kind }) => id === backup.currentMatchId && kind === 'match')) {
          await request(session.put(backup.currentMatchId, currentKey))
        }
        return { players: newPlayers.length, matches: newMatches.filter(({ kind }) => kind === 'match').length }
      })
    },
    get: (id: string) => transaction('readonly', async (tx) => {
      const match: Match | undefined = await request(tx.objectStore(matchesStore).get(id))
      if (!match) throw new Error('Ce match n’est plus disponible.')
      return enableOpponentShotTracking(match)
    }),
    clubRoster: () => transaction('readonly', async (tx) =>
      await request<ClubPlayer[] | undefined>(tx.objectStore(sessionStore).get(clubRosterKey)) ?? initialClubRoster),
    updateClubPlayer: (player: ClubPlayer) => transaction('readwrite', async (tx) => {
      const session = tx.objectStore(sessionStore)
      const roster = await request<ClubPlayer[] | undefined>(session.get(clubRosterKey)) ?? initialClubRoster
      const displayName = player.displayName.trim()
      if (!displayName || displayName.length > 50) {
        throw new Error('Saisir un nom d’affichage de 50 caractères au maximum.')
      }
      const updated = { ...player, displayName }
      const next = roster.some(({ id }) => id === player.id)
        ? roster.map((entry) => entry.id === player.id ? updated : entry)
        : [...roster, updated]
      await request(session.put(next, clubRosterKey))
      return next
    }),
    list: () => transaction('readonly', async (tx) => {
      const all: Match[] = await request(tx.objectStore(matchesStore).getAll())
      return all.filter((match) => match.kind === 'match').map(enableOpponentShotTracking).sort((a, b) => b.date.localeCompare(a.date))
    }),
    saveAndSelect: (match: Match) => transaction('readwrite', async (tx) => {
      await request(tx.objectStore(matchesStore).put(match))
      await request(tx.objectStore(sessionStore).put(match.id, currentKey))
      return match
    }),
    remove: (id: string) => transaction('readwrite', async (tx) => {
      const session = tx.objectStore(sessionStore)
      await request(tx.objectStore(matchesStore).delete(id))
      if (await request(session.get(currentKey)) === id) await request(session.delete(currentKey))
    }),
    update: (id: string, change: (match: Match) => Match) => transaction('readwrite', async (tx) => {
      const matches = tx.objectStore(matchesStore)
      const match: Match | undefined = await request(matches.get(id))
      if (!match) throw new Error('Ce match n’est plus disponible.')
      if (match.finishedAt) throw new Error('Le match est validé. Rouvre la saisie pour le corriger.')
      const next = change(enableOpponentShotTracking(match))
      if (next !== match) await request(matches.put(next))
      return next
    }),
    reopen: (id: string) => transaction('readwrite', async (tx) => {
      const matches = tx.objectStore(matchesStore)
      const match: Match | undefined = await request(matches.get(id))
      if (!match) throw new Error('Ce match n’est plus disponible.')
      const next = { ...match, finishedAt: undefined }
      if (match.finishedAt) await request(matches.put(next))
      return next
    }),
  }
}

export const matchStore = createMatchStore()
