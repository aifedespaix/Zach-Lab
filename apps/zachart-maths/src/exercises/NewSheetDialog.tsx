import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { useCommand } from '@suite/shared/commands'
import { NewFileDialog } from '@suite/shared/files'
import { ComboboxSelect } from '@suite/shared/ui'
import { useExerciseStore } from './useExerciseStore'

interface NewSheetDialogState {
  open: boolean
  /** Chapitre pré-rempli (le clic vient d'un chapitre) ; `null` : à choisir. */
  chapter: string | null
  openFor(chapter?: string | null): void
  close(): void
}

export const useNewSheetDialog = create<NewSheetDialogState>(set => ({
  open: false,
  chapter: null,
  openFor: chapter => set({ open: true, chapter: chapter ?? null }),
  close: () => set({ open: false }),
}))

/** Sans accents ni majuscules : « geometrie » trouve « Géométrie ». */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * Le chapitre d'une fiche : un champ qui filtre la liste des chapitres existants à la frappe.
 * Un nom qui n'existe pas encore est proposé comme nouveau chapitre.
 */
function ChapterSelect({ value, onChange, chapters }: { value: string; onChange: (v: string) => void; chapters: string[] }) {
  const options = useMemo(() => chapters.map(name => ({ value: name, label: name })), [chapters])
  const creatable = useMemo(() => ({ label: (name: string) => `Créer le chapitre « ${name} »`, toValue: (name: string) => name }), [])
  return (
    <ComboboxSelect
      ariaLabel="Chapitre"
      placeholder="Choisir ou taper un chapitre…"
      emptyText="Aucun chapitre"
      options={options}
      value={value}
      onChange={onChange}
      creatable={creatable}
    />
  )
}

/** La fenêtre « Nouvelle fiche » : un titre, un chapitre (celui du clic, ou à choisir). */
export function NewSheetDialog() {
  const { open, chapter: preset, close } = useNewSheetDialog()
  const tree = useExerciseStore(s => s.tree)
  const chapters = useMemo(() => tree.map(c => c.name), [tree])
  const [chapter, setChapter] = useState('')
  useCommand('sheet.new', () => useNewSheetDialog.getState().openFor())

  // À chaque ouverture : le chapitre du clic ou, à défaut, celui de la fiche ouverte.
  useEffect(() => {
    if (!open) return
    const { selected } = useExerciseStore.getState()
    setChapter(preset ?? (selected !== null ? selected.split('/')[0] : (chapters.length === 1 ? chapters[0] : '')))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule l'ouverture réinitialise le chapitre
  }, [open, preset])

  const submit = async (titre: string) => {
    const store = useExerciseStore.getState()
    const name = chapter.trim()
    const existing = chapters.find(c => fold(c) === fold(name))
    if (existing === undefined) await store.addChapter(name)
    // `addChapter` peut avoir normalisé le nom : on retrouve le chapitre réel dans l'arbre relu.
    const target = existing ?? useExerciseStore.getState().tree.find(c => fold(c.name) === fold(name))?.name
    if (target !== undefined) await store.addExercise(target, titre)
    close()
  }

  return (
    <NewFileDialog
      open={open}
      title="Nouvelle fiche"
      description="Crée une fiche d'exercices vide dans un chapitre, puis l'ouvre. Tu peux taper un nouveau nom de chapitre pour le créer en même temps."
      nameLabel="Nom de la fiche"
      namePlaceholder="Ex. : Les fractions, p. 42"
      canCreate={chapter.trim() !== ''}
      createLabel="Valider"
      onCreate={submit}
      onCancel={close}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
        <span>Chapitre</span>
        <ChapterSelect value={chapter} onChange={setChapter} chapters={chapters} />
      </div>
    </NewFileDialog>
  )
}
