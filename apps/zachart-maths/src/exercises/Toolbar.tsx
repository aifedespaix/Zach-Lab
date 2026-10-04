import { Button } from '@suite/shared/ui'
import { SYMBOL_FAMILIES, borderOf, toneOf, type SymbolEntry } from './toolbarCatalog'

/** Où atterrira un signe : nulle part, dans un champ de texte, dans MathLive, ou dans le champ LaTeX brut. */
export type InsertTarget = 'none' | 'text' | 'math' | 'raw'

interface ToolbarProps {
  /** Le champ visé ; `none` tant qu'aucun n'a pris le curseur. */
  target: InsertTarget
  onSymbol: (symbol: SymbolEntry) => void
}

// Un clic sur la barre ne doit pas retirer le curseur du champ visé, sinon on ne sait plus où écrire.
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

/** La barre d'outils verticale de la zone de travail, sur deux colonnes, une couleur par famille. */
export function Toolbar({ target, onSymbol }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Outils"
      aria-orientation="vertical"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 82, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'auto', padding: 6, borderRight: '1px solid var(--border)' }}
    >
      {SYMBOL_FAMILIES.map(family => (
        <div key={family.name} role="group" aria-label={family.name} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', justifyItems: 'center', gap: 2, padding: 3, borderRadius: 6, background: toneOf(family.hue) }}>
          {family.symbols.map(symbol => (
            <Button
              key={symbol.glyph}
              variant="outline"
              size="icon-sm"
              aria-label={symbol.label}
              title={symbol.label}
              disabled={target === 'none' || (target === 'text' && symbol.mathOnly === true)}
              onMouseDown={keepFocus}
              onClick={() => onSymbol(symbol)}
              style={{ borderColor: borderOf(family.hue), width: 26, height: 26, fontSize: 13 }}
            >
              {symbol.glyph}
            </Button>
          ))}
        </div>
      ))}
    </div>
  )
}
