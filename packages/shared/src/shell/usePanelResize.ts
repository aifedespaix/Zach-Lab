import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { PanelWidthStorage } from './panelWidth'

/** Which edge of the window the panel sits against. A left panel's grab handle is on its RIGHT border, and vice versa. */
export type PanelSide = 'left' | 'right'

/** How far one arrow-key press moves the border, for keyboard resize. */
export const KEYBOARD_RESIZE_STEP = 16

export interface PanelResize {
  width: number
  /** A drag is in progress — panels switch their width transition off while it is. */
  resizing: boolean
  min: number
  max: number
  /** Sets the width, keeps it inside the bounds and remembers it for the next launch. */
  commitWidth: (next: number) => void
  /** Back to the panel's default width. */
  reset: () => void
  handleRef: RefObject<HTMLDivElement | null>
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
}

/**
 * The width of a resizable side panel: drag its border, or use the arrow keys
 * once the handle has focus.
 *
 * The handle's element must be a CHILD of the panel: the width is measured from
 * the panel's own edge (`handleRef.parentElement`) rather than from the
 * pointer's delta, so it can never drift away from the cursor over a long drag
 * or after a clamp at either bound.
 */
export function usePanelResize({ storage, side }: { storage: PanelWidthStorage; side: PanelSide }): PanelResize {
  // Read synchronously on the first render — an effect would paint the default
  // width for a frame and then visibly snap to the saved one.
  const [width, setWidth] = useState(storage.load)
  const [resizing, setResizing] = useState(false)
  const handleRef = useRef<HTMLDivElement>(null)

  // Writing on every pointer move would hammer `localStorage` a hundred times
  // per drag for a value only the NEXT launch reads, so the width is persisted
  // once the gesture ends. Keyboard resizes go through the same helper.
  const commitWidth = useCallback(
    (next: number) => {
      const clamped = storage.clamp(next)
      setWidth(clamped)
      storage.save(clamped)
    },
    [storage],
  )

  const reset = useCallback(() => commitWidth(storage.DEFAULT), [commitWidth, storage])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Pointer capture, not window listeners: the border keeps receiving moves
    // even when the cursor outruns it (a fast drag), and the browser cancels
    // the capture for us if the window loses focus mid-gesture.
    event.preventDefault()
    // Called optionally: jsdom — and any engine without the Pointer Events
    // capture API — has no such method, and the drag works without it (only
    // the "cursor outruns the border" case degrades).
    handleRef.current?.setPointerCapture?.(event.pointerId)
    setResizing(true)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizing) return
    const box = handleRef.current?.parentElement?.getBoundingClientRect()
    if (box === undefined) return
    setWidth(storage.clamp(side === 'left' ? event.clientX - box.left : box.right - event.clientX))
  }

  // Also the handler of `pointercancel`: a drag cut short still ends where it stopped.
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizing) return
    handleRef.current?.releasePointerCapture?.(event.pointerId)
    setResizing(false)
    storage.save(width)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    // The border of a left panel is on its right, so → widens it; a right
    // panel's is on its left, so the directions are the mirror.
    const widens = (event.key === 'ArrowRight') === (side === 'left')
    commitWidth(width + (widens ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP))
  }

  return {
    width,
    resizing,
    min: storage.MIN,
    max: storage.MAX,
    commitWidth,
    reset,
    handleRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
  }
}
