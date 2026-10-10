import { pb } from './pb'

export type Session =
  | { kind: 'admin'; email: string }
  | { kind: 'prof' | 'eleve'; id: string; username: string }

export type PageId = 'login' | 'inscription' | 'gestion' | 'dashboard' | 'eleves' | 'compte' | 'bibliotheque'

/** Un identifiant contenant « @ » ne peut pas être un pseudo (le motif l'interdit) : c'est le courriel du superutilisateur. */
export function identityKind(identity: string): 'admin' | 'user' {
  return identity.includes('@') ? 'admin' : 'user'
}

interface AuthRecordLike {
  collectionName: string
  id: string
  email?: string
  username?: string
  role?: string
}

export function sessionFromRecord(record: AuthRecordLike | null): Session | null {
  if (record === null) return null
  if (record.collectionName === '_superusers') return { kind: 'admin', email: record.email ?? '' }
  if (record.role === 'prof' || record.role === 'eleve') {
    return { kind: record.role, id: record.id, username: record.username ?? '' }
  }
  return null
}

export function currentSession(): Session | null {
  if (!pb.authStore.isValid) return null
  return sessionFromRecord(pb.authStore.record as AuthRecordLike | null)
}

export class LoginError extends Error {}

function describeAuthError(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : 0
  if (status === 0) return 'Serveur injoignable. Vérifiez votre connexion.'
  if (status === 400) return 'Identifiant ou mot de passe incorrect.'
  return `La connexion a échoué (erreur ${status}).`
}

/**
 * Connecte l'admin (superutilisateur) ou un compte `users`.
 *
 * Un compte élève est REFUSÉ et déconnecté aussitôt : le site n'a rien pour lui,
 * et le laisser entrer serait lui montrer des écrans où chaque bouton répondrait
 * « 403 ». C'est une politesse ; la sécurité est dans les règles de collection.
 */
export async function loginAny(identity: string, password: string): Promise<Session> {
  const name = identity.trim()
  try {
    if (identityKind(name) === 'admin') {
      await pb.collection('_superusers').authWithPassword(name, password)
    } else {
      await pb.collection('users').authWithPassword(name, password)
    }
  } catch (error) {
    // Jamais d'écho de l'erreur brute : elle peut contenir la requête.
    throw new LoginError(describeAuthError(error))
  }
  const session = currentSession()
  if (session === null) {
    pb.authStore.clear()
    throw new LoginError('Connexion acceptée mais session illisible. Réessayez.')
  }
  if (session.kind === 'eleve') {
    pb.authStore.clear()
    throw new LoginError('Les comptes élèves se connectent dans l’application de bureau, pas sur le site.')
  }
  return session
}

export function logout(): void {
  pb.authStore.clear()
}
