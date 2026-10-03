import { useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useOpenExercise } from './useOpenExercise'

/** La liste des exercices de la fiche ouverte, sous l'arbre des fichiers de la sidebar gauche. */
export function SheetOutline() {
  const sheet = useOpenExercise(s => s.sheet)
  const currentId = useOpenExercise(s => s.currentId)
  const [open, setOpen] = useState(true)
  if (sheet === null) return null

  return (
    <section
      aria-label="Exercices de la fiche"
      style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: '45%', minHeight: 0, borderTop: '1px solid var(--border)' }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Exercices de la fiche
      </button>
      {open && (
        <ul style={{ margin: 0, padding: '0 0 8px', listStyle: 'none', overflowY: 'auto' }}>
          {sheet.exercices.map((exercise, i) => {
            const label = exercise.numero.trim() === '' ? String(i + 1) : exercise.numero
            const firstLine = exercise.enonce.split('\n')[0].trim()
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  aria-label={`Exercice ${label}`}
                  aria-current={exercise.id === currentId ? 'true' : undefined}
                  onClick={() => useOpenExercise.getState().goTo(exercise.id)}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[13px] hover:bg-accent aria-[current=true]:bg-accent"
                >
                  <strong style={{ minWidth: 20 }}>{label}</strong>
                  {exercise.page.trim() !== '' && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>p.{exercise.page}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>
                    {firstLine}
                  </span>
                  {exercise.reponse.trim() !== '' && <Check size={14} aria-label="Réponse remplie" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
