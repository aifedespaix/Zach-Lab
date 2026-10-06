import { useContext, useRef, useState, type ReactNode } from 'react'
import { ClipboardPaste, Copy, Scissors, Sigma, SpellCheck, TextSelect } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@suite/shared/ui'
import { caretIndexAt } from './caretAt'
import { insertAtCursor, isTextField } from './insertAtCursor'
import { isMathField } from '../math/mathFieldElement'
import { misspellingAt, type Misspelling } from './spell'
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
 * Un mot souligné en rouge sous le curseur : ses corrections (dictionnaire français, dans un worker,
 * `spell.ts`) passent en tête du menu. Le webview n'ouvre pas son propre menu : sans cela, rien à cliquer.
 *
 * Les raccourcis sont affichés à droite (indicatifs : le navigateur gère déjà ces touches).
 */
export function FieldContextMenu({ kind, extra, selectAllLabel = 'Tout sélectionner', selectAllShortcut = 'Ctrl + A', children }: {
  kind: 'text' | 'math'
  /** Le libellé de l'entrée qui sélectionne le texte du champ : une case de tableau dit « la case », pour ne pas la confondre avec le tableau. */
  selectAllLabel?: string
  selectAllShortcut?: string
  /** Des entrées propres au champ, ajoutées à la fin du menu après un séparateur. */
  extra?: ReactNode
  children: ReactNode
}) {
  const wrapper = useRef<HTMLElement | null>(null)
  const insertSymbol = useContext(SymbolInsertContext)
  /** Le mot souligné en rouge sous le curseur au moment du clic droit, avec ses corrections. */
  const [misspelling, setMisspelling] = useState<Misspelling | null>(null)

  /** Redonne le focus au champ avant d'agir : Radix le rend au déclencheur en fermant le menu. */
  const withField = (run: (field: HTMLElement) => void) => {
    const field = wrapper.current === null ? null : editableIn(wrapper.current)
    if (field === null) return
    setTimeout(() => {
      field.focus()
      run(field)
    }, 0)
  }
  /** Remplace le mot fautif par la correction choisie, sauf si le champ a changé entre-temps. */
  const correct = (found: Misspelling, replacement: string) =>
    withField(field => {
      if (!isTextField(field) || field.value.slice(found.start, found.end) !== found.word) return
      field.setSelectionRange(found.start, found.end)
      insertAtCursor(field, replacement)
    })
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
          setMisspelling(null)
          // Le mot est celui du clic, pas celui du curseur : Chromium ne déplace le curseur qu'à l'action par
          // défaut de `contextmenu`, que le menu annule. Les corrections arrivent d'un worker, le menu les
          // ajoute en haut dès qu'elles sont là.
          const target = kind === 'text' ? editableIn(e.currentTarget) : null
          if (target !== null) {
            const position = caretIndexAt(target, e.clientX, e.clientY) ?? undefined
            void misspellingAt(target, undefined, position).then(setMisspelling).catch(() => setMisspelling(null))
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {misspelling !== null && (
          <>
            {misspelling.suggestions.length === 0 && (
              <ContextMenuItem disabled><SpellCheck size={14} />Aucune suggestion pour « {misspelling.word} »</ContextMenuItem>
            )}
            {misspelling.suggestions.map(suggestion => (
              <ContextMenuItem key={suggestion} onSelect={() => correct(misspelling, suggestion)}>
                <SpellCheck size={14} /><strong>{suggestion}</strong>
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('cut'))}><Scissors size={14} />Couper<ContextMenuShortcut>Ctrl + X</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('copy'))}><Copy size={14} />Copier<ContextMenuShortcut>Ctrl + C</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuItem onSelect={() => withField(paste)}><ClipboardPaste size={14} />Coller<ContextMenuShortcut>Ctrl + V</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('selectAll'))}><TextSelect size={14} />{selectAllLabel}<ContextMenuShortcut>{selectAllShortcut}</ContextMenuShortcut></ContextMenuItem>
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
        {extra !== undefined && (
          <>
            <ContextMenuSeparator />
            {extra}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
