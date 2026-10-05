import type { ExerciseFs } from './fsPort'
import { EXERCISE_EXT, ORDER_FILE, joinPath, safeName, splitPath, uniqueName } from './names'
import { countToCorrect } from './sheet'
import { newSheet, validateSheet, type ChapterNode, type ExerciseEntry, type Sheet } from './types'

/** Demandé par l'élève : un nom qui ne donne aucun nom de fichier utilisable. */
export class InvalidNameError extends Error {
  constructor() {
    super("Ce nom n'est pas utilisable (vide, ou commençant par « . » ou « _ »).")
  }
}

async function readOrder(fs: ExerciseFs, dir: string): Promise<string[]> {
  const path = joinPath(dir, ORDER_FILE)
  try {
    if (!(await fs.exists(path))) return []
    const raw: unknown = JSON.parse(await fs.readText(path))
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : []
  } catch {
    // Un fichier d'ordre abîmé ne doit pas cacher les exercices : on retombe sur l'ordre alphabétique.
    return []
  }
}

async function writeOrder(fs: ExerciseFs, dir: string, names: string[]) {
  await fs.writeText(joinPath(dir, ORDER_FILE), JSON.stringify(names))
}

/** Trie `names` selon `order` ; ce qui n'y figure pas suit, par ordre alphabétique. */
function sortByOrder(names: string[], order: string[]): string[] {
  const rank = new Map(order.map((n, i) => [n, i]))
  return [...names].sort((a, b) => {
    const ra = rank.get(a) ?? Infinity
    const rb = rank.get(b) ?? Infinity
    return ra === rb ? a.localeCompare(b, 'fr') : ra - rb
  })
}

/** Dossiers de la racine (les chapitres) dans l'ordre choisi par l'élève. */
async function chapterNames(fs: ExerciseFs): Promise<string[]> {
  const entries = await fs.readDir('')
  return sortByOrder(entries.filter(e => e.isDirectory && !e.name.startsWith('.')).map(e => e.name), await readOrder(fs, ''))
}

async function exerciseFiles(fs: ExerciseFs, chapter: string): Promise<string[]> {
  const entries = await fs.readDir(chapter)
  const files = entries.filter(e => !e.isDirectory && e.name.endsWith(EXERCISE_EXT) && e.name !== ORDER_FILE)
  return sortByOrder(files.map(e => e.name), await readOrder(fs, chapter))
}

export async function readSheet(fs: ExerciseFs, path: string): Promise<Sheet | null> {
  try {
    return validateSheet(JSON.parse(await fs.readText(path)))
  } catch {
    return null
  }
}

export async function saveSheet(fs: ExerciseFs, path: string, sheet: Sheet): Promise<void> {
  await fs.writeText(path, JSON.stringify(sheet, null, 2))
}

/** Lit toute l'arborescence : chapitres, puis leurs exercices. */
export async function loadTree(fs: ExerciseFs): Promise<ChapterNode[]> {
  await fs.mkdir('')
  const tree: ChapterNode[] = []
  for (const name of await chapterNames(fs)) {
    const exercises: ExerciseEntry[] = []
    for (const file of await exerciseFiles(fs, name)) {
      const path = joinPath(name, file)
      const sheet = await readSheet(fs, path)
      exercises.push({
        path,
        titre: sheet?.titre ?? file.slice(0, -EXERCISE_EXT.length),
        exercices: sheet?.exercices.length ?? 0,
        aCorriger: sheet === null ? 0 : countToCorrect(sheet),
        corrompu: sheet === null,
      })
    }
    tree.push({ name, exercises })
  }
  return tree
}

export async function createChapter(fs: ExerciseFs, requested: string): Promise<string> {
  const base = safeName(requested)
  if (base === null) throw new InvalidNameError()
  const name = uniqueName(base, await chapterNames(fs))
  await fs.mkdir(name)
  await writeOrder(fs, '', [...(await chapterNames(fs)).filter(n => n !== name), name])
  return name
}

export async function renameChapter(fs: ExerciseFs, chapter: string, requested: string): Promise<string> {
  const base = safeName(requested)
  if (base === null) throw new InvalidNameError()
  const others = (await chapterNames(fs)).filter(n => n !== chapter)
  const name = uniqueName(base, others)
  if (name === chapter) return chapter
  const order = await chapterNames(fs)
  await fs.rename(chapter, name)
  await writeOrder(fs, '', order.map(n => (n === chapter ? name : n)))
  return name
}

