import type { RecordModel } from 'pocketbase'
import { describe, it, expect } from 'vitest'
import { INVITE_ALPHABET, INVITE_LENGTH } from '../lib/inviteCode'
import { createCode, createUser, describeApiError, setPassword, toPocketBaseDate, type Client } from './api'

const record = (id: string, extra: Record<string, unknown> = {}): RecordModel => ({ id, collectionId: '', collectionName: '', ...extra })

interface Call { collection: string; method: string; args: unknown[] }

/** Faux client : enregistre chaque appel ; `createErrors` fait échouer les premiers `create`. */
function fakeClient(createErrors: unknown[] = []) {
  const calls: Call[] = []
  const errors = [...createErrors]
  const client: Client = {
    collection: name => ({
      getFullList: async (...args) => { calls.push({ collection: name, method: 'getFullList', args }); return [] },
      create: async (...args) => {
        calls.push({ collection: name, method: 'create', args })
        const error = errors.shift()
        if (error !== undefined) throw error
        return record('new', args[0])
      },
      update: async (...args) => { calls.push({ collection: name, method: 'update', args }); return record(args[0]) },
      delete: async (...args) => { calls.push({ collection: name, method: 'delete', args }); return true },
    }),
  }
  return { client, calls }
}

describe('createUser / setPassword', () => {
  it('createUser confirme le mot de passe et vide le prof d’un prof', async () => {
    const { client, calls } = fakeClient()
    await createUser({ username: 'p', password: 'secret123', role: 'prof', teacher: 'T' }, client)
    expect(calls[0].args[0]).toMatchObject({ password: 'secret123', passwordConfirm: 'secret123', role: 'prof', teacher: '' })
  })
  it('createUser garde le prof d’un élève', async () => {
    const { client, calls } = fakeClient()
    await createUser({ username: 'e', password: 'secret123', role: 'eleve', teacher: 'T' }, client)
    expect(calls[0].args[0]).toMatchObject({ role: 'eleve', teacher: 'T' })
  })
  it('setPassword envoie password et passwordConfirm', async () => {
    const { client, calls } = fakeClient()
    await setPassword('id1', 'nouveau123', client)
    expect(calls[0]).toMatchObject({ method: 'update', args: ['id1', { password: 'nouveau123', passwordConfirm: 'nouveau123' }] })
  })
})

describe('createCode', () => {
  it('envoie un code de l’alphabet, expires_at seulement pour « duree »', async () => {
    const a = fakeClient()
    await createCode({ kind: 'unique', expiresAt: '2026-10-20 00:00:00.000Z', note: 'n' }, a.client)
    const body = a.calls[0].args[0] as Record<string, unknown>
    expect(String(body.code)).toHaveLength(INVITE_LENGTH)
    expect([...String(body.code)].every(c => INVITE_ALPHABET.includes(c))).toBe(true)
    expect(body.kind).toBe('unique')
    expect('expires_at' in body).toBe(false)

    const b = fakeClient()
    await createCode({ kind: 'duree', expiresAt: '2026-10-20 00:00:00.000Z', note: '' }, b.client)
    expect(b.calls[0].args[0]).toMatchObject({ kind: 'duree', expires_at: '2026-10-20 00:00:00.000Z' })
  })
  it('retente après un 400 avec un autre tirage', async () => {
    const { client, calls } = fakeClient([{ status: 400 }])
    await createCode({ kind: 'unique', expiresAt: '', note: '' }, client)
    expect(calls).toHaveLength(2)
  })
  it('relance le dernier 400 après 3 essais', async () => {
    const last = { status: 400, tag: 'dernier' }
    const { client, calls } = fakeClient([{ status: 400 }, { status: 400 }, last])
    await expect(createCode({ kind: 'unique', expiresAt: '', note: '' }, client)).rejects.toBe(last)
    expect(calls).toHaveLength(3)
  })
  it('relance tout de suite une erreur autre que 400', async () => {
    const boom = { status: 500 }
    const { client, calls } = fakeClient([boom])
    await expect(createCode({ kind: 'unique', expiresAt: '', note: '' }, client)).rejects.toBe(boom)
    expect(calls).toHaveLength(1)
  })
})

