import { useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@suite/shared/ui'
import { equationStepIsSolved, navigate, operationVisible, type EqColumn, type EqField } from '@suite/shared/math'
import { MathField } from '../math/MathField'
import type { EdgeMove } from '../math/edgeMove'
import type { EquationBlock } from './blocks'
import { addStepAfter, patchStep, removeStep } from './equation'
import { BOX, LEFT_TONE, RIGHT_TONE, SOLVED_TONE } from './eqTones'

type At = 'start' | 'end'
type Focusable = { focus: (at?: At) => void }
const keyOf = (id: string, field: EqField) => `${id}:${field}`

/**
 * Le bloc Équation, comme dans Mentale : deux membres par étape, l'opération écrite entre deux
 * étapes, et la ligne qui passe au vert quand la variable est isolée.
 *
 * Clavier : les flèches sortent d'un champ au bord (`navigate` donne la cible) ; Tab suit l'ordre
 * du DOM, qui EST l'ordre de lecture ; Entrée ajoute une étape ; Retour arrière dans un membre
 * vide revient au membre précédent, puis supprime l'étape quand elle est entièrement vide.
 */
export function EquationEditor({ block, onChange }: { block: EquationBlock; onChange: (patch: Partial<EquationBlock>) => void }) {
  const { etapes } = block
  const fields = useRef(new Map<string, Focusable>())
  const column = useRef<EqColumn>('left')
  // La cible à focaliser une fois rendue : le champ d'une étape qu'on vient d'ajouter n'existe pas encore.
  const pending = useRef<{ id: string; field: EqField; at?: At } | null>(null)

  const setSteps = (next: typeof etapes) => onChange({ etapes: next })
  // Appelé après chaque rendu : l'étape qu'on vient d'ajouter a son champ à ce moment-là.
  useEffect(() => {
    const target = pending.current
    if (target === null) return
    pending.current = null
    fields.current.get(keyOf(target.id, target.field))?.focus(target.at)
  })

  const addAfter = (index: number) => {
    const { steps, added } = addStepAfter(etapes, index)
    pending.current = { id: added.id, field: 'left' }
    setSteps(steps)
  }
  const remove = (index: number) => {
    // Le curseur retourne sur l'étape d'au-dessus, là où l'élève écrivait juste avant.
    const previous = etapes[index - 1] ?? etapes[index + 1]
    pending.current = previous === undefined ? null : { id: previous.id, field: 'left', at: 'end' }
    setSteps(removeStep(etapes, etapes[index].id))
  }
  const go = (step: number, field: EqField, move: EdgeMove) => {
    const target = navigate(etapes, { step, field }, move, column.current)
    if (typeof target === 'string') return // sortie du bloc : on ne piège pas le clavier
    fields.current.get(keyOf(etapes[target.pos.step].id, target.pos.field))?.focus(target.at)
  }
  const register = (id: string, field: EqField) => (handle: Focusable | null) => {
    if (handle === null) fields.current.delete(keyOf(id, field))
    else fields.current.set(keyOf(id, field), handle)
  }

  const member = (i: number, field: 'left' | 'right') => {
    const step = etapes[i]
    const other = field === 'left' ? step.right : step.left
    return (
      <MathField
        ref={register(step.id, field)}
        latex={step[field]}
        ariaLabel={`Membre ${field === 'left' ? 'gauche' : 'droit'} de l'étape ${i + 1}`}
        onChange={latex => setSteps(patchStep(etapes, step.id, { [field]: latex }))}
        onEnter={() => addAfter(i)}
        onNavigate={move => go(i, field, move)}
        onBackspaceWhenEmpty={() => {
          if (field === 'right') fields.current.get(keyOf(step.id, 'left'))?.focus('end')
          else if (other === '' && etapes.length > 1) remove(i)
        }}
      />
    )
  }

  return (
    <ol aria-label="Étapes de la résolution" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {etapes.map((step, i) => {
        const solved = equationStepIsSolved(etapes, i)
        return (
          <li key={step.id}>
            <div
              role="group"
              aria-label={`Étape ${i + 1}`}
              data-solved={solved}
              onFocusCapture={e => {
                const label = (e.target as HTMLElement).getAttribute('aria-label') ?? ''
                if (label.startsWith('Membre gauche')) column.current = 'left'
                else if (label.startsWith('Membre droit')) column.current = 'right'
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, ...(solved ? { ...BOX, ...SOLVED_TONE } : {}) }}
            >
              <div style={{ flex: 1, minWidth: 0, ...(solved ? {} : { ...BOX, ...LEFT_TONE }) }}>{member(i, 'left')}</div>
              <span aria-hidden>=</span>
              <div style={{ flex: 1, minWidth: 0, ...(solved ? {} : { ...BOX, ...RIGHT_TONE }) }}>{member(i, 'right')}</div>
              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer l'étape ${i + 1}`} disabled={etapes.length <= 1} onClick={() => remove(i)}><X /></Button>
            </div>
            {operationVisible(etapes, i) && (
              <input
                ref={el => register(step.id, 'operation')(el === null ? null : {
                  focus: at => {
                    el.focus()
                    const n = at === 'end' ? el.value.length : 0
                    el.setSelectionRange(n, n)
                  },
                })}
                aria-label={`Opération après l'étape ${i + 1}`}
                placeholder="Ce que je fais : ex. − 5 des deux côtés"
                value={step.operation}
                onChange={e => setSteps(patchStep(etapes, step.id, { operation: e.target.value }))}
                onKeyDown={e => {
                  if (e.nativeEvent.isComposing || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
                  const el = e.currentTarget
                  const collapsed = el.selectionStart === el.selectionEnd
                  if (e.key === 'Enter') { e.preventDefault(); addAfter(i) }
                  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); go(i, 'operation', e.key === 'ArrowUp' ? 'up' : 'down') }
                  else if (e.key === 'ArrowLeft' && collapsed && el.selectionStart === 0) { e.preventDefault(); go(i, 'operation', 'left') }
                  else if (e.key === 'ArrowRight' && collapsed && el.selectionStart === el.value.length) { e.preventDefault(); go(i, 'operation', 'right') }
                }}
                className="mt-1 ml-4 w-[calc(100%-1rem)] rounded border bg-background px-2 py-1 text-sm italic"
              />
            )}
          </li>
        )
      })}
      <li>
        <Button variant="outline" size="xs" onClick={() => addAfter(etapes.length - 1)}><Plus />Étape</Button>
      </li>
    </ol>
  )
}
