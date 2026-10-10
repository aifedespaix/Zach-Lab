import type { CodeView, UserRow } from '../gestion/summaries'

export interface SyncEventRow { username: string; level: string; created: string }
export interface ConflictRow { username: string; status: string }

/**
 * Récapitulatif d'un prof. L'API renvoie les événements et conflits de TOUS les comptes
 * (la règle de liste est « prof », pas « mes élèves ») : on ne retient donc que ceux
 * des élèves passés en argument.
 */
export function profStats(eleves: readonly UserRow[], events: readonly SyncEventRow[], conflicts: readonly ConflictRow[]) {
  const names = new Set(eleves.map(e => e.username))
  const open = conflicts.filter(c => c.status === 'open' && names.has(c.username))
  const perEleve = eleves.map(e => {
    // Comparaison de chaînes : le format PocketBase est triable lexicographiquement.
    const last = events
      .filter(ev => ev.username === e.username)
      .reduce<SyncEventRow | null>((best, ev) => (best === null || ev.created > best.created ? ev : best), null)
    return {
      username: e.username,
      lastSyncAt: last?.created ?? null,
      lastLevel: last?.level ?? null,
      openConflicts: open.filter(c => c.username === e.username).length,
    }
  })
  return { eleveCount: eleves.length, openConflicts: open.length, perEleve }
}

export function adminStats(users: readonly UserRow[], codes: readonly CodeView[]) {
  return {
    profCount: users.filter(u => u.role === 'prof').length,
    eleveCount: users.filter(u => u.role === 'eleve').length,
    activeCodes: codes.filter(c => c.state === 'actif').length,
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Âge lisible d'une date PocketBase (« 2026-10-10 08:00:00.000Z »). L'espace est
 * remplacée par un « T » : seule la forme ISO est garantie par la spec ECMAScript.
 */
export function formatRelative(iso: string | null, nowMs: number): string {
  if (iso === null) return 'jamais'
  const then = Date.parse(iso.trim().replace(' ', 'T'))
  if (Number.isNaN(then)) return 'jamais'
  const age = Math.max(0, nowMs - then)
  if (age < MINUTE) return 'à l’instant'
  if (age < HOUR) return `il y a ${Math.floor(age / MINUTE)} min`
  if (age < DAY) return `il y a ${Math.floor(age / HOUR)} h`
  return `il y a ${Math.floor(age / DAY)} j`
}
