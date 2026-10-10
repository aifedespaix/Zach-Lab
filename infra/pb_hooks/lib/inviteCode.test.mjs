import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const invite = require('./inviteCode.js')
const cases = JSON.parse(readFileSync(new URL('../../fixtures/invite-code-states.json', import.meta.url), 'utf8'))

describe('inviteCodeState (hook)', () => {
  it.each(cases)('$name', ({ code, usedCount, now, expected }) => {
    expect(invite.inviteCodeState(code, usedCount, Date.parse(now))).toBe(expected)
  })
})

describe('normalizeCode', () => {
  it('retire espaces et tirets, passe en majuscules', () => {
    expect(invite.normalizeCode(' abcde-fghjk ')).toBe('ABCDEFGHJK')
    expect(invite.normalizeCode(undefined)).toBe('')
  })
})

describe('isUsable', () => {
  it('seul « actif » est utilisable', () => {
    expect(invite.isUsable('actif')).toBe(true)
    for (const state of ['utilise', 'expire', 'revoque']) expect(invite.isUsable(state)).toBe(false)
  })
})
