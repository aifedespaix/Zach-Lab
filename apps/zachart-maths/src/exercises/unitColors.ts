import { findLatexQuantities } from './latexQuantities'
import { findQuantities } from './quantities'
import { tableLayout } from './tableUnits'
import type { Exercise } from './types'

/**
 * Les teintes (HSL) que reçoivent les unités, dans l'ordre. Le bleu de l'énoncé et de la réponse
 * n'est pas en tête : la première unité d'un exercice ne doit pas se fondre dans leur cadre.
 */
export const UNIT_HUES = [150, 30, 280, 340, 175, 60, 215, 100] as const

function addUnit(hues: Map<string, number>, unit: string): void {
  if (!hues.has(unit)) hues.set(unit, UNIT_HUES[hues.size % UNIT_HUES.length])
}

/**
 * Une teinte par unité, attribuée à sa première apparition en parcourant `texts` dans l'ordre :
 * `16 km` et `4 km` ont donc la même couleur partout dans l'exercice. Au-delà de huit unités la
 * palette recommence, deux unités peuvent alors se ressembler : mieux vaut cela qu'un refus.
 */
export function assignHues(texts: readonly string[]): Map<string, number> {
  const hues = new Map<string, number>()
  for (const text of texts) {
    for (const quantity of findQuantities(text)) addUnit(hues, quantity.unit)
  }
  return hues
}

const isTextBlock = (block: unknown): block is { type: 'texte'; contenu: string } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'texte' &&
  typeof (block as { contenu?: unknown }).contenu === 'string'

/** Un bloc tableau dont les cellules sont bien des chaînes ; un fichier mal formé n'est pas lu du tout. */
const isTableBlock = (block: unknown): block is { type: 'tableau'; cellules: string[][] } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'tableau' &&
  Array.isArray((block as { cellules?: unknown }).cellules) &&
  ((block as { cellules: unknown[] }).cellules).every(row => Array.isArray(row) && row.every(cell => typeof cell === 'string'))

const isCalcBlock = (block: unknown): block is { type: 'calcul'; lignes: { latex: string }[] } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'calcul' &&
  Array.isArray((block as { lignes?: unknown }).lignes)

const isEquationBlock = (block: unknown): block is { type: 'equation'; etapes: { left?: unknown; right?: unknown; operation?: unknown }[] } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'equation' &&
  Array.isArray((block as { etapes?: unknown }).etapes)

/**
 * Une teinte par unité de TOUT l'exercice, dans l'ordre de lecture : l'énoncé, les blocs de la zone A,
 * ceux de la zone B, la réponse. Un bloc texte apporte les grandeurs qu'il contient (`16 km`), un
 * bloc tableau les unités de ses en-têtes (`Distance (km)`, `h`) : une unité d'une lettre, que
 * `findQuantities` refuse dans un texte libre, a ainsi sa teinte quand elle n'est que dans un en-tête,
 * et la même unité a la même couleur dans l'énoncé et dans le tableau. Les formules (calcul, équation)
 * apportent les grandeurs de leur LaTeX (`16\text{ km}`) : une unité n'écrite que dans une formule a donc sa teinte.
 * Les tableaux mal formés et les blocs d'un type inconnu n'apportent rien.
 */
export function assignExerciseHues(exercise: Pick<Exercise, 'enonce' | 'blocs' | 'blocsB' | 'reponse'>): Map<string, number> {
  const hues = new Map<string, number>()
  const fromText = (text: string) => {
    for (const quantity of findQuantities(text)) addUnit(hues, quantity.unit)
  }
  const fromLatex = (latex: string) => {
    for (const quantity of findLatexQuantities(latex)) addUnit(hues, quantity.unit)
  }
  const fromBlock = (block: unknown) => {
    if (isTextBlock(block)) fromText(block.contenu)
    else if (isTableBlock(block)) {
      for (const unit of tableLayout(block.cellules)?.units ?? []) if (unit !== null) addUnit(hues, unit)
    } else if (isCalcBlock(block)) {
      for (const line of block.lignes) if (typeof line.latex === 'string') fromLatex(line.latex)
    } else if (isEquationBlock(block)) {
      for (const step of block.etapes) for (const latex of [step.left, step.right, step.operation]) if (typeof latex === 'string') fromLatex(latex)
    }
  }
  fromText(exercise.enonce)
  exercise.blocs.forEach(fromBlock)
  ;(exercise.blocsB ?? []).forEach(fromBlock)
  fromText(exercise.reponse)
  return hues
}
