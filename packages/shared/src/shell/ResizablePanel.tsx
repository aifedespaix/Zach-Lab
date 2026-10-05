import type { ReactNode } from 'react'
import { prefersReducedMotion } from '../theme/prefersReducedMotion'
import type { PanelWidthStorage } from './panelWidth'
import { PanelResizeHandle } from './PanelResizeHandle'
import { usePanelResize, type PanelSide } from './usePanelResize'

/** Width of the strip a folded panel leaves behind. */
export const RAIL_WIDTH = 32

interface ResizablePanelProps {
  /** The edge of the window the panel sits against. */
  side: PanelSide
  /** The region's accessible name. */
  label: string
  /** The handle's accessible name. */
  resizeLabel?: string
  /** Bounds, default and persistence of the width — see `createPanelWidthStorage`. */
  storage: PanelWidthStorage
  /**
   * What the panel shrinks to when `collapsed`. Giving one makes the panel foldable: it stays mounted
   * and its width animates between the saved width and the rail's, the content fading out as the rail
   * fades in. Without it the panel is a plain resizable box.
   */
  rail?: ReactNode
  collapsed?: boolean
  /** Width of the folded panel, for a rail that carries text. */
  railWidth?: number
  children?: ReactNode
}

/**
 * A side panel of the app shell: a named region whose border can be dragged, and
 * whose width is remembered between launches.
 *
 * An app whose panel needs more than a resizable box (a header) can use
 * `usePanelResize` and `PanelResizeHandle` directly instead.
 */
export function ResizablePanel({ side, label, resizeLabel, storage, rail, collapsed = false, railWidth = RAIL_WIDTH, children }: ResizablePanelProps) {
  const resize = usePanelResize({ storage, side })
  const border = '1px solid var(--border)'
  // Off during a drag — animating every pointer move would make the border lag behind the cursor —
  // and off for a system-level "reduce motion" request.
  const still = resize.resizing || prefersReducedMotion()
  const fade = still ? 'none' : 'opacity 160ms ease'

  return (
    <aside
      aria-label={label}
      style={{
        position: 'relative',
        width: collapsed ? railWidth : resize.width,
        // The canvas beside it, not the panel, gives way when the window gets
        // narrow — otherwise a drag to 500px would be silently undone by the
        // flex layout the moment the window shrank.
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(side === 'left' ? { borderRight: border } : { borderLeft: border }),
        transition: still ? 'none' : 'width 220ms ease',
      }}
    >
      {rail === undefined ? (
        children
      ) : (
        // The content keeps its real width and is clipped, not squeezed: its text must not reflow
        // while the width animates. The handle sits OUTSIDE the clip, it straddles the border.
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div
            inert={collapsed}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              [side]: 0,
              width: resize.width,
              display: 'flex',
              flexDirection: 'column',
              opacity: collapsed ? 0 : 1,
              transition: fade,
            }}
          >
            {children}
          </div>
          <div inert={!collapsed} style={{ position: 'absolute', inset: 0, display: 'flex', opacity: collapsed ? 1 : 0, transition: fade }}>
            {rail}
          </div>
        </div>
      )}
      {!collapsed && (
        <PanelResizeHandle
          resize={resize}
          side={side}
          label={resizeLabel ?? (side === 'left' ? 'Redimensionner le panneau de gauche' : 'Redimensionner le panneau de droite')}
        />
      )}
    </aside>
  )
}
