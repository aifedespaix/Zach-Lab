import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { create } from 'zustand'
import { useCommand } from '@suite/shared/commands'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@suite/shared/ui'
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
  const listId = useId()
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(0)
  const query = fold(value)
  const matches = useMemo(() => chapters.filter(c => fold(c).includes(query)), [chapters, query])
  const canCreate = value.trim() !== '' && !chapters.some(c => fold(c) === query)
  const options = [...matches.map(name => ({ name, create: false })), ...(canCreate ? [{ name: value.trim(), create: true }] : [])]
  const pick = (name: string) => { onChange(name); setListOpen(false) }

  return (
    <div style={{ position: 'relative' }}>
      <input
        role="combobox"
        aria-label="Chapitre"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Choisir ou taper un chapitre…"
        value={value}
        onChange={e => { onChange(e.target.value); setListOpen(true); setActive(0) }}
        onFocus={() => setListOpen(true)}
        onBlur={() => setListOpen(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setListOpen(true); setActive(i => Math.min(i + 1, options.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter' && listOpen && options[active] !== undefined) { e.preventDefault(); pick(options[active].name) }
          // Échap ferme d'abord la liste, pas la modale.
          else if (e.key === 'Escape' && listOpen) { e.preventDefault(); e.stopPropagation(); setListOpen(false) }
        }}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      />
      {listOpen && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Chapitres"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ margin: 0, listStyle: 'none' }}
        >
          {options.map((option, i) => (
            <li
              key={`${option.create}:${option.name}`}
              role="option"
              aria-selected={i === active}
              // `mousedown` : avant que le champ ne perde le focus et ne referme la liste.
              onMouseDown={e => { e.preventDefault(); pick(option.name) }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-sm px-2 py-1.5 text-sm ${i === active ? 'bg-accent text-accent-foreground' : ''}`}
            >
              {option.create ? `Créer le chapitre « ${option.name} »` : option.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** La fenêtre « Nouvelle fiche » : un titre, un chapitre (celui du clic, ou à choisir). */
export function NewSheetDialog() {
  const { open, chapter: preset, close } = useNewSheetDialog()
  const tree = useExerciseStore(s => s.tree)
  const chapters = useMemo(() => tree.map(c => c.name), [tree])
  const [titre, setTitre] = useState('')
  const [chapter, setChapter] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  useCommand('sheet.new', () => useNewSheetDialog.getState().openFor())

  // À chaque ouverture : un formulaire neuf, le chapitre du clic ou, à défaut, celui de la fiche ouverte.
  useEffect(() => {
    if (!open) return
    const { selected } = useExerciseStore.getState()
    setTitre('')
    setChapter(preset ?? (selected !== null ? selected.split('/')[0] : (chapters.length === 1 ? chapters[0] : '')))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule l'ouverture réinitialise le formulaire
  }, [open, preset])

  const valid = titre.trim() !== '' && chapter.trim() !== ''
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const store = useExerciseStore.getState()
    const name = chapter.trim()
    const existing = chapters.find(c => fold(c) === fold(name))
    close()
    if (existing === undefined) await store.addChapter(name)
    // `addChapter` peut avoir normalisé le nom : on retrouve le chapitre réel dans l'arbre relu.
    const target = existing ?? useExerciseStore.getState().tree.find(c => fold(c.name) === fold(name))?.name
    if (target !== undefined) await store.addExercise(target, titre.trim())
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) close() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onOpenAutoFocus={e => { e.preventDefault(); titleRef.current?.focus() }}>
        <form onSubmit={submit} style={{ display: 'contents' }}>
          <DialogHeader>
            <DialogTitle>Nouvelle fiche</DialogTitle>
            <DialogDescription>
              Crée une fiche d'exercices vide dans un chapitre, puis l'ouvre. Tu peux taper un nouveau nom de chapitre pour le créer en même temps.
            </DialogDescription>
          </DialogHeader>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            Nom de la fiche
            <input
              ref={titleRef}
              aria-label="Nom de la fiche"
              placeholder="Ex. : Les fractions, p. 42"
              value={titre}
              onChange={e => setTitre(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span>Chapitre</span>
            <ChapterSelect value={chapter} onChange={setChapter} chapters={chapters} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Annuler</Button>
            <Button type="submit" disabled={!valid}>Valider</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