describe('toPocketBaseDate / expiration', () => {
  it('convertit une valeur datetime-local (heure locale) au format PocketBase', () => {
    const out = toPocketBaseDate('2026-10-20T14:30')
    expect(out).toBe(new Date('2026-10-20T14:30').toISOString().replace('T', ' '))
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
  it('laisse passer une date déjà au format PocketBase', () => {
    expect(toPocketBaseDate('2026-10-20 00:00:00.000Z')).toBe('2026-10-20 00:00:00.000Z')
  })
  it('convertit exactement une date PocketBase en UTC', () => {
    expect(toPocketBaseDate('2026-10-20 00:00:00.000Z')).toBe('2026-10-20 00:00:00.000Z')
  })
  it('lit la forme à espace sans fuseau comme heure locale', () => {
    expect(toPocketBaseDate('2026-10-20 14:30:00')).toBe(new Date('2026-10-20T14:30:00').toISOString().replace('T', ' '))
  })
  it('refuse une chaîne vide', () => {
    expect(() => toPocketBaseDate('')).toThrow('Date d’expiration invalide.')
  })
  it('ignore les espaces autour de la valeur', () => {
    expect(toPocketBaseDate(' 2026-10-20T14:30 ')).toBe(new Date('2026-10-20T14:30').toISOString().replace('T', ' '))
  })
  it('refuse une date illisible', () => {
    expect(() => toPocketBaseDate('demain')).toThrow('Date d’expiration invalide.')
  })
  it('createCode « duree » avec une date illisible ne fait aucune requête', async () => {
    const { client, calls } = fakeClient()
    await expect(createCode({ kind: 'duree', expiresAt: 'demain', note: '' }, client)).rejects.toThrow('Date d’expiration invalide.')
    expect(calls.filter(c => c.method === 'create')).toHaveLength(0)
  })
  it('createCode « duree » envoie la date convertie', async () => {
    const { client, calls } = fakeClient()
    await createCode({ kind: 'duree', expiresAt: '2026-10-20T14:30', note: '' }, client)
    expect(calls[0].args[0]).toMatchObject({ expires_at: new Date('2026-10-20T14:30').toISOString().replace('T', ' ') })
  })
  it('createCode « unique » n’envoie pas expires_at, même avec une date illisible', async () => {
    const { client, calls } = fakeClient()
    await createCode({ kind: 'unique', expiresAt: 'demain', note: '' }, client)
    expect('expires_at' in (calls[0].args[0] as object)).toBe(false)
  })
})

describe('describeApiError', () => {
  it('traduit les erreurs de champ', () => {
    expect(describeApiError({ status: 400, response: { data: { username: { message: 'x' } } } })).toBe('Identifiant : x')
  })
  it('traduit les codes PocketBase connus', () => {
    const err = (key: string, code: string) => ({ status: 400, response: { data: { [key]: { code, message: 'Invalid value.' } } } })
    expect(describeApiError(err('oldPassword', 'validation_invalid_old_password'))).toBe('Mot de passe actuel : incorrect')
    expect(describeApiError(err('username', 'validation_not_unique'))).toBe('Identifiant : déjà utilisé')
  })
  it('règles de l’ancien mot de passe et codes de validation', () => {
    const err = (key: string, code: string) => ({ status: 400, response: { data: { [key]: { code, message: 'Some English text.' } } } })
    expect(describeApiError(err('oldPassword', 'validation_zzz'))).toBe('Mot de passe actuel : incorrect')
    expect(describeApiError(err('oldPassword', 'validation_required'))).toBe('Mot de passe actuel : obligatoire')
    expect(describeApiError(err('username', 'validation_invalid_username'))).toBe('Identifiant : invalide (lettres, chiffres, point, tiret et underscore)')
    expect(describeApiError(err('password', 'validation_length_out_of_range'))).toBe('Nouveau mot de passe : longueur incorrecte')
    expect(describeApiError(err('password', 'validation_values_mismatch'))).toBe('Nouveau mot de passe : les deux mots de passe diffèrent')
  })
  it('code inconnu : texte du serveur ; champ inconnu : clé brute', () => {
    expect(describeApiError({ status: 400, response: { data: { username: { code: 'validation_zzz', message: 'Bizarre.' } } } })).toBe('Identifiant : Bizarre.')
    expect(describeApiError({ status: 400, response: { data: { autre: { code: 'validation_not_unique', message: 'm' } } } })).toBe('autre : déjà utilisé')
  })
  it('serveur injoignable, accès refusé, repli', () => {
    expect(describeApiError({ status: 0 })).toBe('Serveur injoignable.')
    expect(describeApiError({ status: 401 })).toBe('Accès refusé : reconnectez-vous.')
    expect(describeApiError({ status: 500 })).toBe('Erreur 500.')
  })
})
