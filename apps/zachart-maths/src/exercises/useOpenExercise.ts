import { create } from 'zustand'
import { readSheet, saveSheet } from './library'
import { dropExercise, insertExercise, insertExerciseAt, isBlank, moveExercise as moveInSheet, neighbour, patchExercise } from './sheet'
import type { Exercise, Sheet } from './types'
import { useExerciseStore } from './useExerciseStore'

export const AUTOSAVE_DELAY_MS = 600

type Status = 'empty' | 'loading' | 'unreadable' | 'saved' | 'dirty' | 'saving' | 'failed'

/** Les champs que l'élève modifie dans l'éditeur ; `id` et le titre de la fiche ont leurs propres actions. */
export type ExerciseEdit = Partial<Pick<Exercise, 'numero' | 'enonce' | 'page' | 'blocs' | 'blocsB' | 'reponse' | 'notes' | 'corrige' | 'corrigeLe' | 'rate'>>

interface OpenExerciseStore {
  path: string | null
  /** La fiche entière : c'est elle qui est lue et écrite. */
  sheet: Sheet | null
  /** L'exercice affiché dans la fiche. */
  currentId: string | null
  /** L'exercice affiché, dérivé de `sheet` et `currentId` et gardé à jour pour ses lecteurs. */
  exercise: Exercise | null
  status: Status
  edit(patch: ExerciseEdit): void
  editTitle(titre: string): void
  /** Affiche un autre exercice de la fiche ; sans effet si `id` n'y est pas. */
  goTo(id: string): void
  /** Voisin ; au bord, crée un exercice (avant ou après), sauf si l'exercice affiché est vierge. */
  step(delta: -1 | 1): void
  /** Ajoute un exercice vierge à la fin et l'affiche. */
  addExercise(): void
  /** Retire l'exercice affiché ; sans effet sur le seul exercice de la fiche. */
  removeCurrent(): void
  /** Déplace un exercice de la fiche d'un cran ; l'exercice affiché ne change pas. */
  reorder(id: string, delta: -1 | 1): void
  /** Un exercice vierge avant ou après `id` ; il devient l'exercice affiché. */
  insertAt(id: string, where: 'before' | 'after'): void
  /** Retire `id` ; l'exercice affiché ne change que s'il s'agissait de lui. */
  removeById(id: string): void
  /** Écrit tout de suite ce qui attend (changement de fichier, fermeture). */
  flush(): Promise<void>
}

let timer: ReturnType<typeof setTimeout> | undefined
/** Chaque ouverture prend un numéro : une lecture lente d'un fichier déjà quitté est ignorée. */
let generation = 0
/** L'exercice à afficher quand la fiche en cours d'ouverture sera lue (un saut depuis une autre fiche). */
let pendingId: string | null = null

const show = (sheet: Sheet, currentId: string) => ({
  sheet,
  currentId,
  exercise: sheet.exercices.find(e => e.id === currentId) ?? null,
})

