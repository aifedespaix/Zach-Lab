import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'saved' | 'dirty' | 'saving' | 'error'

export interface AutosaveOptions {
  /** Writes the current value; read when it fires, so it may be an inline closure. */
  save: () => Promise<void>
  /** Bumped by every edit (not by a load): a change is what arms the timer. */
  version: number
  /** The caller keeps this false until saving is safe (a load that has not finished must never be written). */
  enabled: boolean
  delay?: number
  onError?: (error: unknown) => void
}

/**
 * Debounced autosave. `flush` writes a pending change at once — before leaving the path (switching
 * files, closing the window) — and rejects when the write fails, so the caller can ask what to do.
 * A failed write stays flush-able: `dirty` is cleared only once a write succeeded.
 */
export function useAutosave({ save, version, enabled, delay = 600, onError }: AutosaveOptions): {
  flush: () => Promise<void>
  status: AutosaveStatus
} {
  const [status, setStatus] = useState<AutosaveStatus>('saved')
  const saveRef = useRef(save)
  saveRef.current = save
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const seen = useRef(version)
  const writing = useRef<Promise<void> | null>(null)

  const write = useCallback(async () => {
    clearTimeout(timer.current)
    timer.current = undefined
    // Let a write in flight finish first: two writes of one file must never interleave.
    if (writing.current !== null) await writing.current.catch(() => {})
    if (!dirty.current || !enabledRef.current) return
    dirty.current = false
    setStatus('saving')
    const attempt = saveRef.current()
    writing.current = attempt
    try {
      await attempt
      // An edit made during the write re-armed `dirty`: do not call that saved.
      setStatus(dirty.current ? 'dirty' : 'saved')
    } catch (error) {
      dirty.current = true
      setStatus('error')
      onErrorRef.current?.(error)
      throw error
    } finally {
      if (writing.current === attempt) writing.current = null
    }
  }, [])

  useEffect(() => {
    if (version === seen.current) return
    seen.current = version
    if (!enabled) return
    dirty.current = true
    setStatus('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void write().catch(() => {}), delay)
    return () => clearTimeout(timer.current)
  }, [version, enabled, delay, write])

  // A file left behind drops its timer and its pending state with it: the caller flushes first.
  useEffect(() => {
    if (!enabled) {
      clearTimeout(timer.current)
      dirty.current = false
      setStatus('saved')
    }
  }, [enabled])

  const flush = useCallback(() => write(), [write])
  return { flush, status }
}
