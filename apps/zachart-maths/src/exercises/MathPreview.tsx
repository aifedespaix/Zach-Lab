import { renderMathToHtml } from '@suite/shared/math'
import { splitInlineMath } from './inlineMath'

/**
 * L'aperçu d'un texte qui contient des formules `$…$` : le même texte, formules composées. Absent tant que le texte n'en a aucune,
 * pour ne rien ajouter à l'écran de qui n'en écrit pas.
 */
export function MathPreview({ text }: { text: string }) {
  const parts = splitInlineMath(text)
  if (!parts.some(p => p.kind === 'math')) return null
  return (
    <div
      role="note"
      aria-label="Aperçu avec formules"
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', fontSize: 14, lineHeight: 1.6, padding: '2px 8px', color: 'var(--foreground)' }}
    >
      {parts.map((part, i) =>
        part.kind === 'text'
          ? <span key={i}>{part.value}</span>
          : <span key={i} dangerouslySetInnerHTML={{ __html: renderMathToHtml(part.value, false) }} />,
      )}
    </div>
  )
}
