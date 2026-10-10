import type { RecordModel } from 'pocketbase'
import { pb } from '../session/pb'
import { generateCode } from '../lib/inviteCode'
import type { CodeRow, UserRow } from './summaries'

/** Ce dont l'API a besoin du SDK : permet d'injecter un faux client en test. */
export interface Client {
  collection(name: string): {
    getFullList(options?: Record<string, unknown>): Promise<RecordModel[]>
    create(body: Record<string, unknown>): Promise<RecordModel>
    update(id: string, body: Record<string, unknown>): Promise<RecordModel>
    delete(id: string): Promise<unknown>
  }
}

// Une réponse du serveur n'est jamais de confiance : on normalise chaque champ.
const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const toUser = (r: RecordModel): UserRow => ({
  id: r.id, username: text(r.username), role: r.role === 'prof' ? 'prof' : 'eleve',
  teacher: text(r.teacher), invite_code: text(r.invite_code), created: text(r.created),
})
const toCode = (r: RecordModel): CodeRow => ({
  id: r.id, code: text(r.code), kind: r.kind === 'duree' ? 'duree' : 'unique', expires_at: text(r.expires_at),
  revoked: r.revoked === true, note: text(r.note), created: text(r.created),
})

interface ApiErrorShape {
  status?: unknown
  response?: { data?: unknown; message?: unknown }
}

/** Message français d'une erreur PocketBase. Jamais de secret : ni mot de passe, ni jeton. */
export function describeApiError(error: unknown): string {
  const shape: ApiErrorShape = typeof error === 'object' && error !== null ? error : {}
  const status = Number(shape.status ?? 0)
  if (!Number.isFinite(status) || status === 0) return 'Serveur injoignable.'
  if (status === 401 || status === 403) return 'Accès refusé : reconnectez-vous.'
  const fields = shape.response?.data
  if (typeof fields === 'object' && fields !== null) {
    const first = Object.entries(fields)[0] as [string, { message?: unknown } | undefined] | undefined
    if (typeof first?.[1]?.message === 'string') return `${first[0]} : ${first[1].message}`
  }
  const message = shape.response?.message
  return typeof message === 'string' && message !== '' ? message : `Erreur ${status}.`
}

export async function listUsers(client: Client = pb): Promise<UserRow[]> {
  return (await client.collection('users').getFullList({ sort: 'username' })).map(toUser)
}

export function createUser(
  input: { username: string; password: string; role: 'prof' | 'eleve'; teacher: string },
  client: Client = pb
) {
  return client.collection('users').create({
    username: input.username, password: input.password, passwordConfirm: input.password,
    role: input.role, teacher: input.role === 'eleve' ? input.teacher : '',
  })
}

export function updateUser(id: string, patch: { username?: string; teacher?: string }, client: Client = pb) {
  return client.collection('users').update(id, patch)
}

export function setPassword(id: string, password: string, client: Client = pb) {
  return client.collection('users').update(id, { password, passwordConfirm: password })
}

export function deleteUser(id: string, client: Client = pb) {
  return client.collection('users').delete(id)
}

export async function listCodes(client: Client = pb): Promise<CodeRow[]> {
  return (await client.collection('invite_codes').getFullList({ sort: '-created' })).map(toCode)
}

export async function createCode(
  input: { kind: 'unique' | 'duree'; expiresAt: string; note: string },
  client: Client = pb
): Promise<CodeRow> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return toCode(
        await client.collection('invite_codes').create({
          code: generateCode(), kind: input.kind, note: input.note,
          ...(input.kind === 'duree' ? { expires_at: input.expiresAt } : {}),
        })
      )
    } catch (error) {
      lastError = error
      // Seul un code en double (400) mérite un nouveau tirage ; le reste est une vraie panne.
      const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined
      if (status !== 400) throw error
    }
  }
  throw lastError
}

export function revokeCode(id: string, client: Client = pb) {
  return client.collection('invite_codes').update(id, { revoked: true })
}

export function deleteCode(id: string, client: Client = pb) {
  return client.collection('invite_codes').delete(id)
}
