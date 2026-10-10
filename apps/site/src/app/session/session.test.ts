import { describe, it, expect, vi, beforeEach } from 'vitest'

// Un faux client PocketBase : on observe les appels et on simule l'état du magasin d'authentification.
const state = vi.hoisted(() => ({
  authWithPassword: vi.fn(),
  collection: vi.fn(),
  clear: vi.fn(),
  isValid: false,
  record: null as unknown,
}))
vi.mock('./pb', () => ({
  pb: {
    collection: (name: string) => {
      state.collection(name)
      return { authWithPassword: (...args: unknown[]) => state.authWithPassword(...args) }
    },
    authStore: {
      clear: () => {
        state.clear()
        state.isValid = false
        state.record = null
      },
      get isValid() { return state.isValid },
      get record() { return state.record },
    },
  },
}))

import { identityKind, sessionFromRecord, loginAny, LoginError, STUDENT_REFUSED_MESSAGE } from './session'

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

/** Fait réussir l'authentification et dépose `record` dans le magasin, comme le SDK. */
function authSucceeds(record: unknown) {
  state.authWithPassword.mockImplementation(async () => {
    state.isValid = true
    state.record = record
  })
}

describe('loginAny', () => {
  beforeEach(() => {
    state.authWithPassword.mockReset()
    state.collection.mockReset()
    state.clear.mockReset()
    state.isValid = false
    state.record = null
  })

  it('un identifiant avec @ passe par _superusers, tout autre par users', async () => {
    authSucceeds({ collectionName: '_superusers', id: 's', email: 'a@b.c' })
    await loginAny('a@b.c', 'pw')
    expect(state.collection).toHaveBeenLastCalledWith('_superusers')

    authSucceeds({ collectionName: 'users', id: 'p', username: 'prof', role: 'prof' })
    await loginAny('prof', 'pw')
    expect(state.collection).toHaveBeenLastCalledWith('users')
  })

  it('refuse un élève et vide le magasin', async () => {
    authSucceeds({ collectionName: 'users', id: 'e', username: 'eleve', role: 'eleve' })
    const attempt = loginAny('eleve', 'secret-pw')
    await expect(attempt).rejects.toBeInstanceOf(LoginError)
    await expect(attempt).rejects.toThrow(STUDENT_REFUSED_MESSAGE)
    expect(state.clear).toHaveBeenCalledTimes(1)
  })

  it('refuse une session illisible (enregistrement absent ou rôle inconnu) et vide le magasin', async () => {
    authSucceeds(null)
    await expect(loginAny('prof', 'pw')).rejects.toBeInstanceOf(LoginError)
    expect(state.clear).toHaveBeenCalledTimes(1)

    authSucceeds({ collectionName: 'users', id: 'x', username: 'z', role: '???' })
    await expect(loginAny('prof', 'pw')).rejects.toBeInstanceOf(LoginError)
    expect(state.clear).toHaveBeenCalledTimes(2)
  })

  it.each([
    [0, 'Serveur injoignable. Vérifiez votre connexion.'],
    [400, 'Identifiant ou mot de passe incorrect.'],
    [500, 'La connexion a échoué (erreur 500).'],
  ])('traduit une erreur du SDK de statut %i, sans écho de l’identifiant ni du mot de passe', async (status, message) => {
    // L'erreur brute du SDK peut contenir la requête : elle ne doit jamais ressortir.
    state.authWithPassword.mockRejectedValue(Object.assign(new Error('requête mon-identifiant / mot-de-passe-secret'), { status }))
    const error = await loginAny('mon-identifiant', 'mot-de-passe-secret').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(LoginError)
    expect((error as LoginError).message).toBe(message)
    expect((error as LoginError).message).not.toContain('mot-de-passe-secret')
    expect((error as LoginError).message).not.toContain('mon-identifiant')
  })

  it('renvoie la session d’un prof et d’un admin sans vider le magasin', async () => {
    authSucceeds({ collectionName: 'users', id: 'p', username: 'prof', role: 'prof' })
    await expect(loginAny('prof', 'pw')).resolves.toEqual({ kind: 'prof', id: 'p', username: 'prof' })
    authSucceeds({ collectionName: '_superusers', id: 's', email: 'a@b.c' })
    await expect(loginAny('a@b.c', 'pw')).resolves.toEqual({ kind: 'admin', email: 'a@b.c' })
    expect(state.clear).not.toHaveBeenCalled()
  })
})
