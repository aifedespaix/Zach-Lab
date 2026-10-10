import { useCommand } from '../commands'
import type { HistoryStore } from './createHistoryStore'

/** Registers `edit.undo` / `edit.redo` on a history store, enabled by its depth. */
export function useHistoryCommands<T>(store: HistoryStore<T>): { canUndo: boolean; canRedo: boolean } {
  const canUndo = store(state => state.past.length > 0)
  const canRedo = store(state => state.future.length > 0)
  useCommand('edit.undo', () => store.getState().undo(), canUndo)
  useCommand('edit.redo', () => store.getState().redo(), canRedo)
  return { canUndo, canRedo }
}
