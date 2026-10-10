import type { UserRole } from '@app/types/card'
import { pb } from '../../session/pb'

/**
 * Le client PocketBase de la bibliothèque est CELUI DU SITE (`session/pb.ts`).
 * Deux instances du SDK sur la même clé `localStorage` se désynchroniseraient
 * dès qu'une seule rafraîchit son jeton : il n'y en a donc qu'une, et la
 * connexion/déconnexion se font ailleurs (page /login/, coque du site).
 */
export { pb }

export interface AdminUser {
  id: string
  username: string
  role: UserRole
}

/** Ce que porte l'enregistrement `users` une fois authentifié. */
interface AuthRecord {
  id: string
  username: string
  role: string
}

/**
 * Le compte connecté, ou `null`.
 *
 * Lit le magasin d'authentification plutôt qu'un état React : c'est lui la
 * source de vérité, et il survit au rechargement de la page.
 */
export function currentUser(): AdminUser | null {
  const record = pb.authStore.record as AuthRecord | null
  if (record === null || !pb.authStore.isValid) return null
  return {
    id: record.id,
    username: record.username,
    role: record.role === 'prof' ? 'prof' : 'eleve',
  }
}

function statusOf(error: unknown): number {
  if (error !== null && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') return status
  }
  return 0
}

/**
 * Un message d'erreur en français pour n'importe quel échec d'API.
 *
 * Le 404 a droit à sa propre phrase parce qu'il a une cause précise et une
 * solution précise : le serveur n'a pas encore reçu les collections de
 * l'espace professeur, et une seule commande les installe. Sans cette phrase,
 * l'écran des conflits afficherait « erreur 404 » à quelqu'un qui n'a aucune
 * raison de deviner qu'il lui manque une migration.
 */
export function describeApiError(error: unknown, what: string): string {
  const status = statusOf(error)
  if (status === 0) return `${what} : serveur injoignable.`
  if (status === 401 || status === 403) return `${what} : accès refusé par le serveur.`
  if (status === 404) {
    return `${what} : collection absente du serveur. Lancez « bun run infra/setup-pocketbase.mjs » pour la créer.`
  }
  const detail = error instanceof Error && error.message !== '' ? ` (${error.message})` : ''
  return `${what} : erreur ${status}${detail}.`
}
