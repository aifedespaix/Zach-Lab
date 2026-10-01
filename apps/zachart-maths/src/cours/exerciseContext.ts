import { isKnown, parseBlocks } from '../exercises/blocks'
import { splitPath } from '../exercises/names'
import type { Exercise } from '../exercises/types'
import type { ExerciseContext } from './suggest'

/** Ce que l'exercice ouvert dit de son sujet : son chapitre, son titre, ce qu'il contient. */
export function contextOf(path: string, exercise: Exercise): ExerciseContext {
  const texts = [exercise.reponse]
  const formules: string[] = []
  for (const block of parseBlocks(exercise.blocs)) {
    if (!isKnown(block)) continue
    switch (block.type) {
      case 'texte': texts.push(block.contenu); break
      case 'calcul': formules.push(`${block.expression} ${block.resultat}`); break
      case 'tableau': texts.push(block.cellules.flat().join(' ')); break
      case 'equation':
        for (const step of block.etapes) {
          texts.push(step.action)
          formules.push(step.latex)
        }
    }
  }
  return { chapter: splitPath(path)[0], titre: exercise.titre, texte: texts.join(' '), formules }
}
