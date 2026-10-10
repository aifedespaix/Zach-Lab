import type { RecordModel } from 'pocketbase'
import { describe, it, expect } from 'vitest'
import { INVITE_ALPHABET, INVITE_LENGTH } from '../lib/inviteCode'
import { createCode, createUser, describeApiError, setPassword, type Client } from './api'

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

describe('describeApiError', () => {
  it('traduit les erreurs de champ', () => {
    expect(describeApiError({ status: 400, response: { data: { username: { message: 'x' } } } })).toBe('username : x')
  })
  it('serveur injoignable, accès refusé, repli', () => {
    expect(describeApiError({ status: 0 })).toBe('Serveur injoignable.')
    expect(describeApiError({ status: 401 })).toBe('Accès refusé : reconnectez-vous.')
    expect(describeApiError({ status: 500 })).toBe('Erreur 500.')
  })
})
