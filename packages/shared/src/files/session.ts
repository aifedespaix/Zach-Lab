import { readStored, writeStored } from '../storage'

export const RECENT_LIMIT = 10

export interface RecentFile {
  path: string
  /** ISO — le format que `formatRelativeTime` lit. */
  openedAt: string
}

/**
 * Ce qu'une app retrouve au démarrage. Surensemble des deux formats d'avant : Maths n'écrivait que
 * `recentFiles`, Mentale les trois champs ; chacun est lu tel quel, les champs absents valent vide.
 */
export interface SessionState {
  currentFilePath: string | null
  expandedPaths: string[]
  /** Le plus récent d'abord, au plus `RECENT_LIMIT`. */
  recentFiles: RecentFile[]
}

export const EMPTY_SESSION: SessionState = { currentFilePath: null, expandedPaths: [], recentFiles: [] }

const isRecent = (value: unknown): value is RecentFile =>
  typeof value === 'object' && value !== null
  && typeof (value as RecentFile).path === 'string' && typeof (value as RecentFile).openedAt === 'string'

/** Jamais d'exception : un contenu absent, illisible ou d'une autre forme donne la session vide. */
export function parseSession(raw: string | null): SessionState {
  if (!raw) return EMPTY_SESSION
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return EMPTY_SESSION
    const { currentFilePath, expandedPaths, recentFiles } = parsed as Record<string, unknown>
    return {
      currentFilePath: typeof currentFilePath === 'string' ? currentFilePath : null,
      expandedPaths: Array.isArray(expandedPaths) ? expandedPaths.filter((p): p is string => typeof p === 'string') : [],
      recentFiles: Array.isArray(recentFiles) ? recentFiles.filter(isRecent).slice(0, RECENT_LIMIT) : [],
    }
  } catch {
    return EMPTY_SESSION
  }
}

/** Le plus récent d'abord, sans doublon, au plus `RECENT_LIMIT`. */
export function pushRecent(files: readonly RecentFile[], path: string, now: Date = new Date()): RecentFile[] {
  return [{ path, openedAt: now.toISOString() }, ...files.filter(f => f.path !== path)].slice(0, RECENT_LIMIT)
}

export const renameRecent = (files: readonly RecentFile[], from: string, to: string): RecentFile[] =>
  files.map(f => (f.path === from ? { ...f, path: to } : f))

const sessionKey = (appId: string) => `${appId}:session`

export const loadSession = (appId: string): SessionState => parseSession(readStored(sessionKey(appId)))

export function saveSession(appId: string, state: SessionState): void {
  writeStored(sessionKey(appId), JSON.stringify(state))
}
