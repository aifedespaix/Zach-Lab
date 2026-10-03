import { newStep, type EquationStep } from './blocks'

/** Ajoute une étape vide juste après `index` ; retourne la nouvelle liste et l'étape créée. */
export function addStepAfter(steps: readonly EquationStep[], index: number): { steps: EquationStep[]; added: EquationStep } {
  const added = newStep()
  const next = [...steps]
  next.splice(index + 1, 0, added)
  return { steps: next, added }
}

/**
 * Retire une étape. La dernière ne part jamais (un bloc équation a toujours une ligne). Retirer
 * la dernière étape efface l'opération de la précédente : elle menait à une étape qui n'existe plus.
 */
export function removeStep(steps: readonly EquationStep[], id: string): EquationStep[] {
  const index = steps.findIndex(s => s.id === id)
  if (steps.length <= 1 || index < 0) return [...steps]
  const next = steps.filter(s => s.id !== id)
  if (index === steps.length - 1) next[next.length - 1] = { ...next[next.length - 1], operation: '' }
  return next
}

export const patchStep = (steps: readonly EquationStep[], id: string, patch: Partial<Pick<EquationStep, 'left' | 'right' | 'operation'>>): EquationStep[] =>
  steps.map(s => (s.id === id ? { ...s, ...patch } : s))
