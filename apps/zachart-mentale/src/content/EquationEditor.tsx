import type { CardBlock } from '../types/cardBlock'
import { EquationStepsField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'

export interface EquationBlockFieldProps {
  block: Extract<CardBlock, { kind: 'equation' }>
  index: number
  onChange: (block: CardBlock) => void
  /** Ctrl/Cmd+Entrée (`outside`, après le groupe) ou Ctrl/Cmd+Maj+Entrée (`inside`, dans le groupe). */
  onEnterBlock: (place: BlockPlace) => void
  /** Retour arrière tout en début du bloc, quand il est vide : il demande à disparaître vers le précédent. */
  onDeleteEmpty: () => void
  /** Suppr tout en fin du bloc, quand il est vide : il demande à disparaître vers le suivant. */
  onDeleteForward: () => void
  /** Une flèche qui sort du bloc par le haut/gauche (`before`) ou le bas/droite (`after`). */
  onExitBlock: (side: 'before' | 'after') => void
  /** Le champ vivant du membre focalisé, pour les touches du bandeau de symboles. */
  onFieldChange: (handle: MathFieldHandle | null) => void
  ref?: React.Ref<BlockEdgeHandle>
}

/** L'éditeur d'un bloc équation de Mentale : l'éditeur partagé (`@suite/shared/equation`), branché sur le `CardBlock`. */
export function EquationBlockField({ block, onChange, ...rest }: EquationBlockFieldProps) {
  return (
    <EquationStepsField
      steps={block.steps}
      onChange={steps => onChange({ kind: 'equation', steps, ...(block.standalone === true ? { standalone: true } : {}) })}
      {...rest}
    />
  )
}
