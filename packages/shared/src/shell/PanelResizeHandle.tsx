import { Hint, TooltipProvider } from '../ui'
import type { PanelResize, PanelSide } from './usePanelResize'

interface PanelResizeHandleProps {
  resize: PanelResize
  side: PanelSide
  /** The accessible name — « Redimensionner la barre latérale ». */
  label: string
  /** Colour of the strip while it is being dragged. */
  activeColor?: string
}

/**
 * The drag target for a panel's resize. It straddles the panel's inner border (a
 * 5px strip centred on it) rather than sitting inside the panel: a 1px border is
 * far too small a target to hit, and widening the border itself would move the
 * content. `role="separator"` with the aria-value* trio is the standard
 * split-pane contract, so the width is also adjustable with the arrow keys once
 * the handle has focus. Render it as a child of the panel.
 */
export function PanelResizeHandle({ resize, side, label, activeColor = 'var(--ring)' }: PanelResizeHandleProps) {
  const { resizing } = resize

  // Its own provider: a panel that has no tooltip anywhere else must not need one
  // in its parent just to have a handle.
  return (
    <TooltipProvider>
      <Hint label="Glisser pour redimensionner (double-clic : largeur par défaut)">
        <div
          ref={resize.handleRef}
          role="separator"
          aria-label={label}
          aria-orientation="vertical"
          aria-valuenow={resize.width}
          aria-valuemin={resize.min}
          aria-valuemax={resize.max}
          tabIndex={0}
          onPointerDown={resize.onPointerDown}
          onPointerMove={resize.onPointerMove}
          onPointerUp={resize.onPointerUp}
          onPointerCancel={resize.onPointerUp}
          onDoubleClick={resize.reset}
          onKeyDown={resize.onKeyDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(side === 'left' ? { right: -3 } : { left: -2 }),
            width: 5,
            cursor: 'col-resize',
            // Invisible until it is being used or hovered: the 1px border is
            // already the visual edge, this only has to be grabbable.
            background: resizing ? activeColor : 'transparent',
            transition: 'background 0.12s ease',
            // Above the panel's rows, so a drag started right on the border is
            // never stolen by whatever row happens to sit under it.
            zIndex: 5,
            touchAction: 'none',
          }}
          onMouseEnter={event => {
            if (!resizing) event.currentTarget.style.background = 'color-mix(in oklch, var(--ring), transparent 60%)'
          }}
          onMouseLeave={event => {
            if (!resizing) event.currentTarget.style.background = 'transparent'
          }}
        />
      </Hint>
    </TooltipProvider>
  )
}
