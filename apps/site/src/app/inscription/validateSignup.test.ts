import { describe, it, expect } from 'vitest'
import { codeFromSearch, validateSignup } from './validateSignup'

const base = { code: 'abcde-fghjk', username: 'prof.dupont', password: 'unmotdepasse1', confirm: 'unmotdepasse1' }

describe('validateSignup', () => {
  it('accepte et normalise le code', () => {
    const result = validateSignup(base)
    expect(result).toEqual({ ok: true, value: { code: 'ABCDEFGHJK', username: 'prof.dupont', password: 'unmotdepasse1' } })
  })
  it('refuse un code de mauvaise longueur', () => {
    const result = validateSignup({ ...base, code: 'ABC' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.code).toBeDefined()
  })
  it('refuse un identifiant hors motif', () => {
    const result = validateSignup({ ...base, username: 'a b' })
    expect(result.ok).toBe(false)
  })
  it('refuse un mot de passe de moins de 10 caractères', () => {
    const result = validateSignup({ ...base, password: 'court', confirm: 'court' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.password).toMatch(/10/)
  })
  it('refuse une confirmation différente', () => {
    const result = validateSignup({ ...base, confirm: 'autre' })
    if (result.ok) throw new Error('attendu : refus')
    expect(result.errors.confirm).toBeDefined()
  })
})

describe('codeFromSearch', () => {
  it('lit ?code=', () => expect(codeFromSearch('?code=abcde-fghjk')).toBe('ABCDE-FGHJK'))
  it('ignore un code absurde sans planter', () => {
    expect(codeFromSearch('?code=' + 'x'.repeat(5000))).toHaveLength(32)
    expect(codeFromSearch('')).toBe('')
    // Un échappement mal formé ne doit ni planter ni dépasser la borne.
    expect(codeFromSearch('?code=%E0%A4%A').length).toBeLessThanOrEqual(32)
  })
})
