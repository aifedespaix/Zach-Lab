import { newStep, type EquationStep } from './blocks'

/** Ajoute une étape vide juste après `index` ; retourne la nouvelle liste et l'étape créée. */
export function addStepAfter(steps: readonly EquationStep[], index: number): { steps: EquationStep[]; added: EquationStep } {
  const added = newStep()
  const next = [...steps]
  next.splice(index + 1, 0, added)
  return { steps: next, added }
}

/**
 * Retire une étape. La dernière ne part jamais (un bloc équation a toujours une ligne), et
 * retirer la première donne son rôle de départ à la suivante : son action n'a plus de sens.
 */
export function removeStep(steps: readonly EquationStep[], id: string): EquationStep[] {
  if (steps.length <= 1) return [...steps]
  const next = steps.filter(s => s.id !== id)
  if (next.length === steps.length) return [...steps]
  next[0] = { ...next[0], action: '' }
  return next
}

export const patchStep = (steps: readonly EquationStep[], id: string, patch: Partial<Pick<EquationStep, 'action' | 'latex'>>): EquationStep[] =>
  steps.map(s => (s.id === id ? { ...s, ...patch } : s))
