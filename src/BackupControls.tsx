import { useRef, useState } from 'react'
import { matchStore } from './store.ts'

export function BackupControls({ onImport }: { onImport: () => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      setMessage(await action())
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'La sauvegarde n’a pas pu être traitée.')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    const backup = await matchStore.exportBackup()
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'hoopstats-sauvegarde.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'Sauvegarde téléchargée.'
  }

  return <details className="summary-card backup-controls">
    <summary>Sauvegarde des données</summary>
    <p className="muted">Transfère l’effectif et les matchs avec un fichier de sauvegarde. L’import ajoute les éléments manquants.</p>
    <div className="button-row">
      <button className="button" disabled={busy} onClick={() => void run(download)}>Exporter la sauvegarde</button>
      <button className="button" disabled={busy} onClick={() => fileInput.current?.click()}>Importer une sauvegarde</button>
      <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label="Fichier de sauvegarde HoopStats"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          void run(async () => {
            const { players, matches } = await matchStore.importBackup(await file.text())
            await onImport()
            return `Import terminé. Joueurs ajoutés (${players}), matchs ajoutés (${matches}).`
          })
        }} />
    </div>
    {message && <p role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </details>
}
