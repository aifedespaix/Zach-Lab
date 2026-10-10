import { describe, it, expect } from 'vitest'
import {
  INVITE_CODES_COLLECTION,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  USERS_COLLECTION,
  desiredCollections,
  INSCRIPTION_RATE_RULE,
  planRateLimits,
} from './pocketbase-schema.mjs'

const byName = name => desiredCollections().find(collection => collection.name === name)

describe('invite_codes', () => {
  const codes = byName(INVITE_CODES_COLLECTION)

  it('existe, en collection de base', () => {
    expect(codes).toBeDefined()
    expect(codes.kind).toBe('base')
  })

  it('est fermée à tout le monde sauf aux superutilisateurs', () => {
    for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
      expect(codes.rules[rule], rule).toBeNull()
    }
  })

  it('porte kind, expires_at, revoked, note et un code unique', () => {
    const names = codes.fields.map(field => field.name)
    for (const name of ['code', 'kind', 'expires_at', 'revoked', 'note']) expect(names).toContain(name)
    expect(codes.fields.find(field => field.name === 'kind').values).toEqual(['unique', 'duree'])
    expect(codes.indexes.some(sql => /UNIQUE/i.test(sql) && /\(`code`\)/.test(sql))).toBe(true)
  })

  it("l'alphabet exclut les caractères ambigus et n'a pas de doublon", () => {
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[01OIl]/)
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(INVITE_CODE_ALPHABET.length)
    expect(INVITE_CODE_ALPHABET).toHaveLength(31)
    expect(INVITE_CODE_LENGTH).toBe(10)
  })
})

describe('users', () => {
  const users = byName(USERS_COLLECTION)

  it('gagne teacher (relation vers users) et invite_code', () => {
    const teacher = users.fields.find(field => field.name === 'teacher')
    expect(teacher.type).toBe('relation')
    expect(teacher.collectionId).toBe('_pb_users_auth_')
    expect(teacher.maxSelect).toBe(1)
    expect(users.fields.some(field => field.name === 'invite_code')).toBe(true)
  })

  it('reste fermée à la création anonyme', () => {
    expect(users.rules.createRule).not.toBe('')
    expect(users.rules.createRule).toContain('@request.auth.role = "prof"')
  })

  it('cloisonne chaque prof à ses élèves', () => {
    for (const rule of ['listRule', 'viewRule', 'deleteRule', 'manageRule']) {
      expect(users.rules[rule], rule).toContain('teacher = @request.auth.id')
    }
  })

  it("interdit de changer role, teacher et invite_code soi-même", () => {
    expect(users.rules.updateRule).toContain('@request.body.role:isset = false')
    expect(users.rules.updateRule).toContain('@request.body.teacher:isset = false')
    expect(users.rules.updateRule).toContain('@request.body.invite_code:isset = false')
    // Les DEUX branches de updateRule (soi-même, élève du prof) et la création.
    const occurrences = rule => rule.split('@request.body.invite_code:isset = false').length - 1
    expect(occurrences(users.rules.updateRule)).toBe(2)
    expect(occurrences(users.rules.createRule)).toBe(1)
  })
})

describe('planRateLimits', () => {
  const defaults = {
    enabled: false,
    rules: [
      { label: '*:auth', maxRequests: 2, duration: 3, audience: '' },
      { label: '*:create', maxRequests: 20, duration: 5, audience: '' },
    ],
  }

  it('désactivée : l’active avec NOTRE règle seule (pas les défauts qui brideraient la synchro)', () => {
    const plan = planRateLimits(defaults)
    expect(plan.update.rateLimits.enabled).toBe(true)
    expect(plan.update.rateLimits.rules).toEqual([INSCRIPTION_RATE_RULE])
    expect(plan.changes.length).toBeGreaterThan(0)
  })

  it('déjà activée par l’opérateur : garde ses règles et ajoute la nôtre', () => {
    const mine = { label: '/api/', maxRequests: 300, duration: 10, audience: '' }
    const plan = planRateLimits({ enabled: true, rules: [mine] })
    expect(plan.update.rateLimits.rules).toEqual([mine, INSCRIPTION_RATE_RULE])
  })

  it('remplace une version périmée de notre règle', () => {
    const stale = { ...INSCRIPTION_RATE_RULE, maxRequests: 99 }
    const plan = planRateLimits({ enabled: true, rules: [stale] })
    expect(plan.update.rateLimits.rules).toEqual([INSCRIPTION_RATE_RULE])
  })

  it('est un no-op quand tout est conforme', () => {
    expect(planRateLimits({ enabled: true, rules: [INSCRIPTION_RATE_RULE] })).toEqual({ changes: [] })
  })
})
