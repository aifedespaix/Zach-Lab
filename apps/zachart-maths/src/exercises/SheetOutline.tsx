import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, CornerDownRight, CornerUpRight, Trash2 } from 'lucide-react'
import {
  ConfirmDialog, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@suite/shared/ui'
import { useOpenExercise } from './useOpenExercise'

/** La liste des exercices de la fiche ouverte, sous l'arbre des fichiers de la sidebar gauche. */
export function SheetOutline() {
  const sheet = useOpenExercise(s => s.sheet)
  const currentId = useOpenExercise(s => s.currentId)
  const [open, setOpen] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  if (sheet === null) return null
  const actions = useOpenExercise.getState()

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
                <ContextMenu>
                  <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={`Exercice ${label}`}
                      aria-current={exercise.id === currentId ? 'true' : undefined}
                      onClick={() => actions.goTo(exercise.id)}
                      className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[13px] hover:bg-accent aria-[current=true]:bg-accent"
                    >
                      <strong style={{ minWidth: 20 }}>{label}</strong>
                      {exercise.page.trim() !== '' && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>p.{exercise.page}</span>}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>
                        {firstLine}
                      </span>
                      {exercise.reponse.trim() !== '' && <Check size={14} aria-label="Réponse remplie" />}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => actions.goTo(exercise.id)}>Aller à cet exercice</ContextMenuItem>
                    <ContextMenuItem disabled={i === 0} onSelect={() => actions.reorder(exercise.id, -1)}><ArrowUp /> Monter</ContextMenuItem>
                    <ContextMenuItem disabled={i === sheet.exercices.length - 1} onSelect={() => actions.reorder(exercise.id, 1)}>
                      <ArrowDown /> Descendre
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => actions.insertAt(exercise.id, 'before')}><CornerUpRight /> Nouvel exercice avant</ContextMenuItem>
                    <ContextMenuItem onSelect={() => actions.insertAt(exercise.id, 'after')}><CornerDownRight /> Nouvel exercice après</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" disabled={sheet.exercices.length <= 1} onSelect={() => setDeleting(exercise.id)}>
                      <Trash2 /> Supprimer
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer cet exercice ?"
        description={`L'exercice sera effacé de la fiche « ${sheet.titre} ». Cette action est définitive.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting !== null) useOpenExercise.getState().removeById(deleting)
          setDeleting(null)
        }}
      />
    </section>
  )
}
