/** « 3 à corriger » : rien quand il n'y a rien à corriger. */
export function ToCorrectBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} à corriger`}
      title={`${count} exercice${count > 1 ? 's' : ''} à corriger`}
      style={{ fontSize: 11, fontWeight: 600, padding: '0 6px', borderRadius: 9999, background: 'color-mix(in oklab, #f59e0b 25%, var(--background))', color: 'var(--foreground)' }}
    >
      {count} à corriger
    </span>
  )
}
