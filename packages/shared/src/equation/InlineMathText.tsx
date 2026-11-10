import { useEffect, useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type Ref } from 'react'
import { isMathLiveLoaded, loadMathLive, type MathfieldElement } from './MathFieldEditor'
import {
  caretBeside, hasRawFormula, insertChipAtCaret, isChip, insertTextAtCaret, placeCaret, positionAt, rangeIn, readValue, renderValue, valueOffsetOf, ZWSP,
} from './inlineText'

/** Un morceau de texte à surligner (décalages dans le nœud texte), par exemple une grandeur et son unité. */
export interface TextMarker { start: number; end: number; color: string }

/** L'élément de l'éditeur, avec ce que la barre de symboles de l'application sait lui demander. */
export interface InlineTextElement extends HTMLDivElement {
  /** Une formule au curseur ; `rich` suit la syntaxe de `MathfieldElement.insert` (`#0` : la sélection, `#?` : le trou suivant). Sans `rich` : une pastille vide. */
  insertFormula(rich?: string): Promise<void>
  /** Du texte simple au curseur. */
  insertText(text: string): void
  /** Sélectionne `[from, to]` (décalages dans la valeur) : un point d'entrée pour une formule qui doit entourer du texte déjà écrit. */
  selectValue(from: number, to: number): void
}

export const isInlineText = (el: unknown): el is InlineTextElement => el instanceof HTMLElement && el.dataset.inlineText !== undefined

export interface InlineMathTextProps {
  /** Le texte, formules en `$latex$`. */
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  id?: string
  placeholder?: string
  /** Hauteur minimale, en lignes. */
  rows?: number
  className?: string
  style?: React.CSSProperties
  onBlur?: (event: React.FocusEvent<HTMLDivElement>) => void
  /** Surlignages dans le texte (hors formules) : appelée sur chaque nœud texte. */
  markers?: (text: string) => readonly TextMarker[]
  /** Le curseur à poser dès le montage : décalage dans la valeur. */
  initialCaret?: number | null
  ref?: Ref<InlineTextElement>
}

/**
 * MathLive ne déplace le focus DOM qu'après ~60 ms ; le focus natif de l'hôte est synchrone. Les deux, comme `MathFieldEditor`.
 */
function focusNow(field: MathfieldElement): void {
  field.focus()
  if (document.activeElement !== field) HTMLElement.prototype.focus.call(field, { preventScroll: true })
}

let highlightCounter = 0

/**
 * Un texte où les formules s'écrivent en place : le texte est éditable tel quel, chaque `$latex$` devient un vrai champ de
 * formule (MathLive) au milieu de la phrase. La valeur reste une simple chaîne avec des `$…$` : rien ne change dans les fichiers,
 * et un texte sans formule est identique à ce qu'écrirait un `<textarea>`.
 *
 * Le DOM de l'éditeur n'est pas produit par React (un `contenteditable` et React ne se partagent pas des enfants) : il est
 * reconstruit à partir de `value` quand celle-ci diffère de ce que l'éditeur contient (annuler, autre exercice), jamais pendant
 * la frappe. Avant que MathLive soit chargé, le texte s'affiche brut, `$` compris.
 */
