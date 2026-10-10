import { describe, it, expect } from 'vitest'
import cases from '../../../../../infra/fixtures/invite-code-states.json'
import {
  INVITE_ALPHABET,
  INVITE_LENGTH,
  formatCode,
  generateCode,
  inviteCodeState,
  isUsable,
  normalizeCode,
  type InviteCodeRecord,
} from './inviteCode'

describe('inviteCodeState (site)', () => {
  it.each(cases)('$name', ({ code, usedCount, now, expected }) => {
    expect(inviteCodeState(code as InviteCodeRecord, usedCount, Date.parse(now))).toBe(expected)
  })
})

describe('normalizeCode / formatCode', () => {
  it('normalise', () => expect(normalizeCode(' abcde-fghjk ')).toBe('ABCDEFGHJK'))
  it('groupe 5-5', () => expect(formatCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK'))
  it('isUsable', () => {
    expect(isUsable('actif')).toBe(true)
    expect(isUsable('revoque')).toBe(false)
  })
})

describe('generateCode', () => {
  it("tire 10 caractères de l'alphabet, sans ambigus", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode()
      expect(code).toHaveLength(INVITE_LENGTH)
      for (const char of code) expect(INVITE_ALPHABET).toContain(char)
    }
  })
  it('ne se répète pas sur 1000 tirages', () => {
    expect(new Set(Array.from({ length: 1000 }, () => generateCode())).size).toBe(1000)
  })
  it('rejette les octets biaisés (≥ 248) au lieu de les replier', () => {
    // Octets 0..9 entrelacés d'octets ≥ 248 : seuls les premiers comptent.
    const bytes = [248, 0, 250, 1, 255, 2, 249, 3, 251, 4, 252, 5, 253, 6, 254, 7, 248, 8, 250, 9]
    const code = generateCode(count => Uint8Array.from({ length: count }, (_, k) => bytes[k % bytes.length]))
    expect(code).toBe('ABCDEFGHJK')
  })
  it('redemande des octets quand un lot ne contient que des octets rejetés', () => {
    const batches = [Array(20).fill(250), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
    let call = 0
    const code = generateCode(() => Uint8Array.from(batches[call++]))
    expect(code).toBe('ABCDEFGHJK')
    expect(call).toBe(2)
  })
})
