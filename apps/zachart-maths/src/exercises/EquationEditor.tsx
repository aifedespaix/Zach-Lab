import { useContext, useMemo } from 'react'
import { EquationStepsField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'
import { useResolvedTheme } from '@suite/shared/theme'
import type { EquationBlock } from './blocks'
import { UnitHuesContext } from './HighlightedTextarea'
import { latexQuantityHighlights } from './latexQuantities'
import { toPlain, withIds } from './stepIds'
import { termHighlighter } from './termHighlight'
import { useUnitColors } from './useUnitColors'

export interface SubBlockContext {
  /** Numéro du bloc dans la pile (0-based), pour les libellés d'accessibilité. */
  index: number
  /** Ctrl/Cmd(+Maj)+Entrée : un bloc juste après. */
  onEnterBlock: (place: BlockPlace) => void
  /** Retour arrière dans l'unique sous-bloc vide d'un bloc vide : le bloc disparaît vers le précédent. */
  onDeleteEmpty: () => void
  /** Suppr en fin de l'unique sous-bloc vide d'un bloc vide : le bloc disparaît vers le suivant. */
  onDeleteForward: () => void
  /** Une flèche qui sort du bloc, par le haut (`before`) ou le bas (`after`). */
  onExitBlock: (side: 'before' | 'after') => void
  onFieldChange: (handle: MathFieldHandle | null) => void
  /** Pour qu'on puisse ENTRER dans ce bloc au clavier depuis un voisin. */
  edge: React.Ref<BlockEdgeHandle>
}

/**
 * Le bloc Équation : l'éditeur partagé avec Mentale (`@suite/shared/equation`), branché sur les
 * étapes de Maths. Le moteur ne connaît pas les ids ; `withIds` les rend après chaque changement.
 *
 * Quand la coloration est active, les termes semblables (`3x` et `5x`, les constantes) prennent la même couleur
 * DANS les champs (`highlight`) : MathLive peint le fond des termes, la valeur de l'élève n'est jamais modifiée.
 * Les grandeurs (`16 km`, écrites `16\text{ km}` en LaTeX) y prennent aussi la teinte de leur unité, la même que dans l'énoncé.
 */
export function EquationEditor({ block, onChange, ctx }: { block: EquationBlock; onChange: (patch: Partial<EquationBlock>) => void; ctx: SubBlockContext }) {
  const colorEnabled = useUnitColors(state => state.enabled)
  const theme = useResolvedTheme()
  const hues = useContext(UnitHuesContext)
  const highlight = useMemo(() => {
    if (!colorEnabled) return undefined
    const terms = termHighlighter(block.etapes, theme)
    // Les grandeurs (`16\text{ km}`) passent APRÈS les termes : MathLive peint dans l'ordre, la teinte de l'unité l'emporte.
    return (latex: string, where: { step: number; side: 'left' | 'right' }) => [...terms(latex, where), ...latexQuantityHighlights(latex, hues, theme)]
  }, [colorEnabled, block.etapes, theme, hues])
  return (
    <EquationStepsField
      steps={toPlain(block.etapes)}
      onChange={next => onChange({ etapes: withIds(block.etapes, next) })}
      index={ctx.index}
      onEnterBlock={ctx.onEnterBlock}
      onDeleteEmpty={ctx.onDeleteEmpty}
      onDeleteForward={ctx.onDeleteForward}
      onExitBlock={ctx.onExitBlock}
      onFieldChange={ctx.onFieldChange}
      highlight={highlight}
      ref={ctx.edge}
    />
  )
}
