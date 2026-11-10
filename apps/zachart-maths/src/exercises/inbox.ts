import { ensureInbox, INBOX_PATH, readSheet, saveSheet, createChapter, createExercise, chapterNames } from './library'
import { insertExercise, isBlank } from './sheet'
import { goToExercise, useOpenExercise } from './useOpenExercise'
import { useExerciseStore } from './useExerciseStore'

const fail = (e: unknown) => useExerciseStore.setState({ error: e instanceof Error ? e.message : String(e) })

/**
 * Un exercice tout de suite, sans nom ni chapitre : il tombe à la fin de la fiche « Non classé », qui s'ouvre dessus.
 * Un exercice vierge qui traîne déjà en bout de fiche est réutilisé au lieu d'en empiler un autre.
 */
export async function addQuickExercise(): Promise<void> {
  const store = useExerciseStore.getState()
  const fs = store.fs
  if (fs === null) return
  const open = useOpenExercise.getState()
  // La fiche est déjà ouverte : sa copie en mémoire fait foi (elle peut avoir des frappes pas encore écrites).
  if (open.path === INBOX_PATH && open.sheet !== null) {
    const last = open.sheet.exercices[open.sheet.exercices.length - 1]
    return last !== undefined && isBlank(last) ? open.goTo(last.id) : open.addExercise()
  }
  try {
    await ensureInbox(fs)
    const sheet = await readSheet(fs, INBOX_PATH)
    if (sheet === null) throw new Error('La fiche « Non classé » est illisible.')
    const last = sheet.exercices[sheet.exercices.length - 1]
    if (last !== undefined && isBlank(last)) {
      await store.refresh()
      return goToExercise(INBOX_PATH, last.id)
    }
    const grown = insertExercise(sheet, 'end')
    await saveSheet(fs, INBOX_PATH, grown.sheet)
    await store.refresh()
    goToExercise(INBOX_PATH, grown.added.id)
  } catch (e) {
    fail(e)
  }
}

/** Où va l'exercice : une fiche qui existe, ou une fiche toute neuve (dans un chapitre qui peut l'être aussi). */
export type MoveTarget = { kind: 'existing'; path: string } | { kind: 'new'; chapter: string; titre: string }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * Sort l'exercice `exerciseId` de la fiche ouverte et le met à la fin de la fiche visée. La cible est écrite
 * AVANT que la source soit modifiée : en cas d'échec, l'exercice n'est jamais perdu. Retourne le chemin de la cible.
 */
export async function moveExerciseToSheet(exerciseId: string, target: MoveTarget): Promise<string | undefined> {
  const store = useExerciseStore.getState()
  const open = useOpenExercise.getState()
  const fs = store.fs
  const exercise = open.sheet?.exercices.find(e => e.id === exerciseId)
  if (fs === null || open.path === null || exercise === undefined) return undefined
  try {
    let path: string
    let existing: typeof exercise[] = []
    if (target.kind === 'existing') {
      if (target.path === open.path) return undefined
      path = target.path
      const sheet = await readSheet(fs, path)
      if (sheet === null) throw new Error('La fiche visée est illisible.')
      // Une fiche qui n'a qu'un exercice vierge (elle vient d'être créée) le cède à l'exercice déplacé.
      existing = sheet.exercices.length === 1 && isBlank(sheet.exercices[0]) ? [] : sheet.exercices
    } else {
      const known = (await chapterNames(fs)).find(c => fold(c) === fold(target.chapter))
      const chapter = known ?? (await createChapter(fs, target.chapter))
      path = await createExercise(fs, chapter, target.titre)
    }
    const sheet = await readSheet(fs, path)
    if (sheet === null) throw new Error('La fiche visée est illisible.')
    await saveSheet(fs, path, { ...sheet, exercices: [...existing, exercise] })
    useOpenExercise.getState().takeOut(exerciseId)
    await useOpenExercise.getState().flush()
    await store.refresh()
    return path
  } catch (e) {
    fail(e)
    return undefined
  }
}
