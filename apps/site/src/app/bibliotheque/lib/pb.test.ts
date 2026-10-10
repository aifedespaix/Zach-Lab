import { afterEach, describe, expect, it } from 'vitest'
import { pb as sitePb } from '../../session/pb'
import { currentUser, describeApiError, pb } from './pb'

/** Un JWT non signé mais bien formé et non expiré : le SDK ne regarde que `exp`. */
function fakeToken(): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'none' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
}

afterEach(() => pb.authStore.clear())

describe('bibliotheque/lib/pb', () => {
  it('ré-exporte le client unique du site', () => {
    expect(pb).toBe(sitePb)
  })

  it('currentUser est null sans session', () => {
    expect(currentUser()).toBeNull()
  })

  it('currentUser lit le profil du prof connecté', () => {
    pb.authStore.save(fakeToken(), { id: 'p1', collectionId: 'c', collectionName: 'users', username: 'aife', role: 'prof' })
    expect(currentUser()).toEqual({ id: 'p1', username: 'aife', role: 'prof' })
  })

  it('describeApiError garde ses messages', () => {
    expect(describeApiError({ status: 0 }, 'Lecture')).toBe('Lecture : serveur injoignable.')
    expect(describeApiError({ status: 403 }, 'Lecture')).toBe('Lecture : accès refusé par le serveur.')
    expect(describeApiError({ status: 404 }, 'Lecture')).toContain('collection absente du serveur')
    expect(describeApiError(Object.assign(new Error('boum'), { status: 500 }), 'Lecture')).toBe('Lecture : erreur 500 (boum).')
  })
})
