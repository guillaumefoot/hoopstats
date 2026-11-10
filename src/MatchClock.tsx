import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatClock, remainingClockMs } from './basket.ts'
import type { PeriodClock } from './basket.ts'

type SaveClockTime = (seconds: number) => Promise<boolean>

export function MatchClock({ clock, startDisabled, onRunningChange, onTimeChange, onExpiredChange }: {
  clock: PeriodClock; startDisabled: boolean; onRunningChange: (running: boolean) => void; onTimeChange: SaveClockTime;
  onExpiredChange: (expired: boolean) => void
}) {
  const [now, setNow] = useState(Date.now)
  const [editing, setEditing] = useState(false)
  const editor = useRef<HTMLDialogElement>(null)
  const remaining = remainingClockMs(clock, now)
  const expired = remaining === 0
  const time = formatClock(remaining)
  const running = clock.startedAt !== null && remaining > 0
  const label = running ? 'Mettre le chrono en pause' : 'Lancer ou reprendre le chrono'

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (editing) editor.current?.showModal()
  }, [editing])

  useEffect(() => { onExpiredChange(expired) }, [expired, onExpiredChange])

  return <>
    <div className="match-clock" data-running={running}>
      <button type="button" className="clock-readout" aria-label={`Corriger le temps restant, ${time}`}
        title="Corriger le temps restant" aria-haspopup="dialog" onClick={() => setEditing(true)}>
        {time}
        <svg aria-hidden="true" viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="m4 12-1 5 5-1 9-9-4-4zM11 5l4 4" />
        </svg>
      </button>
      <button type="button" className="clock-toggle" aria-label={label} title={label} disabled={remaining === 0 || (!running && startDisabled)}
        onClick={() => onRunningChange(!running)}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          <path d={running ? 'M5 4h3v12H5zm7 0h3v12h-3z' : 'M6 3v14l11-7z'} />
        </svg>
      </button>
    </div>
    {editing && <dialog className="clock-editor" ref={editor} aria-labelledby="clock-editor-title" onClose={() => setEditing(false)}>
      <h2 id="clock-editor-title">Corriger le chrono</h2>
      <p>La validation met le chrono en pause au temps saisi.</p>
      <ClockTimeForm clock={clock} onSave={onTimeChange} onClose={() => editor.current?.close()} />
    </dialog>}
  </>
}

function ClockTimeForm({ clock, onSave, onClose }: { clock: PeriodClock; onSave: SaveClockTime; onClose?: () => void }) {
  const [initialSeconds] = useState(() => Math.ceil(remainingClockMs(clock) / 1000))
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setSaving(true)
    setSaveFailed(false)
    try {
      const saved = await onSave(Number(values.get('minutes')) * 60 + Number(values.get('seconds')))
      if (saved) onClose?.()
      else setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return <form className="clock-settings" onSubmit={(event) => void submit(event)}>
    <label>Minutes<input name="minutes" type="number" min="0" max="99" required defaultValue={Math.floor(initialSeconds / 60)} /></label>
    <label>Secondes<input name="seconds" type="number" min="0" max="59" required defaultValue={initialSeconds % 60} /></label>
    <div className="button-row clock-form-actions">
      {onClose && <button className="button" type="button" disabled={saving} onClick={onClose}>Fermer</button>}
      <button className="button primary" type="submit" disabled={saving}>Appliquer</button>
    </div>
    {saveFailed && <p className="error" role="alert">Le temps restant n’a pas pu être enregistré.</p>}
  </form>
}

export function ClockSettings({ clock, onSave }: { clock: PeriodClock; onSave: SaveClockTime }) {
  return <div className="summary-card">
    <h2>Chronomètre</h2>
    <p className="muted">Règle le temps restant de la période en cours. Le chrono se met en pause.</p>
    <ClockTimeForm clock={clock} onSave={onSave} />
  </div>
}
