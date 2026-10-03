import type { ReactNode } from 'react'

/** A hairline between two groups of actions in a `PanelFooter`. */
export function PanelFooterSeparator() {
  return <span aria-hidden style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
}

/**
 * The action bar at the bottom of a side panel: « what the panel shows », then the panel's own
 * controls, each group separated by `PanelFooterSeparator`. Items wrap rather than clip when the
 * panel is at its minimum width.
 */
export function PanelFooter({ label = 'Actions du panneau', children }: { label?: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        padding: '6px 8px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}
