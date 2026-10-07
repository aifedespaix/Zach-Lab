import { Hint } from '@suite/shared/ui'

/** « 3 à corriger » : rien quand il n'y a rien à corriger. */
export function ToCorrectBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <Hint label={`${count} exercice${count > 1 ? 's' : ''} à corriger`}>
    <span
      aria-label={`${count} à corriger`}
      style={{ fontSize: 11, fontWeight: 600, padding: '0 6px', borderRadius: 9999, background: 'color-mix(in oklab, #f59e0b 25%, var(--background))', color: 'var(--foreground)', whiteSpace: 'nowrap' }}
    >
      {count} à corriger
    </span>
    </Hint>
  )
}

/** « 2 à revoir » : les exercices corrigés mais ratés. */
export function ToReviewBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <Hint label={`${count} exercice${count > 1 ? 's' : ''} à revoir`}>
    <span
      aria-label={`${count} à revoir`}
      style={{ fontSize: 11, fontWeight: 600, padding: '0 6px', borderRadius: 9999, background: 'color-mix(in oklab, #ef4444 25%, var(--background))', color: 'var(--foreground)', whiteSpace: 'nowrap' }}
    >
      {count} à revoir
    </span>
    </Hint>
  )
}
