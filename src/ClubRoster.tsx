import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BackupControls } from './BackupControls.tsx'
import { newId } from './basket.ts'
import { shortPlayerName } from './club.ts'
import type { ClubPlayer } from './club.ts'

export function ClubRoster({ players, onSave, onImport, backToSetup }: {
  players: ClubPlayer[]; onSave: (player: ClubPlayer) => Promise<void>; onImport: () => Promise<void>; backToSetup?: boolean
}) {
  const [editing, setEditing] = useState<ClubPlayer>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const editor = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (editing) editor.current?.scrollIntoView({ block: 'nearest' })
  }, [editing])

  async function save(player: ClubPlayer) {
    setSaving(true)
    setError('')
    try {
      await onSave(player)
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Enregistrement impossible.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const displayName = String(data.get('displayName')).trim()
    const previous = players.find(({ id }) => id === editing?.id)
    const saved = await save({
      ...previous, id: previous?.id ?? newId(), displayName,
    })
    if (saved) { form.reset(); setEditing(undefined) }
  }

  return <section className="secondary-page">
    {backToSetup && <a className="text-button" href="#nouveau">← Feuille de départ</a>}
    <p className="eyebrow">Brignoles Basket Ball</p>
    <h1>Effectif de Brignoles</h1>
    <p className="muted">{players.filter((player) => !player.archived).length} joueurs disponibles pour les convocations.</p>
    <BackupControls onImport={onImport} />
    <form className="summary-card setup-form" ref={editor} key={editing?.id ?? 'new'} onSubmit={(event) => void submit(event)}>
      <h2>{editing ? `Modifier ${shortPlayerName(editing)}` : 'Ajouter un joueur'}</h2>
      <label className="field-label">Nom d’affichage<input name="displayName" required maxLength={50}
        defaultValue={editing?.displayName} placeholder="Prénom, initiale ou surnom" /></label>
      <div className="button-row">
        <button className="button primary" disabled={saving}>{editing ? 'Enregistrer' : 'Ajouter'}</button>
        {editing && <button className="button" type="button" disabled={saving} onClick={() => setEditing(undefined)}>Fermer</button>}
      </div>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    <ul className="club-list">{players.map((player) => <li key={player.id}>
      <span><strong>{shortPlayerName(player)}</strong>{player.archived && <small>Archivé</small>}</span>
      <button className="button" disabled={saving} onClick={() => setEditing(player)}>Modifier</button>
      <button className="button" disabled={saving} onClick={() => void save({ ...player, archived: !player.archived })}>
        {player.archived ? 'Réactiver' : 'Archiver'}
      </button>
    </li>)}</ul>
  </section>
}
