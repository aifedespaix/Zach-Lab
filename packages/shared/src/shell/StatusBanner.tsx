import type { ReactNode } from 'react'

export interface StatusBannerProps {
  /** `error` is announced as an alert; `info` is a quiet status. */
  kind: 'error' | 'info'
  children: ReactNode
  /** A button beside the text (« Redémarrer »). */
  action?: { label: string; run: () => void }
  /** Shows the close « × »; called when it is pressed. */
  onDismiss?: () => void
  dismissLabel?: string
}

const buttonStyle = {
  background: 'transparent',
  border: '1px solid currentColor',
  borderRadius: 4,
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
  padding: '2px 8px',
} as const

/** A one-line banner at the top of the work area (`.status-banner` in `theme.css`). */
export function StatusBanner({ kind, children, action, onDismiss, dismissLabel = 'Masquer le message' }: StatusBannerProps) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`status-banner${kind === 'info' ? ' status-banner--info' : ''}`}>
      <span style={{ flex: 1 }}>{children}</span>
      {action !== undefined && (
        <button type="button" onClick={action.run} style={buttonStyle}>
          {action.label}
        </button>
      )}
      {onDismiss !== undefined && (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 15 }}
        >
          ×
        </button>
      )}
    </div>
  )
}
