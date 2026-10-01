import { create } from 'zustand'
import { readExercise, saveExercise } from './library'
import type { Exercise } from './types'
import { useExerciseStore } from './useExerciseStore'

export const AUTOSAVE_DELAY_MS = 600

type Status = 'empty' | 'loading' | 'unreadable' | 'saved' | 'dirty' | 'saving' | 'failed'

/** Les champs que l'élève modifie dans l'éditeur ; `id` et `version` ne bougent pas. */
export type ExerciseEdit = Partial<Pick<Exercise, 'titre' | 'question' | 'page' | 'blocs' | 'reponse'>>

interface OpenExerciseStore {
  path: string | null
  exercise: Exercise | null
  status: Status
  edit(patch: ExerciseEdit): void
  /** Écrit tout de suite ce qui attend (changement d'exercice, fermeture). */
  flush(): Promise<void>
}

let timer: ReturnType<typeof setTimeout> | undefined
/** Chaque ouverture prend un numéro : une lecture lente d'un exercice déjà quitté est ignorée. */
let generation = 0

export const useOpenExercise = create<OpenExerciseStore>((set, get) => {
  async function write() {
    clearTimeout(timer)
    const { path, exercise, status } = get()
    const fs = useExerciseStore.getState().fs
    if (path === null || exercise === null || fs === null || status !== 'dirty') return
    set({ status: 'saving' })
    try {
      await saveExercise(fs, path, exercise)
      // Une frappe pendant l'écriture a remis l'état à « dirty » : ne pas l'écraser.
      if (get().path === path && get().status === 'saving') set({ status: 'saved' })
      if (get().path === path) void useExerciseStore.getState().refresh()
    } catch {
      if (get().path === path) set({ status: 'failed' })
    }
  }

  return {
    path: null,
    exercise: null,
    status: 'empty',

    edit(patch) {
      const { exercise } = get()
      if (exercise === null) return
      set({ exercise: { ...exercise, ...patch }, status: 'dirty' })
      clearTimeout(timer)
      timer = setTimeout(() => void write(), AUTOSAVE_DELAY_MS)
    },
    flush: write,
  }
})

/** Ouvre `path` (ou ferme si `null`) après avoir écrit l'exercice précédent. */
async function open(path: string | null) {
  const mine = ++generation
  await useOpenExercise.getState().flush()
  if (mine !== generation) return
  if (path === null) return void useOpenExercise.setState({ path: null, exercise: null, status: 'empty' })

  useOpenExercise.setState({ path, exercise: null, status: 'loading' })
  const fs = useExerciseStore.getState().fs
  const exercise = fs === null ? null : await readExercise(fs, path)
  if (mine !== generation) return
  useOpenExercise.setState(exercise === null ? { status: 'unreadable' } : { exercise, status: 'saved' })
}

// L'exercice ouvert suit la sélection de l'arbre, y compris quand un renommage de chapitre ou un
// déplacement en change le chemin : dans ce cas l'exercice est déjà à jour en mémoire.
useExerciseStore.subscribe((state, previous) => {
  if (state.selected === previous.selected) return
  if (state.selected !== null && state.selected === useOpenExercise.getState().path) return
  void open(state.selected)
})
