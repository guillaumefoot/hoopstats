import { useEffect, useRef, useState } from 'react'
import {
  actionAvailable, activePlayerIds, assistCandidateIds, canEditStarters, countActions, deleteEvent, eventLabel, finishMatch, formatClock, getPeriodClock, isAssistable, matchEndState,
  recordCount, recordShot, rotate, rotationSubstitutions, selectionAfterShot, setAssist, setClockRunning,
  setClockTime, setQuarter, setStarters, shots, startOvertime, undo,
} from './basket.ts'
import type { CountAction, Match, MatchEvent, Player, Result, ShotEvent, Subject, Zone } from './basket.ts'
import { MatchClock } from './MatchClock.tsx'
import { Icon } from './Icon.tsx'
import { shortPlayerName } from './club.ts'

type Panel = { type: 'assist'; eventId: string } | { type: 'rotate' } | { type: 'starters' }
type Update = (change: (match: Match) => Match) => Promise<boolean>

function quarterLabel(quarter: number) {
  return quarter <= 4 ? `Q${quarter}` : `P${quarter - 4}`
}

function eventName(event: MatchEvent, playerName: (id: string) => string, opponent: string) {
  if (event.type === 'rotation') {
    const substitutions = rotationSubstitutions(event)
    const outgoing = substitutions.map(({ outPlayerId }) => playerName(outPlayerId)).join(', ')
    const incoming = substitutions.map(({ inPlayerId }) => playerName(inPlayerId)).join(', ')
    return `${outgoing} → ${incoming}`
  }
  return event.team === 'opponent' ? opponent : playerName(event.playerId)
}

function PlayerChoice({ player, pressed, disabled, onClick }: { player: Player; pressed: boolean; disabled?: boolean; onClick: () => void }) {
  return <button className="button player-choice" aria-pressed={pressed} disabled={disabled} onClick={onClick}>
    <strong>{shortPlayerName(player)}</strong>
  </button>
}

function StartersPanel({ roster, starters, saving, onCancel, onSave }: {
  roster: Player[]; starters: string[]; saving: boolean; onCancel?: () => void; onSave: (ids: string[]) => void
}) {
  const [ids, setIds] = useState(starters)
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { panel.current?.focus() }, [])

  return <section className="summary-card starters-panel" aria-labelledby="starters-title" ref={panel} tabIndex={-1}>
    <div className="panel-heading"><h2 id="starters-title">Choisir le cinq majeur</h2><span>{ids.length}/5</span></div>
    <p className="muted">{onCancel ? 'Désélectionne un titulaire pour le remplacer.' : 'Sélectionne cinq titulaires parmi les joueurs convoqués.'}</p>
    <div className="tiles">{roster.map((player) => {
      const selected = ids.includes(player.id)
      return <PlayerChoice key={player.id} player={player} pressed={selected} disabled={saving || (!selected && ids.length === 5)}
        onClick={() => setIds((current) => togglePlayer(current, player.id))} />
    })}</div>
    <div className="button-row starters-actions">
      {onCancel && <button className="button" disabled={saving} onClick={onCancel}>Fermer</button>}
      <button className="button primary" disabled={saving || ids.length !== 5} onClick={() => onSave(ids)}>Valider le cinq</button>
    </div>
  </section>
}

