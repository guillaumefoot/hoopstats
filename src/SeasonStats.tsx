import { useState } from 'react'
import { rotationSubstitutions, summarize } from './basket.ts'
import type { Match } from './basket.ts'
import { clubName, shortPlayerName } from './club.ts'
import { Icon } from './Icon.tsx'

const average = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

function seasonTotals(matches: Match[]) {
  let wins = 0
  let scored = 0
  let conceded = 0
  const players = new Map<string, { name: string; games: number; points: number }>()

  for (const match of matches) {
    const totals = summarize(match)
    if (totals.ours.points > totals.opponent.points) wins++
    scored += totals.ours.points
    conceded += totals.opponent.points

    const played = new Set(match.starters)
    for (const event of match.events) {
      if (event.type === 'rotation') {
        for (const { inPlayerId } of rotationSubstitutions(event)) played.add(inPlayerId)
      }
    }
    for (const player of match.roster) {
      if (!played.has(player.id)) continue
      const line = players.get(player.id) ?? { name: shortPlayerName(player), games: 0, points: 0 }
      line.games++
      line.points += totals.players[player.id].points
      players.set(player.id, line)
    }
  }
  const standings = [...players].sort(([, a], [, b]) => b.points - a.points || a.name.localeCompare(b.name, 'fr'))
  return { wins, scored, conceded, standings }
}

export function SeasonStats({ matches }: { matches: Match[] }) {
  const [selection, setSelection] = useState<string>()
  const completed = matches.filter((match) => match.finishedAt)
  const seasons = [...new Set(completed.map((match) => match.season.name.trim()))]
  const season = selection && seasons.includes(selection) ? selection : seasons[0]
  const seasonMatches = completed.filter((match) => match.season.name.trim() === season)
  const { wins, scored, conceded, standings } = seasonTotals(seasonMatches)
  const games = seasonMatches.length

  return <section className="secondary-page season-page">
    <div className="page-heading">
      <div><p className="eyebrow">{clubName}</p><h1>Statistiques</h1></div>
      {games > 0 && <label className="field-label">Saison<select value={season} onChange={(event) => setSelection(event.target.value)}>
        {seasons.map((name) => <option key={name}>{name}</option>)}
      </select></label>}
    </div>
    {games === 0 ? <div className="empty-card">
      <span className="tile-icon"><Icon name="stats" /></span>
      <h2>Aucun match validé</h2>
      <p className="muted">Le bilan de saison se remplit au fil des rencontres validées.</p>
      <a className="text-button" href="#matchs">Voir les matchs <Icon name="chevron" size={16} /></a>
    </div> : <>
      <h2>Bilan d’équipe</h2>
      <dl className="season-metrics">
        <div><dt>Matchs validés</dt><dd>{games}</dd></div>
        <div><dt>Victoires</dt><dd>{wins}</dd></div>
        <div><dt>Points marqués / match</dt><dd>{average.format(scored / games)}</dd></div>
        <div><dt>Points encaissés / match</dt><dd>{average.format(conceded / games)}</dd></div>
      </dl>
      <h2 id="season-players-title">Statistiques des joueurs</h2>
      <div className="report-scroll season-players">
        <table className="report-table" aria-labelledby="season-players-title">
          <thead><tr><th scope="col">Joueur</th><th scope="col">Matchs</th><th scope="col">Points</th><th scope="col">Pts/match</th></tr></thead>
          <tbody>{standings.map(([id, player]) => <tr key={id}>
            <th scope="row">{player.name}</th><td>{player.games}</td><td>{player.points}</td>
            <td>{average.format(player.points / player.games)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>
}
