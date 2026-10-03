import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTreeDragStore } from './useTreeDragStore'

interface TreeDragGhostProps {
  /** The second line when the pointer is over a valid destination — « Déplacer dans « B » ». */
  describeTarget: (targetPath: string) => string
  /** The second line when it is not over a valid destination. */
  refusal?: string
  /** The icon of what is in flight, by kind. */
  icon?: (kind: string) => ReactNode
}

/**
 * What follows the cursor during a tree drag.
 *
 * Two lines on purpose: the first is the row that is in flight (so a drag that started on a
 * deeply indented file still says what it is carrying), the second says where it would land — the
 * destination folder's name, or a plain refusal when the pointer is not over a valid one. Showing
 * the destination is what makes the gesture answer "où ça va se déposer ?" without the user
 * having to guess from a highlight alone.
 *
 * Portalled to `document.body` and positioned `fixed`: the sidebar scrolls and clips its content,
 * so a ghost rendered inside it would be cut off exactly when the drag reaches the bottom of the
 * list.
 */
export function TreeDragGhost({ describeTarget, refusal = 'Déposer sur un dossier', icon }: TreeDragGhostProps) {
  const source = useTreeDragStore(s => s.source)
  const pointer = useTreeDragStore(s => s.pointer)
  const targetPath = useTreeDragStore(s => s.targetPath)

  if (source === null || pointer === null) return null

  return createPortal(
    <div
      className="tree-drag-ghost"
      data-testid="tree-drag-ghost"
      data-valid={targetPath !== null}
      style={{ left: pointer.x + 14, top: pointer.y + 14 }}
    >
      <span className="tree-drag-ghost__name">
        {icon?.(source.kind)}
        {source.name}
      </span>
      <span className="tree-drag-ghost__target">{targetPath === null ? refusal : describeTarget(targetPath)}</span>
    </div>,
    document.body,
  )
}
