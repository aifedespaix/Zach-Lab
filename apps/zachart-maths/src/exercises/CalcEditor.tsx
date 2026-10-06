import { useContext, useMemo } from 'react'
import { LinesBlockField } from '@suite/shared/equation'
import { useResolvedTheme } from '@suite/shared/theme'
import type { CalcBlock } from './blocks'
import type { SubBlockContext } from './EquationEditor'
import { UnitHuesContext } from './HighlightedTextarea'
import { latexQuantityHighlights } from './latexQuantities'
import { useUnitColors } from './useUnitColors'

/**
 * Le bloc Calcul : une liste de lignes (sous-blocs), chacune un champ de formule.
 *
 * Quand la coloration est active, les grandeurs (`16\text{ km}`) y prennent la teinte de leur unité, la même
 * que dans l'énoncé, et une inconnue seule (`x`) a la sienne : peintes DANS les champs, la valeur n'est jamais modifiée.
 */
export function CalcEditor({ block, onChange, ctx }: { block: CalcBlock; onChange: (patch: Partial<CalcBlock>) => void; ctx: SubBlockContext }) {
  const colorEnabled = useUnitColors(state => state.enabled)
  const hues = useContext(UnitHuesContext)
  const theme = useResolvedTheme()
  const highlight = useMemo(
    () => (colorEnabled ? (latex: string) => latexQuantityHighlights(latex, hues, theme, true) : undefined),
    [colorEnabled, hues, theme],
  )
  return (
    <LinesBlockField
      lines={block.lignes}
      onChange={lignes => onChange({ lignes })}
      ariaLabel="Calcul"
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
