import { describe, it, expect } from 'vitest'
import { navFor } from './nav'

describe('navFor', () => {
  it("donne à l'admin Gestion, Tableau de bord, Compte", () => {
    expect(navFor({ kind: 'admin', email: 'a@b.c' }).map(item => item.id)).toEqual(['gestion', 'dashboard', 'compte'])
  })
  it('donne au prof Tableau de bord, Élèves, Bibliothèque, Compte', () => {
    expect(navFor({ kind: 'prof', id: '1', username: 'p' }).map(item => item.id)).toEqual([
      'dashboard', 'eleves', 'bibliotheque', 'compte',
    ])
  })
  it('termine chaque lien par une barre', () => {
    for (const item of navFor({ kind: 'prof', id: '1', username: 'p' })) expect(item.href).toMatch(/\/$/)
  })
})
