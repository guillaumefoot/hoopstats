import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { canEditStarters, summarize } from './basket.ts'
import type { Match } from './basket.ts'
import { teamName } from './club.ts'
import { Icon } from './Icon.tsx'

type DeleteMatch = (id: string) => Promise<void>
const resultLabel = { win: 'Victoire', loss: 'Défaite', draw: 'Égalité' }

function DeleteMatchDialog({ match, onClose, onDelete }: { match: Match; onClose: () => void; onDelete: DeleteMatch }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { dialog.current?.showModal() }, [])

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onDelete(match.id)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'La suppression du match a échoué.')
      setSaving(false)
    }
  }

  return <dialog className="match-delete-dialog" ref={dialog} aria-labelledby="match-delete-title" aria-describedby="match-delete-description"
    onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault() }}>
    <h2 id="match-delete-title">Supprimer ce match ?</h2>
    <p className="match-delete-name">{teamName(match.homeTeamName)} – {match.opponentName}</p>
    <p id="match-delete-description">Le score et les actions seront supprimés de cet appareil.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <form className="button-row" onSubmit={(event) => void confirm(event)}>
      <button className="button" type="button" autoFocus disabled={saving} onClick={() => dialog.current?.close()}>Annuler</button>
      <button className="button danger" type="submit" disabled={saving}>{saving ? 'Suppression…' : 'Supprimer le match'}</button>
    </form>
  </dialog>
}

export function MatchList({ matches, onDelete }: { matches: Match[]; onDelete?: DeleteMatch }) {
  const [target, setTarget] = useState<Match>()

  return <>
    <ul className="match-list">{matches.map((match) => {
      const { ours, opponent } = summarize(match)
      const margin = ours.points - opponent.points
      const result = match.finishedAt ? (margin > 0 ? 'win' : margin < 0 ? 'loss' : 'draw') : undefined
      const status = result ? resultLabel[result] : match.starters.length < 5 ? 'À préparer' : canEditStarters(match) ? 'À démarrer' : 'En cours'
      return <li className={onDelete ? 'match-manageable' : undefined} key={match.id}>
        <a className="match-link" href={`#match/${match.id}${match.finishedAt ? '/rapport' : ''}`}>
          <div className="match-card-text">
            <strong>{teamName(match.homeTeamName)} <span>–</span> {match.opponentName}</strong>
            <small>{[match.date.split('-').reverse().join('/'), match.venue].filter(Boolean).join(' · ')}</small>
          </div>
          <div className="match-card-result" data-result={result}>
            <strong>{ours.points} – {opponent.points}</strong>
            <small className="match-status">{status}</small>
          </div>
          <Icon name="chevron" size={16} />
        </a>
        {onDelete && <button className="icon-button match-delete" aria-label={`Supprimer le match contre ${match.opponentName}`}
          title="Supprimer ce match" onClick={() => setTarget(match)}><Icon name="trash" size={18} /></button>}
      </li>
    })}</ul>
    {target && onDelete && <DeleteMatchDialog match={target} onDelete={onDelete} onClose={() => setTarget(undefined)} />}
  </>
}
