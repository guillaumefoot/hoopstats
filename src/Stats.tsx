import { useMemo, useRef, useState } from 'react'
import { eventLabel, formatClock, percentage, rotationSubstitutions } from './basket.ts'
import type { Category, Coverage, Match, MatchEvent, Team } from './basket.ts'
import { shortPlayerName, teamName } from './club.ts'
import { buildMatchReport, periodLabel } from './matchReport.ts'

type Report = ReturnType<typeof buildMatchReport>
type Line = Report['ours']
type View = 'box' | 'flow' | 'play'
const views = [{ id: 'box', label: 'Box score' }, { id: 'flow', label: 'Game flow' }, { id: 'play', label: 'Play-by-play' }] as const
const boxViews = [
  { id: 'shooting', label: 'Tirs', columns: ['MIN', 'PTS', 'FG', '3PT', 'LF'] },
  { id: 'play', label: 'Jeu', columns: ['REB', 'PAD', 'BP', 'INT', 'CTR'] },
  { id: 'impact', label: 'Impact', columns: ['RO', 'RD', 'FP', '+/−'] },
] as const
type BoxView = (typeof boxViews)[number]['id']
const columns = boxViews.flatMap(({ id, columns }) => columns.map((label) => ({ id, label })))
const shotLine = (shot: { made: number; attempted: number }) => `${shot.made}/${shot.attempted}`
const signed = (value: number) => value > 0 ? `+${value}` : String(value)
const percent = (made: number, attempted: number) => {
  const value = percentage(made, attempted)
  return value === null ? '—' : `${Math.round(value)} %`
}

function statValue(value: number | string, status: Coverage) {
  return status === 'not_tracked' ? '—' : `${value}${status === 'partial' ? '*' : ''}`
}

function statCells(line: Line, coverage: Record<Category, Coverage>, duration: number | undefined, margin: number) {
  const fg = { made: line.shots['2'].made + line.shots['3'].made, attempted: line.shots['2'].attempted + line.shots['3'].attempted }
  return [duration === undefined ? '—' : formatClock(duration), line.points, shotLine(fg), shotLine(line.shots['3']), shotLine(line.shots.FT),
    statValue(line.oreb + line.dreb, coverage.rebounds), statValue(line.assist, coverage.assists), statValue(line.turnover, coverage.turnovers),
    statValue(line.steal, coverage.steals), statValue(line.block, coverage.blocks), statValue(line.oreb, coverage.rebounds),
    statValue(line.dreb, coverage.rebounds), statValue(line.foul, coverage.fouls), signed(margin)]
}

function BoxScore({ match, report }: { match: Match; report: Report }) {
  const [boxView, setBoxView] = useState<BoxView>('shooting')
  const compactClass = (group: BoxView) => group === boxView ? undefined : 'box-compact-hidden'
  const ours = teamName(match.homeTeamName)
  const groups = [{ label: 'Titulaires', players: match.roster.filter(({ id }) => match.starters.includes(id)) },
    { label: 'Banc', players: match.roster.filter(({ id }) => !match.starters.includes(id)) }]
  const totalTime = report.playingTime ? Object.values(report.playingTime).reduce((total, time) => total + time, 0) : undefined
  const totalCells = statCells(report.ours, report.coverage, totalTime, report.score.ours - report.score.opponent)
  const fieldGoals = report.ours.shots['2'].made + report.ours.shots['3'].made
  const fieldAttempts = report.ours.shots['2'].attempted + report.ours.shots['3'].attempted
  const opponent = report.opponent
  const shotCoverage = match.coverage.opponent.shooting

  return <>
    <div className="box-heading">
      <h2>{ours} · Box score</h2>
      <div className="mode-switch box-columns screen-only" role="group" aria-label="Colonnes du box score">
        {boxViews.map(({ id, label }) => <button key={id} aria-pressed={boxView === id} aria-controls="player-box-score"
          onClick={() => setBoxView(id)}>{label}</button>)}
      </div>
    </div>
    <div className="report-scroll box-scroll" id="player-box-score" role="region" tabIndex={0} aria-label="Box score par joueur">
      <table className="report-table box-table">
        {groups.filter(({ players }) => players.length > 0).map(({ label, players }) => <tbody key={label}>
          <tr className="box-group"><th scope="rowgroup">{label}</th>{columns.map(({ id, label: column }) =>
            <th scope="col" className={compactClass(id)} key={column}>{column}</th>)}</tr>
          {players.map((player) => <tr key={player.id}>
            <th scope="row">{shortPlayerName(player)}</th>
            {statCells(report.players[player.id], report.coverage, report.playingTime?.[player.id], report.plusMinus[player.id]).map((value, index) =>
              <td className={compactClass(columns[index].id)} key={columns[index].label}>{value}</td>)}
          </tr>)}
        </tbody>)}
        <tfoot><tr><th scope="row">Total équipe</th>{totalCells.map((value, index) =>
          <td className={compactClass(columns[index].id)} key={columns[index].label}>{value}</td>)}</tr>
          <tr className={compactClass('shooting')}><th scope="row">Réussite</th><td colSpan={2} /><td>{percent(fieldGoals, fieldAttempts)}</td>
            <td>{percent(report.ours.shots['3'].made, report.ours.shots['3'].attempted)}</td>
            <td>{percent(report.ours.shots.FT.made, report.ours.shots.FT.attempted)}</td><td className="box-compact-hidden" colSpan={9} /></tr></tfoot>
      </table>
    </div>
    <p className="report-note">FG = tirs de jeu · PAD = passes décisives · BP = balles perdues · +/− = écart cumulé pendant la présence sur le terrain.</p>
    <p className="report-note">— = donnée indisponible · * = suivi partiel{report.playingTime ? '.' : ' · MIN demande un chrono et des rotations horodatés.'}</p>
    <div className="opponent-summary">
      <h3>{match.opponentName} · Total collectif</h3>
      <dl>
        <div><dt>PTS</dt><dd>{opponent.points}</dd></div>
        <div><dt>2 pts</dt><dd>{statValue(shotLine(opponent.shots['2']), shotCoverage)}</dd></div>
        <div><dt>3 pts</dt><dd>{statValue(shotLine(opponent.shots['3']), shotCoverage)}</dd></div>
        <div><dt>LF</dt><dd>{statValue(shotLine(opponent.shots.FT), shotCoverage)}</dd></div>
      </dl>
    </div>
  </>
}

