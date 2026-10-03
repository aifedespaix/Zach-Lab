import { create } from 'zustand'
import type { ExerciseFs } from './fsPort'
import * as library from './library'
import { splitPath } from './names'
import type { ChapterNode } from './types'

interface ExerciseStore {
  fs: ExerciseFs | null
  tree: ChapterNode[]
  loaded: boolean
  /** Chemin de l'exercice affiché dans la zone centrale. */
  selected: string | null
  /** Dernier échec d'une opération sur disque, à montrer à l'élève. */
  error: string | null

  init(fs: ExerciseFs): Promise<void>
  /** Relit l'arbre (ex. après un changement de titre fait dans l'éditeur). */
  refresh(): Promise<void>
  select(path: string | null): void
  dismissError(): void
  addChapter(name: string): Promise<void>
  renameChapter(chapter: string, name: string): Promise<void>
  removeChapter(chapter: string): Promise<void>
  moveChapter(chapter: string, delta: -1 | 1): Promise<void>
  addExercise(chapter: string, titre: string): Promise<void>
  renameExercise(path: string, titre: string): Promise<void>
  removeExercise(path: string): Promise<void>
  /** Copie le fichier juste après lui et sélectionne la copie. */
  duplicateExercise(path: string): Promise<void>
  /** `index` absent : à la fin du chapitre ; `delta` : un cran vers le haut ou le bas. */
  moveExercise(path: string, toChapter: string, index?: number): Promise<void>
  shiftExercise(path: string, delta: -1 | 1): Promise<void>
}

export const useExerciseStore = create<ExerciseStore>((set, get) => {
  /** Lance une opération disque, relit l'arbre ensuite, et transforme l'échec en message. */
  async function run<T>(operation: (fs: ExerciseFs) => Promise<T>): Promise<T | undefined> {
    const { fs } = get()
    if (fs === null) return undefined
    try {
      const result = await operation(fs)
      set({ tree: await library.loadTree(fs), error: null })
      return result
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      return undefined
    }
  }

  return {
    fs: null,
    tree: [],
    loaded: false,
    selected: null,
    error: null,

    async init(fs) {
      set({ fs, selected: null, error: null })
      await run(async () => {})
      set({ loaded: true })
    },
    refresh: () => run(async () => {}),
    select: path => set({ selected: path }),
    dismissError: () => set({ error: null }),

    async addChapter(name) {
      await run(fs => library.createChapter(fs, name))
    },
    async renameChapter(chapter, name) {
      const renamed = await run(fs => library.renameChapter(fs, chapter, name))
      const { selected } = get()
      if (renamed !== undefined && selected !== null && splitPath(selected)[0] === chapter) {
        set({ selected: `${renamed}/${splitPath(selected)[1]}` })
      }
    },
    async removeChapter(chapter) {
      await run(fs => library.deleteChapter(fs, chapter))
      const { selected } = get()
      if (selected !== null && splitPath(selected)[0] === chapter) set({ selected: null })
    },
    async moveChapter(chapter, delta) {
      const names = get().tree.map(c => c.name)
      const to = names.indexOf(chapter) + delta
      if (to < 0 || to >= names.length) return
      await run(fs => library.moveChapter(fs, chapter, to))
    },

    async addExercise(chapter, titre) {
      const path = await run(fs => library.createExercise(fs, chapter, titre))
      if (path !== undefined) set({ selected: path })
    },
    async renameExercise(path, titre) {
      await run(fs => library.renameExercise(fs, path, titre))
    },
    async removeExercise(path) {
      await run(fs => library.deleteExercise(fs, path))
      if (get().selected === path) set({ selected: null })
    },
    async duplicateExercise(path) {
      const copy = await run(fs => library.duplicateExercise(fs, path))
      if (copy !== undefined) set({ selected: copy })
    },
    async moveExercise(path, toChapter, index) {
      const moved = await run(fs => library.moveExercise(fs, path, toChapter, index))
      if (moved !== undefined && get().selected === path) set({ selected: moved })
    },
    async shiftExercise(path, delta) {
      const [chapter] = splitPath(path)
      const paths = get().tree.find(c => c.name === chapter)?.exercises.map(e => e.path) ?? []
      const to = paths.indexOf(path) + delta
      if (to < 0 || to >= paths.length) return
      await get().moveExercise(path, chapter, to)
    },
  }
})
