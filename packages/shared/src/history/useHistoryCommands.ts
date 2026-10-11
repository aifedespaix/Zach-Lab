import { useCommand } from '../commands/useCommand'

export interface HistoryControls {
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean
}

/**
 * Publie `edit.undo` / `edit.redo` (ids standard, `allowInEditable`) pour l'historique d'un fichier :
 * le bouton de la barre, le raccourci et la palette passent tous par là, et se grisent d'eux-mêmes.
 */
export function useHistoryCommands({ undo, redo, canUndo, canRedo }: HistoryControls): void {
  useCommand('edit.undo', undo, canUndo)
  useCommand('edit.redo', redo, canRedo)
}
