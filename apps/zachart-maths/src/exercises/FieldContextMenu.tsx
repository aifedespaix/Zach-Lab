import { useContext, useRef, type ReactNode } from 'react'
import { ClipboardPaste, Copy, Scissors, Sigma, TextSelect } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@suite/shared/ui'
import { insertAtCursor, isTextField } from './insertAtCursor'
import { isMathField } from '../math/MathField'
import { SymbolInsertContext } from './symbolInsert'
import { SYMBOL_FAMILIES } from './toolbarCatalog'

const editableIn = (wrapper: HTMLElement) => wrapper.querySelector<HTMLElement>('textarea, input, math-field')

/**
 * Le clic droit d'un champ : couper, copier, coller, tout sélectionner ; pour une formule, en plus
 * les structures courantes (fraction, puissance…). Il arrête l'évènement : le menu du bloc et celui
 * du vide ne s'ouvrent pas par-dessus.
 *
 * `display: contents` : le wrapper n'existe pas pour la mise en page, mais reste un nœud par lequel
 * l'évènement remonte, et c'est là qu'on retrouve le vrai champ (textarea, input ou `math-field`).
 *
 * Version propre à Zach'Math (sans correcteur orthographique ni raccourcis affichés, contrairement à
 * celle de Mentale) : les unifier est le sujet du cycle suivant.
 */
export function FieldContextMenu({ kind, children }: { kind: 'text' | 'math'; children: ReactNode }) {
  const wrapper = useRef<HTMLElement | null>(null)
  const insertSymbol = useContext(SymbolInsertContext)

  /** Redonne le focus au champ avant d'agir : Radix le rend au déclencheur en fermant le menu. */
  const withField = (run: (field: HTMLElement) => void) => {
    const field = wrapper.current === null ? null : editableIn(wrapper.current)
    if (field === null) return
    setTimeout(() => {
      field.focus()
      run(field)
    }, 0)
  }
  const paste = (field: HTMLElement) => {
    void navigator.clipboard
      .readText()
      .then(text => {
        if (text === '') return
        if (isMathField(field)) field.insert?.(text, { focus: true })
        else if (isTextField(field)) insertAtCursor(field, text)
      })
      .catch(() => {
        // Presse-papiers inaccessible : le menu n'en dit pas plus que le geste clavier.
      })
  }
  const structures = SYMBOL_FAMILIES.find(f => f.name === 'Structures')

  return (
    <ContextMenu>
      <ContextMenuTrigger
        style={{ display: 'contents' }}
        onContextMenu={e => {
          e.stopPropagation()
          wrapper.current = e.currentTarget
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('cut'))}><Scissors size={14} />Couper</ContextMenuItem>
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('copy'))}><Copy size={14} />Copier</ContextMenuItem>
        <ContextMenuItem onSelect={() => withField(paste)}><ClipboardPaste size={14} />Coller</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('selectAll'))}><TextSelect size={14} />Tout sélectionner</ContextMenuItem>
        {kind === 'math' && insertSymbol !== null && structures !== undefined && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger><Sigma size={14} />Insérer</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {structures.symbols.map(symbol => (
                  <ContextMenuItem key={symbol.label} onSelect={() => withField(() => insertSymbol(symbol))}>
                    <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{symbol.glyph}</span>
                    {symbol.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
