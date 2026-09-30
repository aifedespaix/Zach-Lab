import type { ReactNode } from 'react'
import { prefersReducedMotion } from '../theme/prefersReducedMotion'
import type { PanelWidthStorage } from './panelWidth'
import { PanelResizeHandle } from './PanelResizeHandle'
import { usePanelResize, type PanelSide } from './usePanelResize'

interface ResizablePanelProps {
  /** The edge of the window the panel sits against. */
  side: PanelSide
  /** The region's accessible name. */
  label: string
  /** The handle's accessible name. */
  resizeLabel?: string
  /** Bounds, default and persistence of the width — see `createPanelWidthStorage`. */
  storage: PanelWidthStorage
  children?: ReactNode
}

/**
 * A side panel of the app shell: a named region whose border can be dragged, and
 * whose width is remembered between launches.
 *
 * An app whose panel needs more than a resizable box (a fold animation, a
 * header) can use `usePanelResize` and `PanelResizeHandle` directly instead.
 */
export function ResizablePanel({ side, label, resizeLabel, storage, children }: ResizablePanelProps) {
  const resize = usePanelResize({ storage, side })
  const border = '1px solid var(--border)'

  return (
    <aside
      aria-label={label}
      style={{
        position: 'relative',
        width: resize.width,
        // The canvas beside it, not the panel, gives way when the window gets
        // narrow — otherwise a drag to 500px would be silently undone by the
        // flex layout the moment the window shrank.
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(side === 'left' ? { borderRight: border } : { borderLeft: border }),
        // Off during a drag — animating every pointer move would make the
        // border lag behind the cursor — and off for a system-level "reduce
        // motion" request.
        transition: resize.resizing || prefersReducedMotion() ? 'none' : 'width 220ms ease',
      }}
    >
      {children}
      <PanelResizeHandle
        resize={resize}
        side={side}
        label={resizeLabel ?? (side === 'left' ? 'Redimensionner le panneau de gauche' : 'Redimensionner le panneau de droite')}
      />
    </aside>
  )
}
