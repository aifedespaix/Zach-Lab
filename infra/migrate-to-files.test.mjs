import { describe, it, expect } from 'vitest'
import { contentHash, planMigration } from './migrate-to-files.mjs'

const carte = (over = {}) => ({
  id: 'c1', file_id: 'f1', author: 'zach', path: 'cours/a.zmap', content: '{"a":1}', type: 'cours', ...over,
})
const users = [{ id: 'u1', username: 'zach' }]

describe('contentHash', () => {
  it('SHA-256 tronqué à 8 octets, comme apps/zachart-mentale/src/sync/contentHash.ts', async () => {
    // sha256("abc") = ba7816bf8f01cfea…
    expect(await contentHash('abc')).toBe('ba7816bf8f01cfea')
  })
})

describe('planMigration', () => {
  it('convertit une carte en fichier de rev 1, propriétaire = son auteur', async () => {
    const { create, skip, unknownAuthors } = await planMigration([carte()], [], users)
    expect(skip).toEqual([])
    expect(unknownAuthors).toEqual([])
    expect(create).toEqual([
      {
        file_id: 'f1', app: 'zachart-mentale', kind: 'cours', path: 'cours/a.zmap',
        content: '{"a":1}', hash: await contentHash('{"a":1}'), owner: 'u1', updated_by: 'u1',
      },
    ])
  })

  it('saute ce qui est déjà migré (même owner et file_id)', async () => {
    const existing = [{ owner: 'u1', app: 'zachart-mentale', file_id: 'f1' }]
    const { create, skip } = await planMigration([carte()], existing, users)
    expect(create).toEqual([])
    expect(skip).toEqual(['f1'])
  })

  it('signale un auteur inconnu sans rien créer', async () => {
    const { create, unknownAuthors } = await planMigration([carte({ author: 'fantome' })], [], users)
    expect(create).toEqual([])
    expect(unknownAuthors).toEqual(['fantome'])
  })

  it('est idempotent : rejouer le plan après application ne crée rien', async () => {
    const first = await planMigration([carte()], [], users)
    const applied = first.create.map(f => ({ owner: f.owner, app: f.app, file_id: f.file_id }))
    expect((await planMigration([carte()], applied, users)).create).toEqual([])
  })
})
