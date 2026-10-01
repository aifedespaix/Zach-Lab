import { documentDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs'
import type { ExerciseFs } from './fsPort'

/** Dossier où vivent les exercices de l'élève, dans ses Documents. */
export const EXERCISES_FOLDER = "Zachar't Maths"

/** Adaptateur Tauri : tous les chemins de la bibliothèque sont résolus sous `root`. */
export function createTauriFs(root: string): ExerciseFs {
  const abs = (path: string) => (path === '' ? Promise.resolve(root) : join(root, ...path.split('/')))
  return {
    async mkdir(path) {
      const full = await abs(path)
      if (!(await exists(full))) await mkdir(full, { recursive: true })
    },
    async readDir(path) {
      return (await readDir(await abs(path))).map(e => ({ name: e.name, isDirectory: e.isDirectory }))
    },
    readText: async path => readTextFile(await abs(path)),
    async writeText(path, content) {
      // Écriture dans un fichier voisin puis renommage : un crash ne laisse jamais un JSON tronqué.
      const full = await abs(path)
      const tmp = `${full}.tmp`
      await writeTextFile(tmp, content)
      await rename(tmp, full)
    },
    exists: async path => exists(await abs(path)),
    remove: async path => remove(await abs(path), { recursive: true }),
    rename: async (from, to) => rename(await abs(from), await abs(to)),
  }
}

export async function defaultExercisesRoot(): Promise<string> {
  return join(await documentDir(), EXERCISES_FOLDER)
}
