import { useState } from 'react'
import type { FormEvent } from 'react'
import { createMatch, localDate, modes, newId } from './basket.ts'
import type { Match, Mode, Team } from './basket.ts'
import { clubShortName, shortPlayerName } from './club.ts'
import type { ClubPlayer } from './club.ts'

export function MatchSetup({ players, onCreate }: {
  players: ClubPlayer[]; onCreate: (match: Match) => Promise<void>
}) {
  const [selected, setSelected] = useState<Record<string, 'starter' | 'bench'>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const roster = players.filter((player) => !player.archived)
  const calledUp = roster.filter(({ id }) => selected[id])
  const starters = Object.keys(selected).filter((id) => selected[id] === 'starter')
  const ready = calledUp.length >= 5
  const today = localDate()
  const year = Number(today.slice(0, 4))
  const seasonYear = Number(today.slice(5, 7)) < 9 ? year - 1 : year

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? '').trim()
    setError('')
    setSaving(true)
    try {
      await onCreate(createMatch({
        homeTeamName: clubShortName, opponentName: field('opponent'), date: field('date'), venue: field('venue'),
        host: field('host') as Team, season: { id: newId(), name: field('season') },
        roster: calledUp.map(({ id, displayName, firstName, lastName }) =>
          ({ id, displayName, firstName, lastName })),
        starters, mode: field('mode') as Mode,
      }))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="secondary-page setup-page">
    <a className="text-button" href="#matchs">← Matchs</a>
    <h1>Nouveau match</h1>
    <p className="muted">Convoque au moins cinq joueurs. Tu peux choisir les titulaires directement dans la saisie.</p>
    <form className="setup-form match-setup" onSubmit={submit}>
      <div className="summary-card setup-details">
        <h2>Rencontre</h2>
        <div className="form-grid">
          <label>Adversaire<input name="opponent" required maxLength={50} placeholder="Nom de l’équipe" /></label>
          <label>Qui reçoit ?<select name="host" required defaultValue="ours">
            <option value="ours">Brignoles</option><option value="opponent">L’adversaire</option>
          </select></label>
          <label>Date<input name="date" type="date" required defaultValue={today} /></label>
          <label>Lieu (facultatif)<input name="venue" maxLength={80} placeholder="Gymnase, ville" /></label>
          <label>Saison<input name="season" required maxLength={40} defaultValue={`${seasonYear}–${seasonYear + 1}`} /></label>
          <label>Profil de saisie<select name="mode">{modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label>
        </div>
      </div>
      <fieldset className="roster-form">
        <legend>Convocation de Brignoles</legend>
        <p className="muted">{calledUp.length} convoqué(s) · {starters.length === 0 ? 'Cinq majeur à choisir' : `${starters.length}/5 titulaires`}</p>
        {roster.length < 5 && <a className="text-button" href="#equipe/convocation">Compléter l’effectif du club</a>}
        {roster.length > 0 && <table className="selection-table">
          <thead><tr><th scope="col">Joueur</th><th scope="col">Convoqué</th><th scope="col">Titulaire</th></tr></thead>
          <tbody>{roster.map((player) => <tr key={player.id}>
            <th scope="row">{shortPlayerName(player)}</th>
            <td><label className="check-label"><input type="checkbox" aria-label={`Convoquer ${shortPlayerName(player)}`} checked={Boolean(selected[player.id])}
              onChange={(event) => {
                const checked = event.target.checked
                setSelected((current) => {
                  const next = { ...current }
                  if (checked) next[player.id] = 'bench'
                  else delete next[player.id]
                  return next
                })
              }} /></label></td>
            <td><label className="check-label"><input type="checkbox" aria-label={`Titulaire ${shortPlayerName(player)}`} checked={selected[player.id] === 'starter'}
              disabled={starters.length === 5 && selected[player.id] !== 'starter'}
              onChange={(event) => {
                const role = event.target.checked ? 'starter' : 'bench'
                setSelected((current) => ({ ...current, [player.id]: role }))
              }} /></label></td>
          </tr>)}</tbody>
        </table>}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={saving || !ready}>{saving ? 'Enregistrement…' : 'Ouvrir la saisie'}</button>
    </form>
  </section>
}
