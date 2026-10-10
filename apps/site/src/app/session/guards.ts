import type { PageId, Session } from './session'

const ALLOWED: Record<Exclude<PageId, 'login' | 'inscription'>, ReadonlyArray<'admin' | 'prof'>> = {
  gestion: ['admin'],
  dashboard: ['admin', 'prof'],
  eleves: ['prof'],
  compte: ['admin', 'prof'],
  bibliotheque: ['prof'],
}

export function homeFor(session: Session): string {
  if (session.kind === 'admin') return '/gestion/'
  if (session.kind === 'prof') return '/dashboard/'
  return '/login/'
}

/**
 * Où renvoyer ce visiteur sur cette page, ou `null` s'il peut y rester.
 * Un confort d'interface, rien de plus : les règles de collection de PocketBase
 * sont la seule vraie barrière.
 */
export function guard(session: Session | null, page: PageId): string | null {
  if (page === 'login' || page === 'inscription') {
    return session === null || session.kind === 'eleve' ? null : homeFor(session)
  }
  if (session === null || session.kind === 'eleve') return '/login/'
  return ALLOWED[page].includes(session.kind) ? null : homeFor(session)
}
