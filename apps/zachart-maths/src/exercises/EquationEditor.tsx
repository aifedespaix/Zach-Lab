import { EquationStepsField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'
import type { EquationBlock } from './blocks'
import { toPlain, withIds } from './stepIds'

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
 */
export function EquationEditor({ block, onChange, ctx }: { block: EquationBlock; onChange: (patch: Partial<EquationBlock>) => void; ctx: SubBlockContext }) {
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
      ref={ctx.edge}
    />
  )
}
