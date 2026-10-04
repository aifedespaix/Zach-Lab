import { renderMathToHtml } from '@suite/shared/math'
import type { EquationStep } from './blocks'
import { colorTerms, type TermSegment } from './likeTerms'
import { assignTermColors, type Theme } from './termColors'

/**
 * Le LaTeX d'un membre dont chaque terme coloré est dans une boîte : `\colorbox{#hex}{$3x$}`. Le
 * texte d'un terme coloré a été validé par l'analyseur (chiffres, lettres, exposants, signes,
 * `\cdot`), donc il ne peut ni fermer la boîte ni ouvrir autre chose. Les morceaux non colorés
 * (opérateurs, espaces, termes illisibles) sont recopiés tels quels.
 */
export function coloredLatex(segments: readonly TermSegment[], colors: ReadonlyMap<string, string>): string {
  return segments
    .map(({ text, group }) => {
      const color = group === null ? undefined : colors.get(group)
      return color === undefined ? text : `\\colorbox{${color}}{$${text}$}`
    })
    .join('')
}

/**
 * L'aide du bloc équation : la même équation que l'élève écrit, recomposée en lecture seule, où les
 * termes semblables (`3x` et `5x`, les constantes) ont la même couleur. Le champ MathLive, lui, n'est
 * jamais touché : une copie colorée vit à côté, la valeur enregistrée reste celle de l'élève.
 *
 * Les couleurs sont attribuées sur tout le bloc, pas étape par étape, pour que `x` garde sa couleur
 * d'une étape à l'autre. Le conteneur garde une hauteur minimale tant qu'il est affiché : les blocs
 * suivants ne sautent pas quand une ligne apparaît ou disparaît en cours de frappe.
 */
export function LikeTermsHelp({ steps, theme }: { steps: readonly Pick<EquationStep, 'left' | 'right'>[]; theme: Theme }) {
  const parsed = steps.map(step => ({ left: colorTerms(step.left), right: colorTerms(step.right) }))
  const colors = assignTermColors(parsed.flatMap(p => [...p.left, ...p.right]).map(segment => segment.group), theme)
  const worthShowing = parsed.filter(p => [...p.left, ...p.right].filter(segment => segment.group !== null).length >= 2)
  return (
    <div data-like-terms-help aria-hidden style={{ marginTop: 6, minHeight: 28, fontSize: 14, pointerEvents: 'none' }}>
      {worthShowing.map((p, index) => (
        <div
          key={index}
          data-like-terms-line
          style={{ padding: '2px 0' }}
          // Sûr : KaTeX échappe ce qu'il émet et `renderMathToHtml` passe `trust: false` (même usage que `Formula`).
          dangerouslySetInnerHTML={{ __html: renderMathToHtml(`${coloredLatex(p.left, colors)} = ${coloredLatex(p.right, colors)}`) }}
        />
      ))}
    </div>
  )
}
