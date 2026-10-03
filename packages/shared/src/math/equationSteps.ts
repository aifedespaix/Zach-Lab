/**
 * Une étape d'équation, vue par la logique pure : deux membres LaTeX et une opération facultative.
 * Le type d'une app (`EquationStep` de Mentale, de Maths) y est compatible sans en dépendre.
 */
export interface EquationStepLike {
  left: string
  right: string
  operation?: string
}

/**
 * Un identifiant seul — une lettre, ou une commande LaTeX de lettre grecque,
 * éventuellement indicée (`x`, `\alpha`, `x_1`, `n_{max}`) — et rien d'autre.
 *
 * C'est le test qui détecte « la variable est isolée » sur un membre
 * d'équation : voir `equationStepIsSolved`.
 */
const BARE_VARIABLE = /^(?:[a-zA-Z]|\\[a-zA-Z]+)(?:_(?:\{[^{}]*\}|[a-zA-Z0-9]))?$/

export function isBareVariable(latex: string): boolean {
  return BARE_VARIABLE.test(latex.trim())
}

/** `x_{1}` et `x_1` sont la même variable : l'indice à un caractère perd ses accolades. */
function normalizeIndexes(latex: string): string {
  return latex.replace(/_\{([a-zA-Z0-9])\}/g, '_$1')
}

/**
 * `latex` contient-il la variable `variable` ?
 *
 * Les commandes LaTeX (`\frac`, `\max`…) sont retirées d'abord, sauf si la
 * variable en est une (`\alpha`) : sans ça, le `x` de `\max` compterait. Une
 * lettre collée compte (`2ax` contient `x` — multiplication implicite), une
 * commande doit finir là (`\alphabet` n'est pas `\alpha`), et l'indice fait
 * partie du nom (`x` n'est pas `x_1`).
 */
function mentionsVariable(latex: string, variable: string): boolean {
  const name = normalizeIndexes(variable.trim())
  const [base, index] = name.split('_')
  const source = normalizeIndexes(latex).replace(/\\[a-zA-Z]+/g, command => (command === base ? command : ' '))
  const escape = (text: string) => text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  const tail = base.startsWith('\\') ? '(?![a-zA-Z])' : ''
  const pattern =
    index === undefined
      ? `${escape(base)}${tail}(?!_)`
      : `${escape(base)}${tail}_${escape(index)}(?![a-zA-Z0-9}])`
  return new RegExp(pattern).test(source)
}

/** `variable` est seule de son côté, et l'autre côté en donne vraiment la valeur. */
function isolates(variable: string, other: string): boolean {
  return isBareVariable(variable) && other.trim() !== '' && !mentionsVariable(other, variable)
}

/**
 * Si l'étape `index` d'une équation EST le résultat — détecté, jamais saisi.
 *
 * résolue = dernière étape, un membre est une variable seule `v`, l'autre est
 * non vide et ne contient pas `v` (voir `mentionsVariable`).
 */
export function equationStepIsSolved(steps: readonly EquationStepLike[], index: number): boolean {
  if (index !== steps.length - 1) return false
  const step = steps[index]
  return step !== undefined && (isolates(step.left, step.right) || isolates(step.right, step.left))
}
