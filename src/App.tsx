import { useEffect, useMemo, useState } from 'react'
import { getPeriodClock, modes, setClockTime, setTracking, summarize } from './basket.ts'
import type { Match } from './basket.ts'
import { ClubRoster } from './ClubRoster.tsx'
import { teamName } from './club.ts'
import type { ClubPlayer } from './club.ts'
import { Home } from './Home.tsx'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'
import { MatchBoard } from './MatchBoard.tsx'
import { ClockSettings } from './MatchClock.tsx'
import { MatchList } from './MatchList.tsx'
import { MatchSetup } from './MatchSetup.tsx'
import { SeasonStats } from './SeasonStats.tsx'
import { ReportOptions, Stats } from './Stats.tsx'
import { matchStore } from './store.ts'

type Page = 'home' | 'matches' | 'new' | 'club' | 'season' | 'board' | 'report' | 'settings'
type Route = { page: Page; id?: string; fromSetup?: boolean }

const navigation: { page: Page; href: string; label: string; icon: IconName }[] = [
  { page: 'home', href: '#accueil', label: 'Accueil', icon: 'home' },
  { page: 'matches', href: '#matchs', label: 'Matchs', icon: 'calendar' },
  { page: 'club', href: '#equipe', label: 'Équipe', icon: 'team' },
  { page: 'season', href: '#stats', label: 'Stats', icon: 'stats' },
]

const profileHelp = {
  offensive: 'Tirs et score.',
  essential: 'Tirs, score et rebonds.',
  complete: 'Ajoute les interceptions, contres, balles perdues et fautes.',
}

function readRoute(): Route {
  const hash = location.hash
  const top = navigation.find(({ href }) => href === hash)
  if (top) return { page: top.page }
  if (hash === '#nouveau') return { page: 'new' }
  if (hash === '#equipe/convocation') return { page: 'club', fromSetup: true }
  const matchRoute = /^#match\/([\w-]+)(?:\/(rapport|reglages))?$/.exec(hash)
  if (matchRoute) {
    const [, id, section] = matchRoute
    return { id, page: section === 'rapport' ? 'report' : section === 'reglages' ? 'settings' : 'board' }
  }
  return { page: 'home' }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Le stockage local est indisponible.'
}

