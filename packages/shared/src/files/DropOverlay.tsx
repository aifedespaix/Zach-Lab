import type { ReactNode } from 'react'

/**
 * Le voile affiché pendant qu'un fichier survole la zone de dépôt. Ne capte pas le pointeur : le
 * dépôt lui-même est reçu par `useFileDropZone`, ce composant ne fait que dire « ici ».
 */
export function DropOverlay({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 8,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed var(--primary)',
        borderRadius: 8,
        background: 'color-mix(in oklch, var(--primary), transparent 90%)',
        color: 'var(--primary)',
        fontSize: 16,
        fontWeight: 500,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  )
}
