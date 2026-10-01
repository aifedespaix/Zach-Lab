/**
 * Ce dont la bibliothèque d'exercices a besoin du disque. Les chemins sont
 * relatifs à la racine ; l'adaptateur Tauri (`tauriFs.ts`) les résout, et les
 * tests utilisent une version en mémoire.
 */
export interface DirEntry {
  name: string
  isDirectory: boolean
}

export interface ExerciseFs {
  /** Crée le dossier (et ses parents) s'il manque. `''` désigne la racine. */
  mkdir(path: string): Promise<void>
  readDir(path: string): Promise<DirEntry[]>
  readText(path: string): Promise<string>
  /** Écrit sans jamais laisser un fichier à moitié écrit. */
  writeText(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  /** Supprime un fichier, ou un dossier avec tout son contenu. */
  remove(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
}
