import type { FileSession } from '@suite/shared/files'

/** The work area of the base: a text area on the open file, wired to the session's history and autosave. */
export function TextDocument({ session }: { session: FileSession<string> }) {
  return (
    <main style={{ flex: 1, display: 'flex', padding: 16 }}>
      <textarea
        aria-label="Contenu du fichier"
        value={session.doc ?? ''}
        onChange={event => session.edit(event.target.value, 'text')}
        style={{ flex: 1, resize: 'none', padding: 12, background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 8 }}
      />
    </main>
  )
}
