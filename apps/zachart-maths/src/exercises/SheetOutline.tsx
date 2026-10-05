import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, EyeOff, ChevronRight, CornerDownRight, CornerUpRight, Trash2 } from 'lucide-react'
import {
  ConfirmDialog, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@suite/shared/ui'
import { useCorrectionView } from './useCorrectionView'
import { useOpenExercise } from './useOpenExercise'

/** La liste des exercices de la fiche ouverte, sous l'arbre des fichiers de la sidebar gauche. */
export function SheetOutline() {
  const sheet = useOpenExercise(s => s.sheet)
  const currentId = useOpenExercise(s => s.currentId)
  const [open, setOpen] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const hideCorrected = useCorrectionView(s => s.hideCorrected)
  if (sheet === null) return null
  const actions = useOpenExercise.getState()

  return (
    <section
      aria-label="Exercices de la fiche"
      style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: '45%', minHeight: 0, borderTop: '1px solid var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 4, padding: '6px 8px', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Exercices de la fiche
        </button>
        <button
          type="button"
          aria-pressed={hideCorrected}
          aria-label="Masquer les exercices corrigés"
          title={hideCorrected ? 'Afficher les exercices corrigés' : 'Masquer les exercices corrigés'}
          onClick={() => useCorrectionView.getState().toggleHideCorrected()}
          style={{ padding: '6px 8px' }}
        >
          {hideCorrected ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {open && (
        <ul style={{ margin: 0, padding: '0 0 8px', listStyle: 'none', overflowY: 'auto' }}>
          {sheet.exercices.map((exercise, i) => {
            // Un exercice corrigé est grisé, ou caché sur demande : jamais celui qu'on est en train de lire.
            const done = exercise.corrige === true
            if (done && hideCorrected && exercise.id !== currentId) return null
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
                      data-corrige={done ? (exercise.rate === true ? 'revoir' : 'true') : undefined}
                      style={done ? { opacity: exercise.id === currentId ? 1 : 0.55 } : undefined}
                      className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[13px] hover:bg-accent aria-[current=true]:bg-primary/15 aria-[current=true]:font-semibold aria-[current=true]:shadow-[inset_3px_0_0_var(--primary)]"
                    >
                      <strong style={{ minWidth: 20 }}>{label}</strong>
                      {exercise.page.trim() !== '' && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>p.{exercise.page}</span>}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>
                        {firstLine}
                      </span>
                      {exercise.corrige === true
                        ? <Check size={14} aria-label={exercise.rate === true ? 'À revoir' : 'Corrigé'} style={{ color: exercise.rate === true ? '#f97316' : '#22c55e' }} />
                        : exercise.reponse.trim() !== '' && <Check size={14} aria-label="Réponse remplie" />}
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
