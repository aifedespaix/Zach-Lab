import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { readStored, writeStored } from '../storage'

export const RECENT_LIMIT = 10

export interface RecentFile {
  path: string
  /** ISO — the format `formatRelativeTime` reads. */
  openedAt: string
}

export interface SessionData {
  currentFilePath: string | null
  expandedPaths: string[]
  /** Most recent first, no duplicate, at most `RECENT_LIMIT`. */
  recentFiles: RecentFile[]
}

const EMPTY: SessionData = { currentFilePath: null, expandedPaths: [], recentFiles: [] }

const isRecent = (value: unknown): value is RecentFile =>
  typeof value === 'object' && value !== null && typeof (value as RecentFile).path === 'string' && typeof (value as RecentFile).openedAt === 'string'

/**
 * Reads the session of either app (`{ recentFiles }` for Maths, the full object for Mentale);
 * whatever is absent, blocked or corrupt reads as empty.
 */
export function parseSession(raw: string | null): SessionData {
  if (raw === null) return EMPTY
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof SessionData, unknown>> | null
    if (parsed === null || typeof parsed !== 'object') return EMPTY
    return {
      currentFilePath: typeof parsed.currentFilePath === 'string' ? parsed.currentFilePath : null,
      expandedPaths: Array.isArray(parsed.expandedPaths) ? parsed.expandedPaths.filter((p): p is string => typeof p === 'string') : [],
      recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles.filter(isRecent).slice(0, RECENT_LIMIT) : [],
    }
  } catch {
    return EMPTY
  }
}

export const pushRecent = (files: readonly RecentFile[], path: string, now: Date = new Date()): RecentFile[] =>
  [{ path, openedAt: now.toISOString() }, ...files.filter(f => f.path !== path)].slice(0, RECENT_LIMIT)

export const renameRecent = (files: readonly RecentFile[], from: string, to: string): RecentFile[] =>
  files.map(f => (f.path === from ? { ...f, path: to } : f))

export interface SessionState extends SessionData {
  setCurrentFile: (path: string | null) => void
  setExpandedPaths: (paths: string[]) => void
  /** Notes `path` as just opened. */
  opened: (path: string) => void
  /** The open file moved: it keeps its place in the recents. */
  moved: (from: string, to: string) => void
  forget: (path: string) => void
}

export type SessionStore = UseBoundStore<StoreApi<SessionState>>

/**
 * The last open file, the expanded folders and the recent files, kept under `<appId>:session` —
 * the key both apps already use, read in either format and written as the common superset.
 */
export function createSessionStore(appId: string): SessionStore {
  const key = `${appId}:session`
  const persist = (state: SessionData) =>
    writeStored(key, JSON.stringify({ currentFilePath: state.currentFilePath, expandedPaths: state.expandedPaths, recentFiles: state.recentFiles }))
  return create<SessionState>(set => {
    const update = (patch: (state: SessionData) => Partial<SessionData>) =>
      set(state => {
        const next = { ...state, ...patch(state) }
        persist(next)
        return next
      })
    return {
      ...parseSession(readStored(key)),
      setCurrentFile: path => update(() => ({ currentFilePath: path })),
      setExpandedPaths: paths => update(() => ({ expandedPaths: paths })),
      opened: path => update(state => ({ currentFilePath: path, recentFiles: pushRecent(state.recentFiles, path) })),
      moved: (from, to) =>
        update(state => ({
          currentFilePath: state.currentFilePath === from ? to : state.currentFilePath,
          recentFiles: renameRecent(state.recentFiles, from, to),
        })),
      forget: path => update(state => ({ recentFiles: state.recentFiles.filter(f => f.path !== path), currentFilePath: state.currentFilePath === path ? null : state.currentFilePath })),
    }
  })
}
