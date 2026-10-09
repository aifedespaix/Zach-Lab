import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCommand } from '../commands'
import { createHistoryStore, type HistoryOptions, type HistoryStore } from '../history'
import type { DocumentPort } from './port'
import type { SessionStore } from './session'
import { useAutosave } from './useAutosave'

export type SessionStatus = 'idle' | 'opening' | 'ready'

/** Why a file did not open. The previous file, if any, is still the open one. */
export interface OpenFailure {
  path: string
  kind: 'missing' | 'unreadable' | 'invalid'
  message: string
  issues?: unknown[]
}

/** A question the user must answer: continuing would leave a change behind. */
export interface SessionPrompt {
  message: string
  continueLabel: string
  onContinue: () => void
}

export interface FileSessionOptions {
  /** Last-file / recents store (`createSessionStore`); the session notes each opened file in it. */
  session?: SessionStore
  history?: HistoryOptions
  /** Autosave delay, ms. Default 600. */
  delay?: number
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * The life of an open file, once for every app: open (guarded) → read → validate → arm autosave;
 * a failed open falls back to the previous file; edits go through a snapshot history and a debounced
 * write; close, create, relocate (the open file was renamed by something else).
 *
 * ORDER MATTERS — never overwrite a file: a path is left only after `flush` wrote what was pending
 * (the debounce is cancelled by the path change), and autosave is armed only once the file at the
 * new path is the one actually loaded.
 */
export function useFileSession<T>(port: DocumentPort<T>, options: FileSessionOptions = {}) {
  const { session, delay } = options
  const history = useMemo<HistoryStore<T>>(() => createHistoryStore<T>(options.history), []) // eslint-disable-line react-hooks/exhaustive-deps
  const doc = history(state => state.present)
  const canUndo = history(state => state.past.length > 0)
  const canRedo = history(state => state.future.length > 0)

  const [path, setPath] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [failure, setFailure] = useState<OpenFailure | null>(null)
  const [prompt, setPrompt] = useState<SessionPrompt | null>(null)
  const [version, setVersion] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  const portRef = useRef(port)
  portRef.current = port
  const pathRef = useRef<string | null>(null)
  pathRef.current = path
  const generation = useRef(0)

  const { flush, status: saveStatus } = useAutosave({
    save: async () => {
      const current = pathRef.current
      const value = history.getState().present
      if (current !== null && value !== null) await portRef.current.write(current, value)
    },
    version,
    // Armed only when the file whose cards are on screen is the file that is open.
    enabled: path !== null && doc !== null && status === 'ready',
    delay,
    onError: error => setSaveError(describe(error)),
  })

  const load = useCallback(
    async (target: string) => {
      const mine = ++generation.current
      setStatus(pathRef.current === null ? 'opening' : 'ready')
      setFailure(null)
      const fail = (kind: OpenFailure['kind'], message: string, issues?: unknown[]) => {
        if (mine !== generation.current) return
        setFailure({ path: target, kind, message, issues })
        setStatus(pathRef.current === null ? 'idle' : 'ready')
      }
      let raw: T | null
      try {
        raw = await portRef.current.read(target)
      } catch (error) {
        return fail('unreadable', describe(error))
      }
      if (mine !== generation.current) return
      if (raw === null) return fail('missing', 'Ce fichier n’existe plus.')
      const verdict = portRef.current.validate?.(raw) ?? { ok: true as const }
      if (!verdict.ok) return fail('invalid', 'Ce fichier n’a pas la structure attendue.', verdict.issues)
      history.getState().reset(raw)
      pathRef.current = target
      setPath(target)
      setStatus('ready')
      session?.getState().opened(target)
    },
    [history, session],
  )

  /** Runs `then` once what is pending is on disk; a failed write asks before going on. */
  const afterFlush = useCallback(
    async (continueLabel: string, then: () => void | Promise<void>) => {
      try {
        await flush()
      } catch (error) {
        setPrompt({
          message: `La sauvegarde a échoué : ${describe(error)}`,
          continueLabel,
          onContinue: () => {
            setPrompt(null)
            void then()
          },
        })
        return
      }
      await then()
    },
    [flush],
  )

  const open = useCallback((target: string) => afterFlush('Ouvrir quand même', () => load(target)), [afterFlush, load])

  const close = useCallback(
    () =>
      afterFlush('Fermer quand même', () => {
        generation.current++
        history.getState().reset(null)
        pathRef.current = null
        setPath(null)
        setStatus('idle')
        session?.getState().setCurrentFile(null)
      }),
    [afterFlush, history, session],
  )

  const create = useCallback(
    async (input: unknown) => {
      if (portRef.current.create === undefined) return
      const created = await portRef.current.create(input)
      await open(created)
    },
    [open],
  )

  /** The open file was renamed or moved by something else: follow it. Pending edits reach the OLD path first. */
  const relocate = useCallback(
    async (from: string, to: string) => {
      session?.getState().moved(from, to)
      if (pathRef.current !== from) return
      try {
        await flush()
      } catch {
        // Surfaced by the autosave status; the file stays the one edited, at its new path.
      }
      // Re-read: the user may have opened something else while the write ran.
      if (pathRef.current !== from) return
      pathRef.current = to
      setPath(to)
    },
    [flush, session],
  )

  const edit = useCallback(
    (next: T, groupKey?: string) => {
      if (pathRef.current === null) return
      history.getState().commit(next, groupKey)
      setVersion(v => v + 1)
    },
    [history],
  )
  const undo = useCallback(() => {
    history.getState().undo()
    setVersion(v => v + 1)
  }, [history])
  const redo = useCallback(() => {
    history.getState().redo()
    setVersion(v => v + 1)
  }, [history])

  const isOpen = path !== null && doc !== null
  useCommand('file.close', () => void close(), isOpen)
  useCommand('file.save', () => void flush().catch(() => {}), isOpen)
  useCommand('edit.undo', undo, canUndo)
  useCommand('edit.redo', redo, canRedo)

  // Nothing pending may be lost when the app unmounts.
  useEffect(() => () => void flush().catch(() => {}), [flush])

  return {
    status,
    /** The file whose content is `doc`. */
    path,
    doc,
    saveStatus,
    /** The message of the last failed write, while `saveStatus` is `'error'`. */
    saveError: saveStatus === 'error' ? saveError : null,
    failure,
    dismissFailure: () => setFailure(null),
    prompt,
    dismissPrompt: () => setPrompt(null),
    open,
    close,
    create,
    relocate,
    flush,
    edit,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}

export type FileSession<T> = ReturnType<typeof useFileSession<T>>
