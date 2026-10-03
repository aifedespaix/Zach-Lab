import { LinesBlockField } from '@suite/shared/equation'
import type { CalcBlock } from './blocks'
import type { SubBlockContext } from './EquationEditor'

/** Le bloc Calcul : une liste de lignes (sous-blocs), chacune un champ de formule. */
export function CalcEditor({ block, onChange, ctx }: { block: CalcBlock; onChange: (patch: Partial<CalcBlock>) => void; ctx: SubBlockContext }) {
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
      ref={ctx.edge}
    />
  )
}