export function App() {
  const [route, setRoute] = useState(readRoute)
  const [matches, setMatches] = useState<Match[]>([])
  const [clubPlayers, setClubPlayers] = useState<ClubPlayer[]>([])
  const [currentId, setCurrentId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')
  const { page, id } = route
  const match = matches.find((entry) => entry.id === id)
  const live = page === 'board' && !!match && !match.finishedAt
  const reportMatch = match && (page === 'report' || (page === 'board' && match.finishedAt)) ? match : undefined
  const backToEntry = reportMatch && !reportMatch.finishedAt
  const liveId = live ? match.id : undefined
  const liveScore = useMemo(() => {
    if (!live) return undefined
    const { ours, opponent } = summarize(match)
    return { ours: ours.points, opponent: opponent.points }
  }, [live, match])
  const unfinished = matches.filter((entry) => !entry.finishedAt)
  const resume = unfinished.find((entry) => entry.id === currentId) ?? unfinished[0]
  const currentNav = page === 'new' || id ? 'matches' : page

  useEffect(() => {
    void Promise.all([matchStore.list(), matchStore.clubRoster(), matchStore.select()])
      .then(([saved, roster, current]) => {
        setMatches(saved)
        setClubPlayers(roster)
        setCurrentId(current?.id)
      })
      .catch((failure) => setError(errorMessage(failure)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function onHashChange() {
      setRoute(readRoute())
      setError('')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!liveId) return
    setCurrentId(liveId)
    void matchStore.select(liveId).catch((failure) => setError(errorMessage(failure)))
  }, [liveId])

  function replaceMatch(next: Match) {
    setMatches((current) => current.map((entry) => entry.id === next.id ? next : entry))
  }

  async function saveMatch(next: Match) {
    const saved = await matchStore.saveAndSelect(next)
    setMatches((current) => [saved, ...current].sort((a, b) => b.date.localeCompare(a.date)))
    location.hash = `match/${saved.id}`
  }

  async function deleteMatch(matchId: string) {
    await matchStore.remove(matchId)
    setMatches((current) => current.filter((entry) => entry.id !== matchId))
    setCurrentId((current) => current === matchId ? undefined : current)
  }

  async function reloadImportedData() {
    const [saved, roster, current] = await Promise.all([matchStore.list(), matchStore.clubRoster(), matchStore.select()])
    setMatches(saved)
    setClubPlayers(roster)
    setCurrentId(current?.id)
  }

  async function update(change: (previous: Match) => Match) {
    if (!match) return false
    setPending((count) => count + 1)
    setError('')
    try {
      replaceMatch(await matchStore.update(match.id, change))
      return true
    } catch (failure) {
      setError(errorMessage(failure))
      return false
    } finally {
      setPending((count) => count - 1)
    }
  }

  async function reopenMatch(saved: Match) {
    setError('')
    try {
      replaceMatch(await matchStore.reopen(saved.id))
      location.hash = `match/${saved.id}`
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  return <>
    <header className="app-header" data-live={live} data-report={!!reportMatch}>
      <div className="header-inner">
        {live || reportMatch ? <a className="match-back icon-button" href={backToEntry ? `#match/${reportMatch.id}` : '#matchs'}
          aria-label={backToEntry ? 'Retour à la saisie' : 'Retour aux matchs'}><Icon name="back" size={17} />{backToEntry ? 'Saisie' : 'Matchs'}</a>
          : <a className="brand" href="#accueil" aria-label="HoopStats, accueil"><picture>
            <source media="(prefers-color-scheme: dark)" srcSet={`${import.meta.env.BASE_URL}hoopstats-horizontal-dark.png`} />
            <img src={`${import.meta.env.BASE_URL}hoopstats-horizontal-light.png`} alt="HoopStats" width="2180" height="500" />
          </picture></a>}
        {live && liveScore ? <>
          <h1 className="live-score" aria-label={`${teamName(match.homeTeamName)} ${liveScore.ours} à ${liveScore.opponent} ${match.opponentName}`}>
            <span className="live-score-points">
              <output aria-label="Points de notre équipe">{liveScore.ours}</output><span aria-hidden="true">–</span>
              <output aria-label="Points adverses">{liveScore.opponent}</output>
            </span>
            <span className="live-score-teams">
              <span title={match.homeTeamName}>{teamName(match.homeTeamName)}</span><span aria-hidden="true">·</span>
              <span title={match.opponentName}>{match.opponentName}</span>
            </span>
          </h1>
          <a className="live-settings icon-button" href={`#match/${match.id}/reglages`} aria-label="Réglages"><Icon name="settings" /></a>
        </> : reportMatch && <>
          <span className="report-nav-title">Rapport</span>
          <ReportOptions key={reportMatch.id} onReopen={reportMatch.finishedAt ? () => void reopenMatch(reportMatch) : undefined} />
        </>}
        {!live && <nav className="app-nav screen-only" aria-label="Navigation principale">
          {navigation.map(({ page: target, href, label, icon }) =>
            <a key={href} href={href} aria-current={currentNav === target ? 'page' : undefined}>
              <Icon name={icon} /><span>{label}</span>
            </a>)}
        </nav>}
      </div>
    </header>
    <main className={`app-main${live ? ' live-main' : reportMatch ? ' report-main' : ''}`}>
      {error && <p className="error global-error" role="alert">{error}</p>}
      {loading ? <p className="loading" role="status">Chargement de HoopStats…</p> : <>
        {page === 'home' && <Home resume={resume} recent={matches.slice(0, 3)} />}
        {page === 'matches' && <section className="secondary-page">
          <div className="page-heading">
            <div><p className="eyebrow">Brignoles Basket Ball</p><h1>Matchs</h1></div>
            <a className="button primary" href="#nouveau"><Icon name="play" size={17} />Nouveau match</a>
          </div>
          {matches.length > 0 ? <MatchList matches={matches} onDelete={deleteMatch} /> :
            <div className="empty-card">
              <span className="tile-icon"><Icon name="calendar" /></span>
              <h2>Aucun match enregistré</h2>
              <p className="muted">Crée une rencontre et choisis les joueurs convoqués.</p>
              <a className="text-button" href="#nouveau">Créer un match <Icon name="chevron" size={16} /></a>
            </div>}
        </section>}
        {page === 'season' && <SeasonStats matches={matches} />}
        {page === 'new' && <MatchSetup players={clubPlayers} onCreate={saveMatch} />}
        {page === 'club' && <ClubRoster players={clubPlayers} backToSetup={route.fromSetup} onImport={reloadImportedData}
          onSave={async (player) => setClubPlayers(await matchStore.updateClubPlayer(player))} />}
        {id && !match && <section className="empty-card">
          <h1>Match introuvable</h1><a className="text-button" href="#matchs">← Voir les matchs</a>
        </section>}
        {live && liveScore && <MatchBoard key={match.id} match={match} score={liveScore} pending={pending}
          onChange={update} onStats={() => { location.hash = `match/${match.id}/rapport` }} />}
        {reportMatch && <Stats key={reportMatch.id} match={reportMatch} />}
        {page === 'settings' && match && <section className="secondary-page">
          <a className="text-button" href={`#match/${match.id}`}>← Saisie</a>
          <h1>Réglages du match</h1>
          <div className="summary-card">
            <h2 id="profile-heading">Profil de saisie</h2>
            <div className="mode-switch" role="group" aria-labelledby="profile-heading">
              {modes.map((mode) => <button key={mode.id} aria-pressed={match.mode === mode.id} disabled={!!match.finishedAt}
                onClick={() => void update((previous) => setTracking(previous, mode.id))}>{mode.label}</button>)}
            </div>
            <p className="muted">{profileHelp[match.mode]} Les passes se saisissent depuis les paniers marqués.</p>
          </div>
          {!match.finishedAt && <ClockSettings clock={getPeriodClock(match)} onSave={async (seconds) => {
            const saved = await update((previous) => setClockTime(previous, seconds))
            if (saved) location.hash = `match/${match.id}`
            return saved
          }} />}
        </section>}
      </>}
    </main>
  </>
}
