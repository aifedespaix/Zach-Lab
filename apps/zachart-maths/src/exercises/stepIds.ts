import type { PlainEquationStep } from '@suite/shared/equation'
import type { EquationStep } from './blocks'

export const toPlain = (steps: readonly EquationStep[]): PlainEquationStep[] =>
  steps.map(({ left, right, operation }) => ({ left, right, operation }))

const same = (a: EquationStep, b: PlainEquationStep) => a.left === b.left && a.right === b.right && a.operation === (b.operation ?? '')

/**
 * Rend ses ids à une liste d'étapes que le moteur partagé (sans ids) vient de modifier : un champ
 * changé garde l'id ; une étape insérée ou retirée se repère par le préfixe et le suffixe qui n'ont
 * pas bougé. Deux étapes au contenu identique sont interchangeables, donc l'ambiguïté est sans effet.
 */
export function withIds(prev: readonly EquationStep[], next: readonly PlainEquationStep[]): EquationStep[] {
  const fresh = (s: PlainEquationStep): EquationStep => ({ id: crypto.randomUUID(), left: s.left, right: s.right, operation: s.operation ?? '' })
  const keep = (p: EquationStep, s: PlainEquationStep): EquationStep => ({ id: p.id, left: s.left, right: s.right, operation: s.operation ?? '' })
  if (next.length === prev.length) return next.map((s, i) => keep(prev[i], s))
  let head = 0
  while (head < prev.length && head < next.length && same(prev[head], next[head])) head++
  let tail = 0
  while (tail < prev.length - head && tail < next.length - head && same(prev[prev.length - 1 - tail], next[next.length - 1 - tail])) tail++
  return next.map((s, i) => {
    if (i < head) return keep(prev[i], s)
    if (i >= next.length - tail) return keep(prev[prev.length - (next.length - i)], s)
    return fresh(s)
  })
}
