import type { LatexHighlight } from '@suite/shared/equation'
import type { EquationStep } from './blocks'
import { colorTerms, type TermSegment } from './likeTerms'
import { assignTermColors, type Theme } from './termColors'

type Steps = readonly Pick<EquationStep, 'left' | 'right'>[]

/** Vrai quand un groupe a au moins deux termes dans l'étape (les deux membres comptés). */
function hasRegroupableGroup(segments: readonly TermSegment[]): boolean {
  const counts = new Map<string, number>()
  for (const { group } of segments) if (group !== null) counts.set(group, (counts.get(group) ?? 0) + 1)
  return [...counts.values()].some(count => count >= 2)
}

/**
 * La coloration des termes semblables d'un bloc équation, à peindre DANS les champs MathLive
 * (`MathFieldEditor.highlight`) : la valeur de l'élève n'est jamais modifiée, seul le fond des termes change.
 *
 * Les couleurs sont attribuées sur tout le bloc, pour que `x` garde sa couleur d'une étape à l'autre. Un membre
 * n'est coloré que si un groupe a au moins deux termes dans son étape (les deux membres comptés) : `5x = 10` n'a
 * rien à regrouper. Le LaTeX reçu est la valeur du champ au moment de la frappe, plus récente que `steps`.
 */
export function termHighlighter(steps: Steps, theme: Theme) {
  const parsed = steps.map(step => [colorTerms(step.left), colorTerms(step.right)] as const)
  const colors = assignTermColors(parsed.flatMap(sides => [...sides[0], ...sides[1]]).map(segment => segment.group), theme)
  return (latex: string, where: { step: number; side: 'left' | 'right' }): LatexHighlight[] => {
    const mine = colorTerms(latex)
    const other = parsed[where.step]?.[where.side === 'left' ? 1 : 0] ?? []
    if (!hasRegroupableGroup([...mine, ...other])) return []
    const highlights: LatexHighlight[] = []
    let from = 0
    for (const { text, group } of mine) {
      const color = group === null ? undefined : colors.get(group) ?? undefined
      if (color !== undefined) highlights.push({ from, to: from + text.length, color })
      from += text.length
    }
    return highlights
  }
}