function GameFlow({ report, ours, opponent }: { report: Report; ours: string; opponent: string }) {
  const [showMargin, setShowMargin] = useState(false)
  const points = [{ x: 0, ours: 0, opponent: 0 }, ...report.flow, { x: report.flowEnd, ...report.score }]
  const margins = points.map((point) => point.ours - point.opponent)
  const largestLead = Math.max(...margins)
  const largestDeficit = -Math.min(...margins)
  const scoreMax = Math.max(10, Math.ceil(Math.max(report.score.ours, report.score.opponent) / 20) * 20)
  const marginMax = Math.max(5, Math.ceil(Math.max(largestLead, largestDeficit) / 5) * 5)
  const minY = showMargin ? -marginMax : 0
  const maxY = showMargin ? marginMax : scoreMax
  const ticks = Array.from({ length: 5 }, (_, index) => minY + (maxY - minY) * index / 4)
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const tick = report.flowEnd * index / 4
    return report.timedFlow ? tick : Math.round(tick)
  })

  function chart(width: number, height: number, layout: 'wide' | 'mobile') {
    const left = layout === 'mobile' ? 33 : 43
    const right = width - 21
    const bottom = height - 32
    const x = (value: number) => left + value / (report.flowEnd || 1) * (right - left)
    const y = (value: number) => bottom - (value - minY) / (maxY - minY) * (bottom - 22)
    const series = (value: (point: typeof points[number]) => number) => points.map((point, index) => index
      ? `H${x(point.x)}V${y(value(point))}` : `M${x(point.x)} ${y(value(point))}`).join(' ')

    return <svg className={`flow-chart flow-chart--${layout}`} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={showMargin ? `Écart de ${ours} au fil du match` : `Progression du score de ${ours} et ${opponent}`}>
      {ticks.map((tick) => <g key={tick}><line className="flow-grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
        <text x={left - 8} y={y(tick) + 4} textAnchor="end">{Math.round(tick)}</text></g>)}
      {[...new Set(xTicks)].map((tick) => <text key={tick} x={x(tick)} y={height - 10} textAnchor="middle">
        {report.timedFlow ? `${Number(tick.toFixed(1)).toLocaleString('fr-FR')}′` : tick}</text>)}
      {!showMargin && <path className="flow-opponent" d={series((point) => point.opponent)} />}
      <path className="flow-ours" d={series(showMargin ? (point) => point.ours - point.opponent : (point) => point.ours)} />
    </svg>
  }

  return <>
    <div className="report-section-heading"><h2>{showMargin ? 'Écart au score' : 'Progression du score'}</h2>
      <button className="button screen-only" aria-pressed={showMargin} onClick={() => setShowMargin(!showMargin)}>{showMargin ? 'Voir les scores' : 'Voir l’écart'}</button></div>
    {report.flow.length === 0 ? <p className="muted">La courbe apparaît dès le premier panier.</p> : <>
      {chart(630, 248, 'wide')}
      {chart(360, 330, 'mobile')}
      <div className="flow-legend"><span className="flow-key ours-key">{showMargin ? `Écart ${ours}` : ours}</span>
        {!showMargin && <span className="flow-key opponent-key">{opponent}</span>}
        <span className="muted">{report.timedFlow ? 'Minutes de jeu' : 'Ordre des actions de score'}</span></div>
      <dl className="flow-summary"><div><dt>Plus gros avantage {ours}</dt><dd>{signed(largestLead)}</dd></div>
        <div><dt>Plus gros avantage {opponent}</dt><dd>{signed(largestDeficit)}</dd></div></dl>
    </>}
  </>
}