export async function deleteChapter(fs: ExerciseFs, chapter: string): Promise<void> {
  await fs.remove(chapter)
  await writeOrder(fs, '', (await chapterNames(fs)).filter(n => n !== chapter))
}

/** Crée un exercice vide dans `chapter` et retourne son chemin. */
export async function createExercise(fs: ExerciseFs, chapter: string, requestedTitle: string): Promise<string> {
  const base = safeName(requestedTitle)
  if (base === null) throw new InvalidNameError()
  const files = await exerciseFiles(fs, chapter)
  const stem = uniqueName(base, files.map(f => f.slice(0, -EXERCISE_EXT.length)))
  const path = joinPath(chapter, stem + EXERCISE_EXT)
  await saveSheet(fs, path, newSheet(requestedTitle.trim()))
  await writeOrder(fs, chapter, [...files, stem + EXERCISE_EXT])
  return path
}

/** Change le titre affiché ; le nom du fichier reste, pour ne casser aucun lien. */
export async function renameExercise(fs: ExerciseFs, path: string, titre: string): Promise<void> {
  const trimmed = titre.trim()
  if (trimmed === '') throw new InvalidNameError()
  const sheet = await readSheet(fs, path)
  if (sheet === null) throw new Error("Cet exercice est illisible, il ne peut pas être renommé.")
  await saveSheet(fs, path, { ...sheet, titre: trimmed })
}

export async function deleteExercise(fs: ExerciseFs, path: string): Promise<void> {
  const [chapter, file] = splitPath(path)
  await fs.remove(path)
  await writeOrder(fs, chapter, (await exerciseFiles(fs, chapter)).filter(f => f !== file))
}

/**
 * Copie un fichier juste après l'original : titre et fichier « … (copie) », avec de nouveaux
 * identifiants (la fiche et ses exercices) pour que rien ne soit partagé avec l'original.
 * Retourne le chemin de la copie.
 */
export async function duplicateExercise(fs: ExerciseFs, path: string): Promise<string> {
  const sheet = await readSheet(fs, path)
  if (sheet === null) throw new Error("Cet exercice est illisible, il ne peut pas être dupliqué.")
  const [chapter, file] = splitPath(path)
  const files = await exerciseFiles(fs, chapter)
  const stems = files.map(f => f.slice(0, -EXERCISE_EXT.length))
  const stem = uniqueName(`${file.slice(0, -EXERCISE_EXT.length)} (copie)`, stems)
  const copyFile = stem + EXERCISE_EXT
  const copy: Sheet = {
    ...sheet,
    id: crypto.randomUUID(),
    titre: `${sheet.titre} (copie)`,
    exercices: sheet.exercices.map(e => ({ ...e, id: crypto.randomUUID() })),
  }
  await saveSheet(fs, joinPath(chapter, copyFile), copy)
  const order = files.filter(f => f !== copyFile)
  order.splice(files.indexOf(file) + 1, 0, copyFile)
  await writeOrder(fs, chapter, order)
  return joinPath(chapter, copyFile)
}

/**
 * Déplace un exercice dans `toChapter`, à la position `index` (à la fin par défaut),
 * y compris au sein du même chapitre. Retourne son nouveau chemin.
 */
export async function moveExercise(fs: ExerciseFs, path: string, toChapter: string, index?: number): Promise<string> {
  const [fromChapter, file] = splitPath(path)
  const target = await exerciseFiles(fs, toChapter)
  let newFile = file
  if (fromChapter !== toChapter) {
    const stem = uniqueName(file.slice(0, -EXERCISE_EXT.length), target.map(f => f.slice(0, -EXERCISE_EXT.length)))
    newFile = stem + EXERCISE_EXT
    await fs.rename(path, joinPath(toChapter, newFile))
    await writeOrder(fs, fromChapter, (await exerciseFiles(fs, fromChapter)).filter(f => f !== file))
  }
  const order = (await exerciseFiles(fs, toChapter)).filter(f => f !== newFile)
  order.splice(index ?? order.length, 0, newFile)
  await writeOrder(fs, toChapter, order)
  return joinPath(toChapter, newFile)
}

/** Déplace un chapitre à la position `index` parmi les chapitres. */
export async function moveChapter(fs: ExerciseFs, chapter: string, index: number): Promise<void> {
  const order = (await chapterNames(fs)).filter(n => n !== chapter)
  order.splice(index, 0, chapter)
  await writeOrder(fs, '', order)
}
