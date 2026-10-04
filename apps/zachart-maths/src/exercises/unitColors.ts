import { findQuantities } from './quantities'
import type { Exercise } from './types'

/**
 * Les teintes (HSL) que reçoivent les unités, dans l'ordre. Le bleu de l'énoncé et de la réponse
 * n'est pas en tête : la première unité d'un exercice ne doit pas se fondre dans leur cadre.
 */
export const UNIT_HUES = [150, 30, 280, 340, 175, 60, 215, 100] as const

/**
 * Une teinte par unité, attribuée à sa première apparition en parcourant `texts` dans l'ordre :
 * `16 km` et `4 km` ont donc la même couleur partout dans l'exercice. Au-delà de huit unités la
 * palette recommence, deux unités peuvent alors se ressembler : mieux vaut cela qu'un refus.
 */
export function assignHues(texts: readonly string[]): Map<string, number> {
  const hues = new Map<string, number>()
  for (const text of texts) {
    for (const quantity of findQuantities(text)) {
      if (!hues.has(quantity.unit)) hues.set(quantity.unit, UNIT_HUES[hues.size % UNIT_HUES.length])
    }
  }
  return hues
}

const isTextBlock = (block: unknown): block is { type: 'texte'; contenu: string } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'texte' &&
  typeof (block as { contenu?: unknown }).contenu === 'string'

/**
 * Les textes d'un exercice que la coloration couvre, dans l'ordre de lecture : l'énoncé, les blocs
 * texte de la zone A puis de la zone B, la réponse. Les blocs de formule, de tableau et ceux d'un
 * type inconnu n'y sont pas : leur contenu n'est pas du texte libre.
 */
export function exerciseTexts(exercise: Pick<Exercise, 'enonce' | 'blocs' | 'blocsB' | 'reponse'>): string[] {
  return [
    exercise.enonce,
    ...exercise.blocs.filter(isTextBlock).map(block => block.contenu),
    ...(exercise.blocsB ?? []).filter(isTextBlock).map(block => block.contenu),
    exercise.reponse,
  ]
}