export const useOpenExercise = create<OpenExerciseStore>((set, get) => {
  async function write() {
    clearTimeout(timer)
    const { path, sheet, status } = get()
    const fs = useExerciseStore.getState().fs
    if (path === null || sheet === null || fs === null || status !== 'dirty') return
    set({ status: 'saving' })
    try {
      await saveSheet(fs, path, sheet)
      // Une frappe pendant l'écriture a remis l'état à « dirty » : ne pas l'écraser.
      if (get().path === path && get().status === 'saving') set({ status: 'saved' })
      if (get().path === path) void useExerciseStore.getState().refresh()
    } catch {
      if (get().path === path) set({ status: 'failed' })
    }
  }

  /** Une modification de la fiche : à l'écran tout de suite, sur le disque après le délai. */
  function change(sheet: Sheet, currentId: string) {
    set({ ...show(sheet, currentId), status: 'dirty' })
    clearTimeout(timer)
    timer = setTimeout(() => void write(), AUTOSAVE_DELAY_MS)
  }

  return {
    path: null,
    sheet: null,
    currentId: null,
    exercise: null,
    status: 'empty',

    edit(patch) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null) return
      change(patchExercise(sheet, currentId, patch), currentId)
    },
    editTitle(titre) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null) return
      change({ ...sheet, titre }, currentId)
    },
    goTo(id) {
      const { sheet } = get()
      if (sheet === null || !sheet.exercices.some(e => e.id === id)) return
      set(show(sheet, id))
    },
    step(delta) {
      const { sheet, currentId, exercise } = get()
      if (sheet === null || currentId === null || exercise === null) return
      const next = neighbour(sheet, currentId, delta)
      if (next !== null) return set(show(sheet, next))
      // Au bord : un nouvel exercice, mais pas par-dessus un exercice encore vierge.
      if (isBlank(exercise)) return
      const grown = insertExercise(sheet, delta < 0 ? 'start' : 'end')
      change(grown.sheet, grown.added.id)
    },
    addExercise() {
      const { sheet } = get()
      if (sheet === null) return
      const grown = insertExercise(sheet, 'end')
      change(grown.sheet, grown.added.id)
    },
    removeCurrent() {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null || sheet.exercices.length <= 1) return
      const dropped = dropExercise(sheet, currentId)
      change(dropped.sheet, dropped.focus)
    },
    reorder(id, delta) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null) return
      const moved = moveInSheet(sheet, id, delta)
      if (moved !== sheet) change(moved, currentId)
    },
    insertAt(id, where) {
      const { sheet } = get()
      if (sheet === null) return
      const grown = insertExerciseAt(sheet, id, where)
      change(grown.sheet, grown.added.id)
    },
    removeById(id) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null || sheet.exercices.length <= 1) return
      const dropped = dropExercise(sheet, id)
      if (dropped.sheet === sheet) return
      change(dropped.sheet, id === currentId ? dropped.focus : currentId)
    },
    flush: write,
  }
})

const closed = { path: null, sheet: null, currentId: null, exercise: null, status: 'empty' } as const

/** Ouvre `path` (ou ferme si `null`) après avoir écrit la fiche précédente. */
async function open(path: string | null) {
  const mine = ++generation
  await useOpenExercise.getState().flush()
  if (mine !== generation) return
  if (path === null) return void useOpenExercise.setState(closed)

  useOpenExercise.setState({ path, sheet: null, currentId: null, exercise: null, status: 'loading' })
  const fs = useExerciseStore.getState().fs
  const sheet = fs === null ? null : await readSheet(fs, path)
  if (mine !== generation) return
  const wanted = pendingId
  pendingId = null
  const first = sheet?.exercices.find(e => e.id === wanted)?.id ?? sheet?.exercices[0].id
  useOpenExercise.setState(sheet === null || first === undefined ? { status: 'unreadable' } : { ...show(sheet, first), status: 'saved' })
}

/** Ouvre la fiche `path` directement sur l'exercice `exerciseId`. */
export function goToExercise(path: string, exerciseId: string) {
  if (useOpenExercise.getState().path === path && useOpenExercise.getState().sheet !== null) {
    useExerciseStore.getState().select(path)
    useOpenExercise.getState().goTo(exerciseId)
    return
  }
  pendingId = exerciseId
  useExerciseStore.getState().select(path)
}

// La fiche ouverte suit la sélection de l'arbre, y compris quand un renommage de chapitre ou un
// déplacement en change le chemin : dans ce cas la fiche est déjà à jour en mémoire.
useExerciseStore.subscribe((state, previous) => {
  if (state.selected === previous.selected) return
  // Même fiche, nouveau chemin : on la rattache, sans la relire (ni perdre le curseur).
  const { relocated } = state
  if (relocated !== null && relocated.from === useOpenExercise.getState().path && relocated.to === state.selected) {
    useOpenExercise.setState({ path: relocated.to })
    return
  }
  if (state.selected !== null && state.selected === useOpenExercise.getState().path) return
  void open(state.selected)
})