function RotationPanel({ active, bench, onClose, onSave }: {
  active: Player[]; bench: Player[]; onClose: () => void; onSave: (outIds: string[], inIds: string[]) => Promise<void>
}) {
  const [outIds, setOutIds] = useState<string[]>([])
  const [inIds, setInIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const ready = outIds.length > 0 && outIds.length === inIds.length

  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  async function save() {
    if (!ready || saving) return
    setSaving(true)
    try {
      await onSave(outIds, inIds)
    } finally {
      setSaving(false)
    }
  }

  return <div className="inline-panel rotation-panel" ref={panel}>
    <div className="panel-heading"><h3>Rotation</h3>
      <button className="icon-button" aria-label="Fermer la rotation" onClick={onClose}><Icon name="close" /></button></div>
    <div className="panel-content">
      <fieldset className="rotation-team" disabled={saving}>
        <legend>Sortants <span>{outIds.length}</span></legend>
        <div className="tiles choices">{active.map((player) =>
          <PlayerChoice key={player.id} player={player} pressed={outIds.includes(player.id)}
            onClick={() => setOutIds((ids) => togglePlayer(ids, player.id))} />)}</div>
      </fieldset>
      <fieldset className="rotation-team" disabled={saving}>
        <legend>Entrants <span>{inIds.length}</span></legend>
        <div className="tiles choices">{bench.map((player) =>
          <PlayerChoice key={player.id} player={player} pressed={inIds.includes(player.id)}
            onClick={() => setInIds((ids) => togglePlayer(ids, player.id))} />)}</div>
      </fieldset>
    </div>
    <p className="rotation-help">Le cinq de départ est verrouillé. Choisis autant de sortants que d’entrants.</p>
    <button className="button primary" disabled={!ready || saving} onClick={() => void save()}>Valider la rotation</button>
  </div>
}

function togglePlayer(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id]
}

