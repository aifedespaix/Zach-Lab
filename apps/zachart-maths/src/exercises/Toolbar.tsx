import { Button } from '@suite/shared/ui'
import type { BlockType } from './blocks'
import { ACTIONS, SYMBOL_FAMILIES, borderOf, toneOf } from './toolbarCatalog'

interface ToolbarProps {
  /** `false` tant qu'aucun champ n'a pris le curseur : les signes n'ont nulle part où aller. */
  canInsert: boolean
  onSymbol: (glyph: string) => void
  onAddBlock: (type: BlockType) => void
}

// Un clic sur la barre ne doit pas retirer le curseur du champ visé, sinon on ne sait plus où écrire.
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

/** La barre d'outils verticale de la zone de travail, une couleur par famille. */
export function Toolbar({ canInsert, onSymbol, onAddBlock }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Outils"
      aria-orientation="vertical"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 84, flexShrink: 0, overflowY: 'auto', padding: 8, borderRight: '1px solid var(--border)' }}
    >
      {SYMBOL_FAMILIES.map(family => (
        <div key={family.name} role="group" aria-label={family.name} style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: 4, borderRadius: 8, background: toneOf(family.hue) }}>
          {family.symbols.map(({ glyph, label }) => (
            <Button
              key={glyph}
              variant="outline"
              size="icon-sm"
              aria-label={label}
              title={label}
              disabled={!canInsert}
              onMouseDown={keepFocus}
              onClick={() => onSymbol(glyph)}
              style={{ borderColor: borderOf(family.hue) }}
            >
              {glyph}
            </Button>
          ))}
        </div>
      ))}

      <div role="group" aria-label={ACTIONS.name} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4, borderRadius: 8, background: toneOf(ACTIONS.hue) }}>
        {ACTIONS.actions.map(({ type, label }) => (
          <Button
            key={type}
            variant="outline"
            size="xs"
            aria-label={`Ajouter un bloc ${label}`}
            onMouseDown={keepFocus}
            onClick={() => onAddBlock(type)}
            style={{ borderColor: borderOf(ACTIONS.hue) }}
          >
            + {label}
          </Button>
        ))}
      </div>
    </div>
  )
}
