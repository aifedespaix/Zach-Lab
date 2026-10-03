import type { PointerEvent as ReactPointerEvent } from 'react'
import { beginTreeDrag as beginSharedTreeDrag, type TreeDragHandlers } from '@suite/shared/tree'
import { isInsideFolder, isSameFilePath, parentDirOf } from '../../persistence/paths'
import type { TreeDragSource } from '../../state/useTreeDragStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'

// The gesture itself — threshold, window listeners, ghost position, hover-to-expand, the swallowed
// click — lives in `@suite/shared/tree`. What stays here is what depends on THIS app's data: the
// path rules, and what a drop and an expansion do to the workspace store.
export { DRAG_THRESHOLD_PX, HOVER_EXPAND_MS, consumeSwallowedClick, dropTargetAt } from '@suite/shared/tree'

/**
 * Whether dropping `source` into `targetPath` would do something.
 *
 * The three refusals mirror `movePath`'s, one gesture earlier: the row itself, a folder inside the
 * dragged folder (an infinite tree), and the folder the file already lives in (a no-op). Refusing
 * them HERE is what keeps the drop highlight honest — it is never shown for a drop that would fail
 * or do nothing.
 */
export function isValidDropTarget(source: TreeDragSource, targetPath: string | null): boolean {
  if (targetPath === null || targetPath === '') return false
  if (isSameFilePath(source.path, targetPath)) return false
  if (source.kind === 'folder' && isInsideFolder(targetPath, source.path)) return false
  if (isSameFilePath(parentDirOf(source.path), targetPath)) return false
  return true
}

const handlers: TreeDragHandlers = {
  canDrop: (source, targetPath) => isValidDropTarget(source, targetPath),
  isExpanded: targetPath => useWorkspaceStore.getState().expandedPaths.has(targetPath),
  expand: targetPath => useWorkspaceStore.getState().expandPaths([targetPath]),
  // The store owns the whole consequence of a move — the open path, the expanded folders, both
  // listings, and the error banner if it fails.
  onDrop: (source, targetPath) => {
    void useWorkspaceStore.getState().moveNode(source.path, targetPath, source.kind === 'folder')
  },
}

/** Starts tracking a press as a possible drag of one of this sidebar's rows. */
export function beginTreeDrag(event: ReactPointerEvent<HTMLElement>, source: TreeDragSource): void {
  beginSharedTreeDrag(event, source, handlers)
}
