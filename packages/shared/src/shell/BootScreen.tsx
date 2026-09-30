import type { ReactNode } from 'react'

/**
 * Full-screen cover shown while the workspace is loading. Sits on top of the
 * rest of the app rather than replacing it, so nothing underneath has to wait
 * for this to unmount before it can start its own work.
 *
 * The app draws its own mark inside it.
 */
export function BootScreen({ children }: { children?: ReactNode }) {
  return (
    <div
      role="status"
      aria-label="Chargement de l’application"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
      }}
    >
      {children}
    </div>
  )
}
