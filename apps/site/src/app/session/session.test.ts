import { describe, it, expect } from 'vitest'
import { identityKind, sessionFromRecord } from './session'

describe('identityKind', () => {
  it('un @ désigne le superutilisateur', () => {
    expect(identityKind('admin@mon-domaine.fr')).toBe('admin')
    expect(identityKind('prof.dupont')).toBe('user')
  })
})

describe('sessionFromRecord', () => {
  it('lit un superutilisateur', () => {
    expect(sessionFromRecord({ collectionName: '_superusers', id: 's', email: 'a@b.c' })).toEqual({ kind: 'admin', email: 'a@b.c' })
  })
  it('lit un prof et un élève', () => {
    expect(sessionFromRecord({ collectionName: 'users', id: 'p', username: 'x', role: 'prof' })).toEqual({ kind: 'prof', id: 'p', username: 'x' })
    expect(sessionFromRecord({ collectionName: 'users', id: 'e', username: 'y', role: 'eleve' })).toEqual({ kind: 'eleve', id: 'e', username: 'y' })
  })
  it('renvoie null sans enregistrement ou pour un rôle inconnu', () => {
    expect(sessionFromRecord(null)).toBeNull()
    expect(sessionFromRecord({ collectionName: 'users', id: 'x', username: 'z', role: '???' })).toBeNull()
  })
})
