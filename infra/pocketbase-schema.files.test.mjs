import { describe, it, expect } from 'vitest'
import {
  FILES_COLLECTION,
  TEXT_MAX,
  USERS_COLLECTION,
  desiredCollections,
  planCollection,
} from './pocketbase-schema.mjs'

const byName = name => desiredCollections().find(collection => collection.name === name)

describe('files', () => {
  const files = byName(FILES_COLLECTION)
  const field = name => files.fields.find(f => f.name === name)

  it('existe, en collection de base, après users', () => {
    expect(files).toBeDefined()
    expect(files.kind).toBe('base')
    const names = desiredCollections().map(c => c.name)
    expect(names.indexOf(FILES_COLLECTION)).toBeGreaterThan(names.indexOf(USERS_COLLECTION))
  })

  it('porte tous les champs du modèle', () => {
    const names = files.fields.map(f => f.name)
    for (const name of [
      'file_id', 'app', 'kind', 'path', 'content', 'hash', 'rev', 'owner',
      'origin_id', 'conflict_of', 'deleted_at', 'deleted_by', 'updated_by', 'created', 'updated',
    ]) {
      expect(names, name).toContain(name)
    }
  })

  it('content est plafonné à TEXT_MAX, jamais à 0', () => {
    expect(field('content').max).toBe(TEXT_MAX)
    expect(TEXT_MAX).toBeGreaterThan(0)
  })

  it('rev est un entier, owner une relation vers users', () => {
    expect(field('rev').type).toBe('number')
    expect(field('rev').onlyInt).toBe(true)
    expect(field('rev').min).toBe(0)
    expect(field('owner').type).toBe('relation')
    expect(field('owner').required).toBe(true)
    expect(field('owner').collectionId).toBe('_pb_users_auth_')
    expect(field('deleted_at').type).toBe('date')
  })

  it('un même fichier est unique par (owner, app, file_id)', () => {
    expect(
      files.indexes.some(
        sql => /UNIQUE/i.test(sql) && /`owner`, `app`, `file_id`/.test(sql),
      ),
    ).toBe(true)
  })

  it('planCollection la crée sur un serveur qui ne la connaît pas', () => {
    const plan = planCollection(undefined, files)
    expect(plan.changes.length).toBeGreaterThan(0)
  })
})

describe('files : règles', () => {
  const { rules } = byName(FILES_COLLECTION)

  it('un élève ne lit que ses copies, un prof celles de ses élèves', () => {
    for (const rule of [rules.listRule, rules.viewRule]) {
      expect(rule).toContain('owner = @request.auth.id')
      expect(rule).toContain('@request.auth.role = "prof"')
      expect(rule).toContain('owner.teacher = @request.auth.id')
    }
  })

  it('personne ne peut écrire rev, ni changer owner', () => {
    expect(rules.createRule).toContain('@request.body.rev:isset = false')
    expect(rules.updateRule).toContain('@request.body.rev:isset = false')
    expect(rules.updateRule).toContain('@request.body.owner:isset = false')
  })

  it('on ne crée une copie que pour soi, ou pour un de ses élèves', () => {
    expect(rules.createRule).toContain('@request.body.owner = @request.auth.id')
    expect(rules.createRule).toContain('@request.body.owner.teacher = @request.auth.id')
    expect(rules.createRule).toContain('@request.body.deleted_at:isset = false')
  })

  it('seul un prof peut vider deleted_at (annuler une suppression)', () => {
    expect(rules.updateRule).toContain('@request.body.deleted_at:isset = false')
    expect(rules.updateRule).toContain('@request.body.deleted_at != ""')
    expect(rules.updateRule).toContain('@request.auth.role = "prof"')
  })

  it('la suppression définitive est réservée au serveur', () => {
    expect(rules.deleteRule).toBeNull()
  })
})
