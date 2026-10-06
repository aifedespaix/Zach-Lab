import { useRef, useState } from 'react'
import { Delete } from 'lucide-react'
import { calculate } from './calculate'
import { useCalculatorStore } from './useCalculatorStore'

interface Key {
  /** Ce qu'affiche la touche. */
  label: string
  /** Ce qu'elle insère dans le calcul (le libellé par défaut). */
  insert?: string
  kind?: 'digit' | 'operator' | 'function' | 'action' | 'equals'
  name?: string
}

const CLEAR: Key = { label: 'C', kind: 'action', name: 'Tout effacer' }
const BACK: Key = { label: '⌫', kind: 'action', name: 'Effacer un caractère' }
const EQUALS: Key = { label: '=', kind: 'equals', name: 'Calculer' }

/** 5 colonnes × 5 lignes : les chiffres à gauche comme sur toute calculatrice, les opérations à droite. */
const KEYS: Key[] = [
  { label: '(', kind: 'function', name: 'Parenthèse ouvrante' }, { label: ')', kind: 'function', name: 'Parenthèse fermante' }, { label: '%', kind: 'function', name: 'Pourcentage' }, BACK, CLEAR,
  { label: '7', kind: 'digit' }, { label: '8', kind: 'digit' }, { label: '9', kind: 'digit' }, { label: '÷', kind: 'operator', name: 'Divisé par' }, { label: '√', insert: '√(', kind: 'function', name: 'Racine carrée' },
  { label: '4', kind: 'digit' }, { label: '5', kind: 'digit' }, { label: '6', kind: 'digit' }, { label: '×', kind: 'operator', name: 'Multiplié par' }, { label: 'x²', insert: '^2', kind: 'function', name: 'Au carré' },
  { label: '1', kind: 'digit' }, { label: '2', kind: 'digit' }, { label: '3', kind: 'digit' }, { label: '−', kind: 'operator', name: 'Moins' }, { label: 'π', kind: 'function', name: 'Pi' },
  { label: '0', kind: 'digit' }, { label: ',', kind: 'digit', name: 'Virgule' }, { label: 'Rép', kind: 'function', name: 'Dernier résultat' }, { label: '+', kind: 'operator', name: 'Plus' }, EQUALS,
]

const TONE: Record<NonNullable<Key['kind']>, string> = {
  digit: 'bg-background hover:bg-muted',
  function: 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
  operator: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  action: 'bg-muted/60 text-destructive hover:bg-muted',
  equals: 'bg-primary text-primary-foreground hover:bg-primary/85',
}

/**
 * La calculatrice de la sidebar droite (moitié basse) : le moteur est mathjs (`calculate.ts`), ici
 * seulement un champ et un clavier compacts. Au clavier on tape directement dans le champ
 * (Entrée = calculer, Échap = effacer) ; à la souris, les touches insèrent au curseur. Les touches
 * sortent de l'ordre de tabulation : le champ fait tout, il ne faut pas 25 tabulations pour en sortir.
 */
export function Calculator() {
  const expression = useCalculatorStore(s => s.expression)
  const history = useCalculatorStore(s => s.history)
  const { setExpression, push } = useCalculatorStore.getState()
  const input = useRef<HTMLInputElement>(null)
  /** Un Entrée sur un calcul qui ne passe pas : seulement alors on dit pourquoi (pas à chaque frappe). */
  const [failed, setFailed] = useState(false)

  const last = history[0]
  const live = calculate(expression, last?.value ?? 0)
  const message = live.ok ? `= ${live.text}` : failed || live.error === 'Calcul impossible' ? live.error : ''

  const equals = () => {
    if (live.ok) {
      setFailed(false)
      if (last?.text === expression.trim()) return // déjà le résultat affiché : rien de neuf à ranger
      push({ expression: expression.trim(), text: live.text, value: live.value })
    } else setFailed(expression.trim() !== '')
  }

  const edit = (text: string, from: number, to: number) => {
    const field = input.current
    if (field === null) return
    setFailed(false)
    setExpression(expression.slice(0, from) + text + expression.slice(to))
    const caret = from + text.length
    // Après le rendu : la valeur du champ est contrôlée, le curseur n'existe qu'une fois elle posée.
    requestAnimationFrame(() => field.setSelectionRange(caret, caret))
    field.focus()
  }

  const press = (key: Key) => {
    const field = input.current
    const start = field?.selectionStart ?? expression.length
    const end = field?.selectionEnd ?? start
    if (key === EQUALS) return equals()
    if (key === CLEAR) {
      setFailed(false)
      setExpression('')
      return field?.focus()
    }
    if (key === BACK) {
      if (start !== end) return edit('', start, end)
      return start > 0 ? edit('', start - 1, start) : field?.focus()
    }
    edit(key.insert ?? key.label, start, end)
  }

  return (
    <div data-testid="calculatrice" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 8px 8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div className="rounded border bg-background px-2 py-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <button
          type="button"
          tabIndex={-1}
          disabled={last === undefined}
          aria-label={last === undefined ? 'Aucun calcul précédent' : `Reprendre ${last.expression}`}
          onClick={() => last !== undefined && edit(last.expression, 0, expression.length)}
          style={{ minHeight: 16, textAlign: 'right', fontSize: 11, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {last === undefined ? '' : `${last.expression} = ${last.text}`}
        </button>
        <input
          ref={input}
          aria-label="Calcul"
          value={expression}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0"
          onChange={e => {
            setFailed(false)
            setExpression(e.target.value)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              equals()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setFailed(false)
              setExpression('')
            }
          }}
          style={{ width: '100%', background: 'transparent', outline: 'none', textAlign: 'right', fontSize: 18, fontVariantNumeric: 'tabular-nums' }}
        />
        <output aria-live="polite" style={{ minHeight: 16, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: live.ok ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
          {message}
        </output>
      </div>
      <div role="group" aria-label="Clavier de la calculatrice" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gridAutoRows: 'minmax(28px, 1fr)', gap: 4, flex: 1, minHeight: 140 }}>
        {KEYS.map(key => (
          <button
            key={key.label}
            type="button"
            tabIndex={-1}
            aria-label={key.name ?? key.label}
            onMouseDown={e => e.preventDefault() /* le champ garde le focus et son curseur */}
            onClick={() => press(key)}
            className={`rounded-md border text-sm font-medium transition-colors active:translate-y-px ${TONE[key.kind ?? 'digit']}`}
          >
            {key === BACK ? <Delete size={15} style={{ margin: 'auto' }} /> : key.label}
          </button>
        ))}
      </div>
    </div>
  )
}
