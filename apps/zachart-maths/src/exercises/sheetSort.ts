import type { Exercise } from './types'

/** Comment le plan de la fiche ordonne ses exercices ; `ordre` = l'ordre réel de la fiche. */
export type SheetSort = 'ordre' | 'numero-asc' | 'numero-desc' | 'date-asc' | 'date-desc' | 'a-corriger' | 'a-revoir' | 'corriges'

export const SHEET_SORTS: readonly SheetSort[] = ['ordre', 'numero-asc', 'numero-desc', 'date-asc', 'date-desc', 'a-corriger', 'a-revoir', 'corriges']

export const isSheetSort = (value: unknown): value is SheetSort => SHEET_SORTS.includes(value as SheetSort)

/** Le libellé d'un exercice dans le plan : son numéro, ou sa position (1…) quand il n'en a pas. */
export const exerciseLabel = (exercise: Exercise, position: number) => (exercise.numero.trim() === '' ? String(position) : exercise.numero.trim())

/** Rang d'un exercice quand on met un état en tête : l'état choisi, puis les autres dans l'ordre de la fiche. */
function stateRank(exercise: Exercise, sort: SheetSort): number {
  const corrected = exercise.corrige === true
  const review = corrected && exercise.rate === true
  switch (sort) {
    case 'a-corriger': return corrected ? 1 : 0
    case 'a-revoir': return review ? 0 : 1
    default: return corrected && !review ? 0 : 1 // 'corriges'
  }
}

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

/**
 * Les indices (dans `exercises`) des exercices à afficher, dans l'ordre demandé. Un tri naturel :
 * 1, 1a, 1b, 2, 10 (jamais 1, 10, 2). À égalité, l'ordre de la fiche décide, pour que le plan reste stable.
 * Les exercices sans date de création vont toujours en dernier.
 */
export function sortedIndices(exercises: readonly Exercise[], sort: SheetSort): number[] {
  const indices = exercises.map((_, i) => i)
  if (sort === 'ordre') return indices
  const compare = (a: number, b: number): number => {
    const x = exercises[a]
    const y = exercises[b]
    switch (sort) {
      case 'numero-asc': return collator.compare(exerciseLabel(x, a + 1), exerciseLabel(y, b + 1))
      case 'numero-desc': return collator.compare(exerciseLabel(y, b + 1), exerciseLabel(x, a + 1))
      case 'date-asc':
      case 'date-desc': {
        if (x.creeLe === undefined || y.creeLe === undefined) return x.creeLe === y.creeLe ? 0 : x.creeLe === undefined ? 1 : -1
        return sort === 'date-asc' ? x.creeLe.localeCompare(y.creeLe) : y.creeLe.localeCompare(x.creeLe)
      }
      default: return stateRank(x, sort) - stateRank(y, sort)
    }
  }
  return indices.sort((a, b) => compare(a, b) || a - b)
}
