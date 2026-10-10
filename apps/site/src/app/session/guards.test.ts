import { describe, it, expect } from 'vitest'
import { guard, homeFor } from './guards'
import type { Session } from './session'

const admin: Session = { kind: 'admin', email: 'a@b.c' }
const prof: Session = { kind: 'prof', id: 'p1', username: 'prof' }
const eleve: Session = { kind: 'eleve', id: 'e1', username: 'eleve' }

describe('homeFor', () => {
  it("renvoie l'accueil de chaque rôle", () => {
    expect(homeFor(admin)).toBe('/gestion/')
    expect(homeFor(prof)).toBe('/dashboard/')
    expect(homeFor(eleve)).toBe('/login/')
  })
})

describe('guard', () => {
  it('renvoie un visiteur vers /login/ sur toute page protégée', () => {
    for (const page of ['gestion', 'dashboard', 'eleves', 'compte', 'bibliotheque'] as const) {
      expect(guard(null, page)).toBe('/login/')
    }
  })
  it('laisse un visiteur sur /login/ et /inscription/', () => {
    expect(guard(null, 'login')).toBeNull()
    expect(guard(null, 'inscription')).toBeNull()
  })
  it('renvoie un connecté de /login/ à son accueil', () => {
    expect(guard(admin, 'login')).toBe('/gestion/')
    expect(guard(prof, 'inscription')).toBe('/dashboard/')
  })
  it("réserve /gestion/ à l'admin", () => {
    expect(guard(admin, 'gestion')).toBeNull()
    expect(guard(prof, 'gestion')).toBe('/dashboard/')
  })
  it('réserve /eleves/ et /bibliotheque/ aux profs', () => {
    expect(guard(prof, 'eleves')).toBeNull()
    expect(guard(prof, 'bibliotheque')).toBeNull()
    expect(guard(admin, 'eleves')).toBe('/gestion/')
    expect(guard(admin, 'bibliotheque')).toBe('/gestion/')
  })
  it('ouvre /dashboard/ et /compte/ aux deux', () => {
    for (const page of ['dashboard', 'compte'] as const) {
      expect(guard(admin, page)).toBeNull()
      expect(guard(prof, page)).toBeNull()
    }
  })
  it("n'ouvre rien à un élève", () => {
    for (const page of ['gestion', 'dashboard', 'eleves', 'compte', 'bibliotheque'] as const) {
      expect(guard(eleve, page)).toBe('/login/')
    }
  })
})
