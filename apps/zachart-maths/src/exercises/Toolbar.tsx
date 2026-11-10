import { SquareFunction } from 'lucide-react'
import { Button, Hint } from '@suite/shared/ui'
import { SYMBOL_FAMILIES, borderOf, toneOf, type SymbolEntry } from './toolbarCatalog'
import { useToolbarFamilies } from './useToolbarFamilies'

/**
 * Où atterrira un signe : nulle part, dans une case de tableau (texte simple), dans un texte qui accepte des formules (`rich`),
 * dans MathLive, ou dans le champ LaTeX brut.
 */
export type InsertTarget = 'none' | 'text' | 'rich' | 'math' | 'raw'

interface ToolbarProps {
  /** Le champ visé ; `none` tant qu'aucun n'a pris le curseur. */
  target: InsertTarget
  onSymbol: (symbol: SymbolEntry) => void
  /** Ajoute un champ de formule dans le texte, à l'endroit du curseur. */
  onFormula: () => void
  /** Le curseur est dans un texte qui accepte des formules (ou dans l'une d'elles). */
  canFormula: boolean
}

// Un clic sur la barre ne doit pas retirer le curseur du champ visé, sinon on ne sait plus où écrire.
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

/** La barre d'outils verticale de la zone de travail, sur deux colonnes, une couleur par famille. */
export function Toolbar({ target, onSymbol, onFormula, canFormula }: ToolbarProps) {
  const hidden = useToolbarFamilies(state => state.hidden)
  return (
    <div
      role="toolbar"
      aria-label="Outils"
      aria-orientation="vertical"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 82, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'auto', padding: 6, borderRight: '1px solid var(--border)' }}
    >
      {/* À part du reste : ce n'est pas un signe mais un champ de formule posé dans la phrase. */}
      <div role="group" aria-label="Formule dans le texte" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 3px', borderRadius: 6, border: '1px dashed var(--border)' }}>
        <Hint label="Ajouter un champ de formule dans le texte">
          <span style={{ display: 'inline-flex' }}>
            <Button variant="outline" size="sm" aria-label="Formule dans le texte" disabled={!canFormula} onMouseDown={keepFocus} onClick={onFormula} style={{ width: 70, height: 26, gap: 3, fontSize: 11 }}>
              <SquareFunction size={14} />Formule
            </Button>
          </span>
        </Hint>
      </div>
      {SYMBOL_FAMILIES.filter(family => !hidden.includes(family.name)).map(family => (
        <div key={family.name} role="group" aria-label={family.name} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', justifyItems: 'center', gap: 2, padding: 3, borderRadius: 6, background: toneOf(family.hue) }}>
          {family.symbols.map(symbol => (
            <Hint key={symbol.glyph} label={symbol.label}>
              {/* Un bouton désactivé ne reçoit aucun événement de pointeur : l'enveloppe porte l'infobulle. */}
              <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={symbol.label}
                  disabled={target === 'none' || (target === 'text' && symbol.mathOnly === true)}
                  onMouseDown={keepFocus}
                  onClick={() => onSymbol(symbol)}
                  style={{ borderColor: borderOf(family.hue), width: 26, height: 26, fontSize: 13 }}
                >
                  {symbol.glyph}
                </Button>
              </span>
            </Hint>
          ))}
        </div>
      ))}
    </div>
  )
}
