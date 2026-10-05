import { findNextToCorrect } from './correction'
import { useExerciseStore } from './useExerciseStore'
import { goToExercise, useOpenExercise } from './useOpenExercise'

/** Saute au prochain exercice à corriger ; `false` s'il n'y en a plus. */
export function jumpToNextToCorrect(): boolean {
  const { tree } = useExerciseStore.getState()
  const { path, sheet, currentId } = useOpenExercise.getState()
  const target = findNextToCorrect(tree, path, sheet, currentId)
  if (target === null) return false
  goToExercise(target.path, target.exerciseId)
  return true
}
