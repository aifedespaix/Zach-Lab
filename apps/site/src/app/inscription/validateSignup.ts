import { INVITE_LENGTH, normalizeCode } from '../lib/inviteCode'

export interface SignupInput { code: string; username: string; password: string; confirm: string }
type Field = 'code' | 'username' | 'password' | 'confirm'
export type SignupResult =
  | { ok: true; value: { code: string; username: string; password: string } }
  | { ok: false; errors: Partial<Record<Field, string>> }

/** Les mêmes règles que le hook `POST /api/inscription` : le serveur re-vérifie tout. */
export function validateSignup(input: SignupInput): SignupResult {
  const errors: Partial<Record<Field, string>> = {}
  const code = normalizeCode(input.code)
  const username = input.username.trim()
  if (code.length !== INVITE_LENGTH) errors.code = `Un code fait ${INVITE_LENGTH} caractères.`
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) {
    errors.username = 'Lettres, chiffres, point, tiret et underscore uniquement (64 au plus).'
  }
  if (input.password.length < 10) errors.password = 'Au moins 10 caractères.'
  if (input.confirm !== input.password) errors.confirm = 'Les deux mots de passe diffèrent.'
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { code, username, password: input.password } }
}

/** Le code d'un lien `/inscription/?code=…`, borné : l'URL est une entrée non fiable. */
export function codeFromSearch(search: string): string {
  try {
    const raw = new URLSearchParams(search).get('code') ?? ''
    return raw.toUpperCase().slice(0, 32)
  } catch {
    return ''
  }
}
