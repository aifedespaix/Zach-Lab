import { useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@suite/shared/ui'
import { MathField, type MathFieldHandle } from '../math/MathField'
import type { EquationBlock } from './blocks'
import { addStepAfter, patchStep, removeStep } from './equation'

/**
 * Le bloc Équation : une résolution écrite ligne à ligne. Entre deux lignes, un champ pour
 * l'action qui mène de l'une à l'autre (« − 5 des deux côtés »), comme sur une copie.
 */
export function EquationEditor({ block, onChange }: { block: EquationBlock; onChange: (patch: Partial<EquationBlock>) => void }) {
  const { etapes } = block
  const fields = useRef(new Map<string, MathFieldHandle>())
  // L'étape à focaliser une fois rendue : son champ n'existe pas encore au moment du clic.
  const pendingFocus = useRef<string | null>(null)

  const setSteps = (next: typeof etapes) => onChange({ etapes: next })
  // Appelé après chaque rendu : l'étape qu'on vient d'ajouter a son champ à ce moment-là.
  useEffect(() => {
    const id = pendingFocus.current
    if (id === null) return
    pendingFocus.current = null
    fields.current.get(id)?.focus()
  })

  const addAfter = (index: number) => {
    const { steps, added } = addStepAfter(etapes, index)
    pendingFocus.current = added.id
    setSteps(steps)
  }
  const remove = (index: number) => {
    // Le curseur retourne sur l'étape d'au-dessus, là où l'élève écrivait juste avant.
    pendingFocus.current = (etapes[index - 1] ?? etapes[index + 1])?.id ?? null
    setSteps(removeStep(etapes, etapes[index].id))
  }

  return (
    <ol aria-label="Étapes de la résolution" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {etapes.map((step, i) => (
        <li key={step.id}>
          {i > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0 2px 16px', borderLeft: '3px solid var(--border)', paddingLeft: 8 }}>
              <input
                aria-label={`Action avant l'étape ${i + 1}`}
                placeholder="Ce que je fais : ex. − 5 des deux côtés"
                value={step.action}
                onChange={e => setSteps(patchStep(etapes, step.id, { action: e.target.value }))}
                className="flex-1 rounded border bg-background px-2 py-1 text-sm italic"
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MathField
                ref={handle => {
                  if (handle === null) fields.current.delete(step.id)
                  else fields.current.set(step.id, handle)
                }}
                latex={step.latex}
                ariaLabel={`Étape ${i + 1}`}
                onChange={latex => setSteps(patchStep(etapes, step.id, { latex }))}
                onEnter={() => addAfter(i)}
                onBackspaceWhenEmpty={etapes.length > 1 ? () => remove(i) : undefined}
              />
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`Supprimer l'étape ${i + 1}`} disabled={etapes.length <= 1} onClick={() => remove(i)}>
              <X />
            </Button>
          </div>
        </li>
      ))}
      <li>
        <Button variant="outline" size="xs" onClick={() => addAfter(etapes.length - 1)}>
          <Plus />Étape
        </Button>
      </li>
    </ol>
  )
}