export function MatchBoard({ match, score, pending, onChange, onStats }: {
  match: Match; score: { ours: number; opponent: number }; pending: number; onChange: Update; onStats: () => void
}) {
  const [selected, setSelected] = useState<Subject | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [notice, setNotice] = useState('')
  const [needsPlayer, setNeedsPlayer] = useState(false)
  const [clockExpired, setClockExpired] = useState(false)
  const hasStarters = match.starters.length === 5
  const editableStarters = canEditStarters(match)
  const editingStarters = !hasStarters || (editableStarters && panel?.type === 'starters')
  const endState = clockExpired ? matchEndState(match) : 'playing'
  const active = activePlayerIds(match)
  const activePlayers = active.map((id) => match.roster.find((player) => player.id === id)!)
  const bench = match.roster.filter((player) => !active.includes(player.id))
  const recent = match.events.slice(-3).reverse()
  const playerNames = new Map(match.roster.map((player) => [player.id, shortPlayerName(player)]))
  const playerName = (id: string) => playerNames.get(id) ?? 'Joueur'
  const subject = selected?.team === 'ours' && !active.includes(selected.playerId) ? null : selected
  const isOpponent = subject?.team === 'opponent'
  const targetName = subject?.team === 'ours' ? playerName(subject.playerId) : isOpponent ? 'Adversaire' : 'Choisir un joueur'
  const panelEvent = panel?.type === 'assist' ? match.events.find((event) => event.id === panel.eventId) : undefined

  function select(next: Subject) {
    setSelected(subject?.team === next.team && subject.playerId === next.playerId ? null : next)
    setNeedsPlayer(false)
  }

  async function apply(change: (previous: Match) => Match, message: string) {
    const saved = await onChange(change)
    if (saved) setNotice(message)
    return saved
  }

  function addShot(zone: Zone, result: Result, label: string) {
    if (!subject) { setNeedsPlayer(true); setNotice('Choisir un joueur'); return }
    setSelected(selectionAfterShot(subject, zone))
    setPanel(null)
    void apply((previous) => recordShot(previous, subject, zone, result), `${targetName} · ${label}`)
  }

  function addCount(action: CountAction) {
    if (subject?.team !== 'ours') { setNeedsPlayer(true); setNotice('Choisir un joueur'); return }
    setSelected(null)
    setPanel(null)
    void apply((previous) => recordCount(previous, subject.playerId, action), `${targetName} · ${countActions[action].label}`)
  }

  function changeAssist(shot: ShotEvent, playerId: string | null) {
    setPanel(null)
    void apply((previous) => setAssist(previous, shot.id, playerId), playerId ? `Passe de ${playerName(playerId)} enregistrée` : 'Passe retirée')
  }

  function removeAction(eventId: string) {
    if (panel?.type === 'assist' && panel.eventId === eventId) setPanel(null)
    void apply((previous) => deleteEvent(previous, eventId), 'Action supprimée')
  }

  async function changeRotation(outIds: string[], inIds: string[]) {
    const saved = await apply((previous) => rotate(previous, outIds, inIds), 'Rotation enregistrée')
    if (saved) {
      setSelected((current) => current?.team === 'ours' && outIds.includes(current.playerId) ? null : current)
      setPanel((current) => current === panel ? null : current)
    }
  }

  const clockControls = <div className="clock-controls" role="group" aria-label="Quart-temps et chronomètre">
    <select aria-label="Quart-temps" value={match.quarter} onChange={(event) => {
      const quarter = Number(event.target.value)
      void onChange((previous) => setQuarter(previous, quarter))
    }}>
      {Array.from({ length: Math.max(5, match.quarter + 1) }, (_, index) =>
        <option key={index + 1} value={index + 1}>{quarterLabel(index + 1)}</option>)}
    </select>
    <MatchClock key={match.quarter} clock={getPeriodClock(match)} startDisabled={editingStarters} onRunningChange={(running) => {
      void onChange((previous) => setClockRunning(previous, running))
    }} onTimeChange={(seconds) => onChange((previous) => setClockTime(previous, seconds))} onExpiredChange={setClockExpired} />
  </div>

  if (editingStarters) {
    return <div className="match-board">
      {clockControls}
      <StartersPanel roster={match.roster} starters={match.starters} saving={pending > 0}
        onCancel={hasStarters ? () => setPanel(null) : undefined}
        onSave={async (ids) => {
          if (await apply((previous) => setStarters(previous, ids), 'Cinq majeur enregistré')) setPanel(null)
        }} />
    </div>
  }

  return (
    <div className="match-board">
      {clockControls}
      {(endState === 'ready' || endState === 'overtime') && <div className="match-end">
        <strong>{endState === 'ready' ? `Score final proposé · ${score.ours}–${score.opponent}` : 'Égalité à 00:00'}</strong>
        {endState === 'ready'
          ? <button className="button primary" disabled={pending > 0} onClick={() => void onChange(finishMatch)}>Valider le match</button>
          : <button className="button primary" disabled={pending > 0} onClick={() => void onChange(startOvertime)}>Prolongation {quarterLabel(match.quarter + 1)}</button>}
      </div>}

      <div className="board-grid">
        <section className="entry" aria-label="Saisie des actions">
          <div className="tiles player-tiles" role="group" aria-label="Joueurs sur le terrain et adversaire">
            {activePlayers.map((player) => <button key={player.id} className="player-tile" aria-pressed={subject?.playerId === player.id}
              onClick={() => select({ team: 'ours', playerId: player.id })}>
              <strong>{playerName(player.id)}</strong>
            </button>)}
            <button className="player-tile opponent-tile" aria-pressed={isOpponent}
              onClick={() => select({ team: 'opponent', playerId: null })}><Icon name="shield" size={17} /><strong>Adversaire</strong></button>
          </div>

          <div className="section-heading action-heading">
            <h2>Actions</h2>
            <span className={`target ${needsPlayer ? 'attention' : ''} ${subject ? 'chosen' : ''}`}>{targetName}</span>
          </div>
          <div className="tiles shot-tiles">
            {shots.map((shot) =>
              <button key={`${shot.zone}-${shot.result}`} className={`shot ${shot.result}`} onClick={() => addShot(shot.zone, shot.result, shot.label)}>
                <Icon name={shot.result === 'made' ? 'basketball' : 'close'} size={17} />{shot.label}
              </button>)}
          </div>
          {match.mode !== 'offensive' && <div className="tiles other-actions" data-profile={match.mode} role="group" aria-label="Autres actions de notre équipe">
            {(Object.keys(countActions) as CountAction[]).filter((action) => actionAvailable(match.mode, action)).map((action) =>
              <button className="button other-action" key={action} disabled={isOpponent} onClick={() => addCount(action)}>{countActions[action].label}</button>)}
          </div>}
        </section>

        <section className="recent-section" aria-label="Dernières actions">
          <div className="section-heading recent-heading">
            <h2>Dernières actions</h2>
            <button className="text-button undo-button" disabled={!match.undoStack.length} onClick={() => {
              setPanel(null)
              void apply(undo, 'Dernière modification annulée')
            }}><Icon name="undo" size={17} />Annuler</button>
          </div>
          {panel?.type === 'assist' && panelEvent && isAssistable(panelEvent) &&
            <div className="inline-panel">
              <div className="panel-heading"><h3>Passe sur {playerName(panelEvent.playerId)} {eventLabel(panelEvent)}</h3>
                <button className="icon-button" aria-label="Fermer le choix du passeur" onClick={() => setPanel(null)}><Icon name="close" /></button></div>
              <div className="panel-content">
                <div className="tiles assist-choices">{assistCandidateIds(match, panelEvent).map((id) =>
                  <PlayerChoice key={id} player={match.roster.find((player) => player.id === id)!}
                    pressed={id === panelEvent.assistPlayerId} onClick={() => changeAssist(panelEvent, id)} />)}</div>
                {panelEvent.assistPlayerId && <button className="text-button" onClick={() => changeAssist(panelEvent, null)}>Retirer la passe</button>}
              </div>
            </div>}
          {panel?.type === 'rotate' && <RotationPanel active={activePlayers} bench={bench}
            onClose={() => setPanel(null)} onSave={changeRotation} />}

          <div className="recent-window" tabIndex={recent.length > 0 ? 0 : undefined} aria-label="Liste des actions récentes">
            {recent.length === 0 && <p className="empty-recent">Les actions du match apparaîtront ici.</p>}
            {recent.length > 0 && <ol className="recent-list">
              {recent.map((event) => {
                const name = eventName(event, playerName, match.opponentName)
                const shot = event.type === 'shot' ? event : null
                return <li className="recent-item" key={event.id}>
                  <span className={`event-chip ${shot?.result ?? ''} ${shot?.team === 'opponent' ? 'opponent' : ''}`}>{eventLabel(event)}</span>
                  <span className="recent-detail"><strong>{name}</strong>
                    <small>{quarterLabel(event.quarter)}
                      {event.clockRemainingMs !== undefined && ` · ${formatClock(event.clockRemainingMs)}`}
                      {shot?.assistPlayerId ? ` · Passe : ${playerName(shot.assistPlayerId)}` : ''}</small></span>
                  {isAssistable(event) && <button className="pass-button" aria-label={`${event.assistPlayerId ? 'Modifier la passe' : 'Ajouter une passe'} sur ${name} ${eventLabel(event)}`}
                    onClick={() => setPanel({ type: 'assist', eventId: event.id })}>{event.assistPlayerId ? 'Passe' : '+ Passe'}</button>}
                  <button className="icon-button delete-button" aria-label={`Supprimer ${name} ${eventLabel(event)}`} title="Supprimer cette action"
                    onClick={() => removeAction(event.id)}><Icon name="trash" /></button>
                </li>
              })}
            </ol>}
          </div>
          <p className="save-line" role="status"><span className={`save-dot ${pending ? 'saving' : ''}`} aria-hidden="true" />
            {pending ? 'Enregistrement…' : 'Enregistré sur cet appareil'}<span className="notice">{notice}</span></p>
        </section>
      </div>

      <nav className="board-toolbar" aria-label="Outils du match">
        {editableStarters
          ? <button className="button" onClick={() => setPanel({ type: 'starters' })}><Icon name="team" />Cinq majeur</button>
          : <button className="button" disabled={!bench.length} onClick={() => setPanel(panel?.type === 'rotate' ? null : { type: 'rotate' })}><Icon name="rotate" />Rotation</button>}
        <button className="button" onClick={onStats}><Icon name="stats" />Stats</button>
      </nav>
    </div>
  )
}
