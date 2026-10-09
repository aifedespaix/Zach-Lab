/**
 * Ce que les tests (et l'aperçu hors Tauri) ont besoin d'un disque. Les chemins
 * sont relatifs à une racine virtuelle ; `''` désigne la racine.
 *
 * Même forme que `ExerciseFs` de Zach'Math : quand le lot L2 déplacera la
 * persistance, l'interface réelle prendra la place de celle-ci.
 */
export interface DirEntry {
  name: string
  isDirectory: boolean
}

export interface Fs {
  /** Crée le dossier (et ses parents) s'il manque. */
  mkdir(path: string): Promise<void>
  readDir(path: string): Promise<DirEntry[]>
  readText(path: string): Promise<string>
  writeText(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  /** Supprime un fichier, ou un dossier avec tout son contenu. */
  remove(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
}

/** Disque en mémoire. `files` est exposé pour que les tests lisent ce qui a été écrit. */
export function createMemoryFs(initial: Record<string, string> = {}): Fs & { files: Map<string, string> } {
  const files = new Map(Object.entries(initial))
  const dirs = new Set<string>([''])
  const addParents = (path: string) => {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
  }
  for (const path of files.keys()) addParents(path)

  const under = (dir: string, path: string) => (dir === '' ? path !== '' : path.startsWith(dir + '/'))

  return {
    files,
    async mkdir(path) {
      if (path === '') return
      addParents(path + '/x')
      dirs.add(path)
    },
    async readDir(path) {
      if (!dirs.has(path)) throw new Error(`Dossier introuvable : ${path}`)
      const prefix = path === '' ? '' : path + '/'
      const entries = new Map<string, DirEntry>()
      for (const p of [...files.keys(), ...dirs]) {
        if (!p.startsWith(prefix) || p === path) continue
        const [name, ...rest] = p.slice(prefix.length).split('/')
        entries.set(name, { name, isDirectory: rest.length > 0 || dirs.has(prefix + name) })
      }
      return [...entries.values()]
    },
    async readText(path) {
      const text = files.get(path)
      if (text === undefined) throw new Error(`Fichier introuvable : ${path}`)
      return text
    },
    async writeText(path, content) {
      addParents(path)
      files.set(path, content)
    },
    async exists(path) {
      return files.has(path) || dirs.has(path)
    },
    async remove(path) {
      files.delete(path)
      for (const p of [...files.keys()]) if (under(path, p)) files.delete(p)
      for (const d of [...dirs]) if (d === path || under(path, d)) dirs.delete(d)
    },
    async rename(from, to) {
      if (files.has(from)) {
        files.set(to, files.get(from)!)
        files.delete(from)
        addParents(to)
        return
      }
      for (const p of [...files.keys()]) {
        if (under(from, p)) {
          files.set(to + p.slice(from.length), files.get(p)!)
          files.delete(p)
        }
      }
      for (const d of [...dirs]) {
        if (d === from || under(from, d)) {
          dirs.delete(d)
          dirs.add(to + d.slice(from.length))
        }
      }
      addParents(to + '/x')
    },
  }
}
