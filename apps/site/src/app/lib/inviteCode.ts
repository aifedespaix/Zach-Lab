// Jumeau de infra/pb_hooks/lib/inviteCode.js : les deux rejouent la même table
// (infra/fixtures/invite-code-states.json).

export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const INVITE_LENGTH = 10

export type InviteKind = 'unique' | 'duree'
export type InviteState = 'actif' | 'utilise' | 'expire' | 'revoque'

export interface InviteCodeRecord {
  kind: InviteKind
  expires_at?: string
  revoked?: boolean
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** `ABCDE-FGHJK` : plus facile à dicter et à recopier. */
export function formatCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

function parseDate(value: string | undefined): number {
  if (value === undefined || value === '') return NaN
  return Date.parse(value.replace(' ', 'T'))
}

export function inviteCodeState(code: InviteCodeRecord, usedCount: number, nowMs: number): InviteState {
  if (code.revoked === true) return 'revoque'
  if (code.kind === 'duree') {
    const expiresAt = parseDate(code.expires_at)
    // Une durée sans échéance valide est un code mal formé : refusé, pas éternel.
    if (Number.isNaN(expiresAt) || expiresAt <= nowMs) return 'expire'
  } else if (usedCount >= 1) {
    return 'utilise'
  }
  return 'actif'
}

export function isUsable(state: InviteState): boolean {
  return state === 'actif'
}

type RandomBytes = (count: number) => Uint8Array

const cryptoBytes: RandomBytes = count => crypto.getRandomValues(new Uint8Array(count))

/**
 * Tire un code par échantillonnage avec rejet : 256 n'est pas multiple de 31,
 * replier un octet par `% 31` favoriserait les premiers caractères.
 */
export function generateCode(random: RandomBytes = cryptoBytes): string {
  const limit = 256 - (256 % INVITE_ALPHABET.length)
  let code = ''
  while (code.length < INVITE_LENGTH) {
    for (const byte of random(INVITE_LENGTH * 2)) {
      if (byte >= limit) continue
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length]
      if (code.length === INVITE_LENGTH) break
    }
  }
  return code
}
