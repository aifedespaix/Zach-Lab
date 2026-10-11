import type { FileSession } from '@suite/shared/files'

/** La zone de travail de la démo : un texte brut lié à la session de fichier. */
export function TextDocument({ session }: { session: FileSession<string> }) {
  if (session.doc === null) {
    return (
      <p style={{ color: 'var(--muted-foreground)', fontSize: 14, padding: 16 }}>
        Aucun fichier ouvert. « Nouveau fichier » en crée un.
      </p>
    )
  }
  return (
    <textarea
      aria-label="Contenu du fichier"
      value={session.doc}
      onChange={event => session.setDoc(event.target.value, 'text')}
      style={{ flex: 1, padding: 16, resize: 'none', background: 'transparent', color: 'inherit', border: 0, outline: 'none' }}
    />
  )
}
