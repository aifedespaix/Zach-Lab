import { useState } from 'react'
import { EquationStepsField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'
import { useResolvedTheme } from '@suite/shared/theme'
import type { EquationBlock } from './blocks'
import { LikeTermsHelp } from './LikeTermsHelp'
import { toPlain, withIds } from './stepIds'
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
 * Sous le champ, tant que le bloc a le focus et que la coloration est active, `LikeTermsHelp`
 * recompose les étapes en lecture seule avec les termes semblables de la même couleur. Le champ
 * lui-même n'est pas touché : l'aide ne passe jamais par `onChange`.
 */
export function EquationEditor({ block, onChange, ctx }: { block: EquationBlock; onChange: (patch: Partial<EquationBlock>) => void; ctx: SubBlockContext }) {
  const colorEnabled = useUnitColors(state => state.enabled)
  const theme = useResolvedTheme()
  const [focused, setFocused] = useState(false)
  return (
    <div
      data-like-terms-root
      onFocusCapture={() => setFocused(true)}
      // Le focus qui passe d'un champ à l'autre du bloc (Tab, flèches) fait un `blur` dont la cible
      // suivante est encore dans le bloc : l'aide ne doit ni disparaître ni clignoter.
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
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
      {colorEnabled && focused && <LikeTermsHelp steps={block.etapes} theme={theme} />}
    </div>
  )
}
