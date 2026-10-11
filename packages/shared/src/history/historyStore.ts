export interface HistoryOptions {
  /** Combien de pas on garde ; le plus ancien tombe en premier. */
  limit?: number
  /** Deux `commit` de même clé séparés de moins que ça ne font qu'un pas d'annulation. */
  groupMs?: number
  /** L'horloge, injectable pour les tests. */
  now?: () => number
}

export interface HistoryState<T> {
  present: T
  /** Combien de pas on peut annuler / rétablir (pour griser les boutons). */
  undoDepth: number
  redoDepth: number
}

export interface HistoryStore<T> {
  get(): HistoryState<T>
  subscribe(listener: () => void): () => void
  /** Une modification : `next` devient l'état courant, le rétablissement est vidé. */
  commit(next: T, groupKey?: string): void
  /** Revient au cliché d'avant ; renvoie le nouvel état, ou `null` s'il n'y a rien à annuler. */
  undo(): T | null
  redo(): T | null
  /** Repart de zéro sur `initial` (à chaque ouverture de fichier). */
  reset(initial: T): void
  canUndo(): boolean
  canRedo(): boolean
}

export const DEFAULT_HISTORY_LIMIT = 200
export const DEFAULT_GROUP_MS = 700

/**
 * Historique de clichés entiers (pas de différences) : chaque `commit` empile l'état d'avant.
 * Un `commit` avec la même `groupKey` que le précédent, à moins de `groupMs`, garde le cliché
 * d'avant la première frappe du groupe : une rafale de frappes ne fait qu'un pas.
 * Sans `groupKey`, chaque `commit` est un pas à lui seul (actions discrètes).
 */
export function createHistoryStore<T>(initial: T, options: HistoryOptions = {}): HistoryStore<T> {
  const { limit = DEFAULT_HISTORY_LIMIT, groupMs = DEFAULT_GROUP_MS, now = Date.now } = options
  let present = initial
  let past: T[] = []
  let future: T[] = []
  let last: { at: number; key: string } | null = null
  let snapshot: HistoryState<T> = { present, undoDepth: 0, redoDepth: 0 }
  const listeners = new Set<() => void>()

  const publish = () => {
    snapshot = { present, undoDepth: past.length, redoDepth: future.length }
    for (const listener of listeners) listener()
  }

  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    commit(next, groupKey) {
      const at = now()
      const grouped = groupKey !== undefined && last !== null && last.key === groupKey && at - last.at < groupMs
      if (!grouped) {
        past.push(present)
        if (past.length > limit) past.shift()
      }
      last = groupKey === undefined ? null : { at, key: groupKey }
      future = []
      present = next
      publish()
    },
    undo() {
      const target = past.pop()
      if (target === undefined) return null
      future.push(present)
      present = target
      last = null
      publish()
      return present
    },
    redo() {
      const target = future.pop()
      if (target === undefined) return null
      past.push(present)
      present = target
      last = null
      publish()
      return present
    },
    reset(next) {
      present = next
      past = []
      future = []
      last = null
      publish()
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  }
}
