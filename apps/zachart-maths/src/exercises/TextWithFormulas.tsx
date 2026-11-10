import { useContext, useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { InlineMathText, hasInlineMath, loadMathLive, type InlineTextElement } from '@suite/shared/equation'
import { HighlightedTextarea, UnitHuesContext } from './HighlightedTextarea'
import { findQuantities } from './quantities'
import { infoToneOf } from './toolbarCatalog'
import { useUnitColors } from './useUnitColors'

/** La barre de symboles demande une formule à un champ de texte encore « simple » (`<textarea>`) : il passe en éditeur à formules. */
export const FORMULA_EVENT = 'insert-formula'
export interface FormulaRequest { rich?: string }

interface TextWithFormulasProps {
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  id?: string
  placeholder?: string
  rows?: number
  className?: string
  ref?: Ref<HTMLElement>
}

/**
 * Un texte libre (énoncé, bloc texte, réponse) où l'on peut glisser des formules (fractions, vecteurs, arcs…) au milieu des phrases.
 *
 * Tant qu'il n'y a aucune formule, c'est le `<textarea>` d'avant (orthographe, couleurs des unités, tout ce que les tests et les
 * élèves connaissent). Dès qu'une formule apparaît — par la barre de symboles, ou en tapant `$x$` — il devient `InlineMathText`, où
 * chaque formule est un vrai champ MathLive dans la phrase. Il redevient un `<textarea>` quand on le quitte sans formule.
 * La valeur est la même chaîne dans les deux cas (les formules y sont entre `$`).
 */
export function TextWithFormulas({ value, onValueChange, ariaLabel, id, placeholder, rows, className, ref }: TextWithFormulasProps) {
  const [sticky, setSticky] = useState(false)
  const richMode = sticky || hasInlineMath(value)
  /** Le curseur du `<textarea>` au moment de la bascule, pour le retrouver dans l'éditeur. */
  const carry = useRef<number | null>(null)
  /** La formule demandée par la barre de symboles, à poser dès que l'éditeur est monté. */
  const pending = useRef<{ from: number; to: number; rich?: string } | null>(null)
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const editor = useRef<InlineTextElement | null>(null)

  const hues = useContext(UnitHuesContext)
  const unitColors = useUnitColors(state => state.enabled)
  const markers = useMemo(
    () => unitColors
      ? (text: string) => findQuantities(text).flatMap(q => {
          const hue = hues.get(q.unit)
          return hue === undefined ? [] : [{ start: q.start, end: q.end, color: infoToneOf(hue) }]
        })
      : undefined,
    [unitColors, hues],
  )

  const forward = (node: HTMLElement | null) => {
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  useEffect(() => {
    const field = textarea.current
    if (richMode || field === null) return
    const onRequest = (event: Event) => {
      pending.current = { from: field.selectionStart, to: field.selectionEnd, rich: (event as CustomEvent<FormulaRequest>).detail?.rich }
      carry.current = null
      // On attend MathLive : monté avant lui, l'éditeur reconstruirait ses pastilles (et perdrait le focus) à son arrivée.
      void loadMathLive().then(() => setSticky(true))
    }
    field.addEventListener(FORMULA_EVENT, onRequest)
    return () => field.removeEventListener(FORMULA_EVENT, onRequest)
  }, [richMode])

  // L'éditeur vient d'être monté (ses effets ont tourné) : la formule demandée s'y pose, autour de la sélection d'avant.
  useEffect(() => {
    const request = pending.current
    const root = editor.current
    if (!richMode || request === null || root === null) return
    pending.current = null
    root.selectValue(request.from, request.to)
    void root.insertFormula(request.rich)
  }, [richMode])

  if (!richMode) {
    return (
      <HighlightedTextarea
        ref={node => { textarea.current = node; forward(node) }}
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        rows={rows}
        value={value}
        data-formula-field=""
        // MathLive pèse lourd : on le charge dès qu'un champ de texte est utilisé, pour que la première formule apparaisse sans attente.
        onFocus={() => void loadMathLive()}
        onChange={event => {
          const next = event.target.value
          if (hasInlineMath(next)) {
            carry.current = event.target.selectionStart
            setSticky(true)
          }
          onValueChange(next)
        }}
        className={className}
      />
    )
  }
  return (
    <InlineMathText
      ref={node => { editor.current = node; forward(node) }}
      id={id}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      rows={rows}
      value={value}
      onChange={onValueChange}
      initialCaret={carry.current}
      markers={markers}
      className={className}
      onBlur={event => {
        const next = event.relatedTarget
        if (!hasInlineMath(value) && !(next instanceof Node && event.currentTarget.contains(next))) setSticky(false)
      }}
    />
  )
}