function actionDescription(event: MatchEvent, players: Map<string, string>, opponent: string) {
  const name = (id: string) => players.get(id) ?? 'Joueur'
  if (event.type === 'rotation') return rotationSubstitutions(event).map(({ outPlayerId, inPlayerId }) =>
    `${name(outPlayerId)} → ${name(inPlayerId)}`).join(' · ')
  const subject = event.team === 'opponent' ? opponent : name(event.playerId)
  return `${subject} · ${eventLabel(event)}${event.type === 'shot' && event.assistPlayerId ? ` · Passe de ${name(event.assistPlayerId)}` : ''}`
}

function PlayByPlay({ match, report, teams }: { match: Match; report: Report; teams: Team[] }) {
  const [period, setPeriod] = useState(String(report.periods.length))
  const players = new Map(match.roster.map((player) => [player.id, shortPlayerName(player)]))
  const names = { ours: teamName(match.homeTeamName), opponent: match.opponentName }
  const plays = report.playByPlay.filter(({ event }) => period === 'all' || event.quarter === Number(period))
  return <>
    <div className="report-section-heading"><h2>Play-by-play</h2><select aria-label="Période du play-by-play" value={period} onChange={(event) => setPeriod(event.target.value)}>
      <option value="all">Tout le match</option>{report.periods.map((_, index) => <option value={index + 1} key={index}>{periodLabel(index + 1)}</option>)}
    </select></div>
    <p className="report-note">Score dans l’ordre {names[teams[0]]} – {names[teams[1]]}.</p>
    {plays.length === 0 ? <p className="muted">Aucune action dans cette période.</p> : <ol className="play-list">
      {plays.map(({ event, score }) => <li key={event.id}>
        <time>{periodLabel(event.quarter)} <span>{event.clockRemainingMs === undefined ? '' : formatClock(event.clockRemainingMs)}</span></time>
        <span>{actionDescription(event, players, match.opponentName)}</span><strong>{score[teams[0]]}–{score[teams[1]]}</strong>
      </li>)}
    </ol>}
  </>
}

export function ReportOptions({ onReopen }: { onReopen?: () => void }) {
  const options = useRef<HTMLDetailsElement>(null)
  return <details className="report-options screen-only" ref={options}>
    <summary className="button">Options</summary>
    <div className="report-options-menu">
      <button className="button" onClick={() => { if (options.current) options.current.open = false; window.print() }}>Export PDF</button>
      {onReopen && <button className="button" onClick={onReopen}>Rouvrir la saisie</button>}
    </div>
  </details>
}

export function Stats({ match }: { match: Match }) {
  const [view, setView] = useState<View>('box')
  const report = useMemo(() => buildMatchReport(match), [match])
  const ours = teamName(match.homeTeamName)
  const names = { ours, opponent: match.opponentName }
  const teams: Team[] = match.host === 'opponent' ? ['opponent', 'ours'] : ['ours', 'opponent']

  return <article className="match-report">
    <header className="report-header">
      <p className="report-kicker print-only">{match.finishedAt ? 'MATCH VALIDÉ' : 'RAPPORT DE MATCH'}</p>
      <h1><span>{names[teams[0]]}</span> <strong>{report.score[teams[0]]} – {report.score[teams[1]]}</strong> <span>{names[teams[1]]}</span></h1>
      <p>{match.finishedAt && <span className="report-status screen-only">Validé · </span>}
        {[match.date.split('-').reverse().join('/'), match.venue, match.host && `${names[match.host]} reçoit`, match.season.name].filter(Boolean).join(' · ')}</p>
    </header>
    <div className="report-scroll" tabIndex={0} aria-label="Score par période">
      <table className="report-table period-table">
        <thead><tr><th scope="col">Équipe</th>{report.periods.map((_, index) => <th scope="col" key={index}>{periodLabel(index + 1)}</th>)}<th scope="col">Total</th></tr></thead>
        <tbody>{teams.map((team) => <tr key={team}><th scope="row">{names[team]}</th>
          {report.periods.map((period, index) => <td key={index}>{period[team]}</td>)}<td><strong>{report.score[team]}</strong></td></tr>)}</tbody>
      </table>
    </div>
    <div className="mode-switch report-tabs screen-only" role="group" aria-label="Vues du rapport">
      {views.map(({ id, label }) => <button key={id} aria-pressed={id === view} onClick={() => setView(id)}>{label}</button>)}
    </div>
    <section className="report-panel" data-inactive={view !== 'box'}><BoxScore match={match} report={report} /></section>
    <section className="report-panel flow-report" data-inactive={view !== 'flow'}>
      <p className="print-only report-kicker">{names[teams[0]]} · {report.score[teams[0]]} – {report.score[teams[1]]} · {names[teams[1]]}</p>
      <GameFlow report={report} ours={ours} opponent={match.opponentName} />
    </section>
    {view === 'play' && <section className="report-panel screen-only"><PlayByPlay match={match} report={report} teams={teams} /></section>}
  </article>
}
