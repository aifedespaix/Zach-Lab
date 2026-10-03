/**
 * The sidebar's drag & drop state now lives in `@suite/shared/tree`, shared with the other apps of
 * the suite. Re-exported here so every import of this path (rows, ghost, tests) keeps working.
 */
export { useTreeDragStore, type TreeDragPointer, type TreeDragSource } from '@suite/shared/tree'
