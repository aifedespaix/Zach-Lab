import { useCallback, useMemo, useRef, useState } from 'react'
import { createHistoryStore, type HistoryStore } from '../history'
import { AUTOSAVE_DELAY_MS, useAutosave } from './useAutosave'

/** Ce que l'app sait faire d'un fichier ; le système de fichiers reste de son côté. */
export interface DocumentPort<T> {
  /** `null` : le fichier n'existe plus. */
  read(path: string): Promise<T | null>
  write(path: string, doc: T): Promise<void>
  validate?(raw: T): { ok: true } | { ok: false; issues: unknown[] }
}

export type FileSessionStatus = 'idle' | 'opening' | 'ready'

export type FileSessionError =
  | { kind: 'missing'; path: string }
  | { kind: 'invalid'; path: string; issues: unknown[] }
  | { kind: 'read'; path: string; cause: unknown }
  | { kind: 'save'; cause: unknown }

export interface FileSessionOptions {
  delay?: number
}

interface Loaded<T> {
  path: string
  doc: T
  /** Le document tel que lu : tant qu'on n'y a pas touché, rien à écrire. */
  baseline: T
  history: HistoryStore<T>
}

/**
 * Le cycle de vie d'UN fichier ouvert : `open` → charge → valide → arme l'autosave.
 *
 * `path` n'est que le fichier DONT LE CONTENU EST là : il ne change qu'une fois la lecture réussie
 * et validée, donc un échec revient tout seul au fichier précédent, et l'autosave ne peut jamais
 * écrire vers un fichier que l'app n'a pas fini de charger. Avant tout changement de chemin on
 * `flush` : le changement annule le minuteur, une modification récente doit déjà être sur le disque.
 */
export function useFileSession<T>(port: DocumentPort<T>, { delay = AUTOSAVE_DELAY_MS }: FileSessionOptions = {}) {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<FileSessionError | null>(null)
  const portRef = useRef(port)
  portRef.current = port
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  // Une ouverture lente ne doit pas écraser une plus récente.
  const ticket = useRef(0)

  const { flush: flushAutosave } = useAutosave<T | null>(
    async doc => {
      const current = loadedRef.current
      if (current !== null && doc !== null) await portRef.current.write(current.path, doc)
    },
    loaded?.doc ?? null,
    {
      delay,
      scope: loaded?.path ?? '',
      enabled: loaded !== null && loaded.doc !== loaded.baseline,
      onError: cause => setError({ kind: 'save', cause }),
    },
  )

  /** `false` si l'écriture échoue : l'appelant reste sur le fichier courant. */
  const flush = useCallback(async () => {
    try {
      await flushAutosave()
      return true
    } catch (cause) {
      setError({ kind: 'save', cause })
      return false
    }
  }, [flushAutosave])

  const open = useCallback(async (next: string) => {
    if (loadedRef.current?.path === next) return
    const mine = ++ticket.current
    if (!(await flush())) return
    setOpening(true)
    setError(null)
    try {
      const raw = await portRef.current.read(next)
      if (mine !== ticket.current) return
      if (raw === null) return setError({ kind: 'missing', path: next })
      const verdict = portRef.current.validate?.(raw) ?? { ok: true as const }
      if (!verdict.ok) return setError({ kind: 'invalid', path: next, issues: verdict.issues })
      setLoaded({ path: next, doc: raw, baseline: raw, history: createHistoryStore<T>(raw) })
    } catch (cause) {
      if (mine === ticket.current) setError({ kind: 'read', path: next, cause })
    } finally {
      if (mine === ticket.current) setOpening(false)
    }
  }, [flush])

  const close = useCallback(async () => {
    if (!(await flush())) return
    ticket.current++
    setLoaded(null)
    setError(null)
  }, [flush])

  /** Le fichier ouvert a changé de chemin (renommé, déplacé, par la synchro) : écrire l'ancien, puis suivre. */
  const follow = useCallback(async (from: string, to: string) => {
    if (loadedRef.current?.path !== from) return
    if (!(await flush())) return
    setLoaded(current => (current?.path === from ? { ...current, path: to } : current))
  }, [flush])

  const setDoc = useCallback((next: T, groupKey?: string) => {
    // Hors de l'updater : il peut être rejoué (StrictMode), un `commit` ne doit l'être qu'une fois.
    loadedRef.current?.history.commit(next, groupKey)
    setLoaded(current => (current === null ? current : { ...current, doc: next }))
  }, [])

  const travel = useCallback((direction: 'undo' | 'redo') => {
    const target = loadedRef.current?.history[direction]()
    if (target != null) setLoaded(current => (current === null ? current : { ...current, doc: target }))
  }, [])
  const undo = useCallback(() => travel('undo'), [travel])
  const redo = useCallback(() => travel('redo'), [travel])

  const clearError = useCallback(() => setError(null), [])

  return useMemo(() => ({
    status: (opening ? 'opening' : loaded === null ? 'idle' : 'ready') as FileSessionStatus,
    path: loaded?.path ?? null,
    doc: loaded?.doc ?? null,
    error,
    clearError,
    open, close, flush, follow, setDoc, undo, redo,
    canUndo: loaded?.history.canUndo() ?? false,
    canRedo: loaded?.history.canRedo() ?? false,
  }), [opening, loaded, error, clearError, open, close, flush, follow, setDoc, undo, redo])
}
