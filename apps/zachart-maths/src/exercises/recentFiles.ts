const STORAGE_KEY = 'zachart-maths:session'
export const RECENT_LIMIT = 10

export interface RecentFile {
  path: string
  /** ISO — le format que `formatRelativeTime` lit. */
  openedAt: string
}

/** Les derniers fichiers ouverts, lus dans `localStorage` ; un stockage absent, bloqué ou corrompu donne une liste vide. */
export function loadRecent(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed = JSON.parse(raw) as { recentFiles?: unknown }
    if (!Array.isArray(parsed.recentFiles)) return []
    return parsed.recentFiles
      .filter((f): f is RecentFile => typeof f === 'object' && f !== null && typeof (f as RecentFile).path === 'string' && typeof (f as RecentFile).openedAt === 'string')
      .slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

export function saveRecent(files: readonly RecentFile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ recentFiles: files }))
  } catch {
    // Au mieux : un stockage bloqué veut juste dire que la prochaine session repart sans récents.
  }
}

/** Le plus récent d'abord, sans doublon, au plus `RECENT_LIMIT`. */
export function pushRecent(files: readonly RecentFile[], path: string, now: Date = new Date()): RecentFile[] {
  return [{ path, openedAt: now.toISOString() }, ...files.filter(f => f.path !== path)].slice(0, RECENT_LIMIT)
}

export const renameRecent = (files: readonly RecentFile[], from: string, to: string): RecentFile[] =>
  files.map(f => (f.path === from ? { ...f, path: to } : f))