export function InlineMathText({ value, onChange, ariaLabel, id, placeholder, rows = 2, className, style, onBlur, markers, initialCaret, ref }: InlineMathTextProps) {
  const rootRef = useRef<InlineTextElement | null>(null)
  const [ready, setReady] = useState(isMathLiveLoaded)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const markersRef = useRef(markers)
  markersRef.current = markers
  const renderedReady = useRef<boolean | null>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    let cancelled = false
    void loadMathLive().then(ok => { if (ok && !cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  const emit = () => {
    const root = rootRef.current
    if (root === null) return
    root.toggleAttribute('data-empty', readValue(root) === '')
    onChangeRef.current(readValue(root))
  }

  /** Une pastille : son champ de formule et les gestes qui la relient au texte autour. */
  const makeChip = (latex: string): HTMLElement => {
    const chip = document.createElement('span')
    chip.contentEditable = 'false'
    chip.dataset.chip = ''
    chip.dataset.latex = latex
    chip.className = 'inline-math-chip'
    const field = document.createElement('math-field') as MathfieldElement
    field.setAttribute('aria-label', 'Formule')
    field.setAttribute('math-virtual-keyboard-policy', 'manual')
    field.value = latex
    field.addEventListener('input', () => {
      chip.dataset.latex = field.value
      emit()
    })
    const leave = (side: 'before' | 'after') => {
      const root = rootRef.current
      if (root === null) return
      root.focus({ preventScroll: true })
      caretBeside(root, chip, side)
    }
    field.addEventListener('move-out', event => {
      const direction = (event as CustomEvent<{ direction?: string }>).detail?.direction
      if (direction === 'forward' || direction === 'downward') leave('after')
      else if (direction === 'backward' || direction === 'upward') leave('before')
      else return
      event.preventDefault()
    })
    field.addEventListener('keydown', event => {
      const key = (event as unknown as globalThis.KeyboardEvent).key
      if (key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        leave('after')
      } else if ((key === 'Backspace' || key === 'Delete') && field.value === '') {
        event.preventDefault()
        event.stopPropagation()
        const root = rootRef.current
        leave(key === 'Backspace' ? 'before' : 'after')
        chip.remove()
        if (root !== null) { renderValue(root, readValue(root), makeChip); emit() }
      }
    })
    chip.append(field)
    return chip
  }

  /** Remplace le DOM par `value`, en gardant le curseur à son décalage. */
  const rebuild = (text: string, caret: number | null) => {
    const root = rootRef.current
    if (root === null) return
    renderValue(root, text, ready || isMathLiveLoaded() ? makeChip : null)
    root.toggleAttribute('data-empty', text === '')
    if (caret !== null) {
      const at = positionAt(root, caret)
      if (at !== null) placeCaret(root, at)
    }
  }

  // Le DOM suit `value` quand elle vient d'ailleurs ; et il est refait quand MathLive arrive (les `$…$` deviennent des champs).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (root === null) return
    const first = renderedReady.current === null
    if (first || renderedReady.current !== ready || readValue(root) !== value) {
      const focused = !first && root.contains(document.activeElement)
      const selection = focused ? rangeIn(root) : null
      const caret = selection === null ? null : valueOffsetOf(root, selection.startContainer, selection.startOffset)
      renderedReady.current = ready
      rebuild(value, first ? (initialCaret ?? null) : caret)
      if (first && initialCaret !== undefined && initialCaret !== null) root.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready])

  // Les surlignages passent par l'API CSS Custom Highlight : rien n'est ajouté au DOM, donc aucun risque pour le curseur.
  useEffect(() => {
    const root = rootRef.current
    const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const HighlightClass = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight
    if (root === null || markers === undefined || highlights === undefined || HighlightClass === undefined) return
    const byColor = new Map<string, Range[]>()
    for (const node of root.childNodes) {
      if (!(node instanceof Text)) continue
      for (const marker of markers(node.data)) {
        const range = document.createRange()
        range.setStart(node, marker.start)
        range.setEnd(node, marker.end)
        byColor.set(marker.color, [...(byColor.get(marker.color) ?? []), range])
      }
    }
    const style = document.createElement('style')
    const names: string[] = []
    let index = 0
    for (const [color, ranges] of byColor) {
      const name = `imt-${uid}-${highlightCounter}-${index++}`
      names.push(name)
      highlights.set(name, new HighlightClass(...ranges))
      style.textContent += `::highlight(${name}) { background-color: ${color}; }\n`
    }
    highlightCounter++
    document.head.append(style)
    return () => {
      style.remove()
      for (const name of names) highlights.delete(name)
    }
  })

  // Ce que la barre de symboles demande à l'éditeur.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (root === null) return
    root.insertText = text => {
      insertTextAtCaret(root, text)
      emit()
    }
    root.selectValue = (from, to) => {
      const a = positionAt(root, from)
      const b = positionAt(root, to)
      const selection = document.getSelection()
      if (a === null || b === null || selection === null) return
      root.focus({ preventScroll: true })
      const range = document.createRange()
      range.setStart(a.node, a.offset)
      range.setEnd(b.node, b.offset)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    root.insertFormula = async rich => {
      if (!isMathLiveLoaded() && !(await loadMathLive())) {
        // Pas de MathLive : la formule reste du LaTeX entre `$`.
        insertTextAtCaret(root, `$${(rich ?? '').replace(/#[0?]/g, '')}$`)
        return emit()
      }
      // Le curseur est peut-être dans une pastille : la nouvelle se met juste après elle.
      const active = document.activeElement
      const inside = [...root.querySelectorAll<HTMLElement>('[data-chip]')].find(chip => chip.contains(active))
      if (inside !== undefined) caretBeside(root, inside, 'after')
      const chip = makeChip('')
      const selected = insertChipAtCaret(root, chip)
      const field = chip.querySelector<MathfieldElement>('math-field')
      if (field === null) return
      // `insert` ne crée les champs qu'une fois l'élément monté et mis à niveau.
      await customElements.whenDefined('math-field')
      if (selected !== '') {
        field.value = selected
        field.executeCommand?.('selectAll')
      }
      focusNow(field)
      if (rich !== undefined) field.insert?.(rich, { focus: true, selectionMode: 'placeholder' } as never)
      chip.dataset.latex = field.value
      emit()
    }
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (root === null || event.target !== root || event.nativeEvent.isComposing) return
    // Une flèche au bord d'une pastille entre dans sa formule (le navigateur, lui, saute par-dessus un élément non éditable).
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const range = rangeIn(root)
      if (range !== null && range.collapsed && range.startContainer instanceof Text) {
        const text = range.startContainer
        const right = event.key === 'ArrowRight'
        const edge = right ? text.data.length : text.data.startsWith(ZWSP) ? 1 : 0
        const beyond = right ? range.startOffset >= edge - (text.data.endsWith(ZWSP) ? 1 : 0) : range.startOffset <= edge
        const chip = right ? text.nextSibling : text.previousSibling
        if (beyond && isChip(chip)) {
          const field = chip.querySelector<MathfieldElement>('math-field')
          if (field !== null) {
            event.preventDefault()
            focusNow(field)
            field.executeCommand?.(right ? 'moveToMathfieldStart' : 'moveToMathfieldEnd')
            return
          }
        }
      }
    }
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      insertTextAtCaret(root, '\n')
      emit()
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (root === null) return
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
    insertTextAtCaret(root, text)
    afterEdit()
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => event.preventDefault()

  /** Une frappe a peut-être fermé un `$…$` : il devient une pastille, le curseur juste après. */
  const afterEdit = () => {
    const root = rootRef.current
    if (root === null) return
    if (ready && hasRawFormula(root)) {
      const range = rangeIn(root)
      const caret = range === null ? null : valueOffsetOf(root, range.startContainer, range.startOffset)
      rebuild(readValue(root), caret)
    }
    emit()
  }

  return (
    <div
      ref={node => {
        rootRef.current = node as InlineTextElement | null
        if (typeof ref === 'function') ref(node as InlineTextElement | null)
        else if (ref) ref.current = node as InlineTextElement | null
      }}
      id={id}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-inline-text=""
      data-placeholder={placeholder}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      className={`inline-math-text ${className ?? ''}`}
      style={{ minHeight: `calc(${rows}lh + 0.5rem + 2px)`, ...style }}
      onInput={afterEdit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDrop={onDrop}
      onBlur={onBlur}
    />
  )
}
