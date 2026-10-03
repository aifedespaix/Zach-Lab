import { newExercise, type Exercise, type Sheet } from './types'

/** Les opérations sur une fiche, sans React ni disque : chacune rend une nouvelle fiche. */

export type Position = 'start' | 'end'

const indexOf = (sheet: Sheet, id: string) => sheet.exercices.findIndex(e => e.id === id)

/** Un exercice vierge au début ou à la fin ; `added` est celui qu'on vient de créer. */
export function insertExercise(sheet: Sheet, position: Position): { sheet: Sheet; added: Exercise } {
  const added = newExercise()
  const exercices = position === 'start' ? [added, ...sheet.exercices] : [...sheet.exercices, added]
  return { sheet: { ...sheet, exercices }, added }
}

/** L'id de l'exercice voisin ; `null` au bord de la fiche ou si `id` n'y est pas. */
export function neighbour(sheet: Sheet, id: string, delta: -1 | 1): string | null {
  const i = indexOf(sheet, id)
  return i < 0 ? null : (sheet.exercices[i + delta]?.id ?? null)
}

/** Rien n'a encore été écrit dedans (la page seule ne compte pas). */
export const isBlank = (e: Exercise) =>
  e.numero.trim() === '' && e.enonce.trim() === '' && e.reponse.trim() === '' && e.notes.trim() === '' && e.blocs.length === 0

/**
 * Retire un exercice et dit lequel afficher ensuite : le suivant, ou le précédent si c'était le
 * dernier. Une fiche garde toujours un exercice : sur le seul restant, rien ne bouge.
 */
export function dropExercise(sheet: Sheet, id: string): { sheet: Sheet; focus: string } {
  const i = indexOf(sheet, id)
  if (i < 0 || sheet.exercices.length <= 1) return { sheet, focus: id }
  const exercices = sheet.exercices.filter(e => e.id !== id)
  return { sheet: { ...sheet, exercices }, focus: exercices[Math.min(i, exercices.length - 1)].id }
}

export const patchExercise = (sheet: Sheet, id: string, patch: Partial<Exercise>): Sheet => ({
  ...sheet,
  exercices: sheet.exercices.map(e => (e.id === id ? { ...e, ...patch } : e)),
})
