import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { Button, ComboboxSelect, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@suite/shared/ui'
import { moveExerciseToSheet } from './inbox'
import { ChapterSelect } from './NewSheetDialog'
import { exerciseLabel } from './sheetSort'
import { splitPath } from './names'
import { useExerciseStore } from './useExerciseStore'
import { useOpenExercise } from './useOpenExercise'

interface MoveDialogState {
  /** L'exercice à déplacer (de la fiche ouverte) ; `null` : fenêtre fermée. */
  exerciseId: string | null
  openFor(exerciseId: string): void
  close(): void
}

export const useMoveExerciseDialog = create<MoveDialogState>(set => ({
  exerciseId: null,
  openFor: exerciseId => set({ exerciseId }),
  close: () => set({ exerciseId: null }),
}))

/** La fenêtre « Déplacer vers… » : une fiche existante (recherche à la frappe) ou une fiche toute neuve. */
export function MoveExerciseDialog() {
  const { exerciseId, close } = useMoveExerciseDialog()
  const sheet = useOpenExercise(s => s.sheet)
  const currentPath = useOpenExercise(s => s.path)
  const tree = useExerciseStore(s => s.tree)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [target, setTarget] = useState('')
  const [titre, setTitre] = useState('')
  const [chapter, setChapter] = useState('')

  const exercise = sheet?.exercices.find(e => e.id === exerciseId)
  const label = exercise === undefined || sheet === null ? '' : exerciseLabel(exercise, sheet.exercices.indexOf(exercise) + 1)
  const chapters = useMemo(() => tree.map(c => c.name), [tree])
  const options = useMemo(
    () => tree.flatMap(c => c.exercises.filter(e => e.path !== currentPath && !e.corrompu).map(e => ({ value: e.path, label: e.titre, detail: `${c.name} / ${e.titre}` }))),
    [tree, currentPath],
  )

  useEffect(() => {
    if (exerciseId === null) return
    setMode('existing')
    setTarget('')
    setTitre('')
    setChapter(currentPath === null ? '' : splitPath(currentPath)[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule l'ouverture réinitialise le formulaire
  }, [exerciseId])

  const valid = mode === 'existing' ? target !== '' : titre.trim() !== '' && chapter.trim() !== ''
  const submit = async () => {
    if (exerciseId === null || !valid) return
    const move = mode === 'existing' ? { kind: 'existing' as const, path: target } : { kind: 'new' as const, chapter: chapter.trim(), titre: titre.trim() }
    close()
    await moveExerciseToSheet(exerciseId, move)
  }

  return (
    <Dialog open={exerciseId !== null} onOpenChange={o => { if (!o) close() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={e => { e.preventDefault(); void submit() }} style={{ display: 'contents' }}>
          <DialogHeader>
            <DialogTitle>Déplacer l'exercice {label}</DialogTitle>
            <DialogDescription>
              L'exercice quitte « {sheet?.titre} » avec tout son contenu (blocs, réponse, notes, état de correction) et arrive à la fin de la fiche choisie.
            </DialogDescription>
          </DialogHeader>
          <div role="group" aria-label="Destination" style={{ display: 'flex', gap: 6 }}>
            <Button type="button" size="sm" variant={mode === 'existing' ? 'default' : 'outline'} aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>
              Fiche existante
            </Button>
            <Button type="button" size="sm" variant={mode === 'new' ? 'default' : 'outline'} aria-pressed={mode === 'new'} onClick={() => setMode('new')}>
              Nouvelle fiche
            </Button>
          </div>
          {mode === 'existing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
              <span>Fiche</span>
              <ComboboxSelect ariaLabel="Fiche de destination" placeholder="Chercher une fiche ou un chapitre…" emptyText="Aucune fiche" options={options} value={target} onChange={setTarget} />
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                Nom de la nouvelle fiche
                <input
                  aria-label="Nom de la nouvelle fiche"
                  value={titre}
                  onChange={e => setTitre(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-normal"
                />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <span>Chapitre</span>
                <ChapterSelect value={chapter} onChange={setChapter} chapters={chapters} />
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Annuler</Button>
            <Button type="submit" disabled={!valid}>Déplacer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
