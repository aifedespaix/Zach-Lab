import type { ReactNode } from 'react'

interface AppShellProps {
  /** The header row above the content: the app's toolbar. Left out, no header is drawn. */
  toolbar?: ReactNode
  /** A panel against the left edge — typically a `ResizablePanel`. */
  left?: ReactNode
  /** A panel against the right edge. */
  right?: ReactNode
  /** Full-screen covers and dialogs: rendered last, outside the layout. */
  overlays?: ReactNode
  /** The central area, under the toolbar. */
  children: ReactNode
}

/**
 * The frame every app of the suite lives in: `[left panel] [toolbar over content] [right panel]`,
 * filling the window.
 *
 * It only places things. The panels own their width and their content, so an
 * app can put a file tree on the left and a detail view on the right, and a
 * new app can start with both empty.
 */
export function AppShell({ toolbar, left, right, overlays, children }: AppShellProps) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {left}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {toolbar !== undefined && (
          <header style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 12 }}>{toolbar}</header>
        )}
        {children}
      </div>
      {right}
      {overlays}
    </div>
  )
}
