import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const loginAny = vi.fn()
vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, loginAny: (...args: unknown[]) => loginAny(...args), currentSession: () => null }
})
import { InscriptionPage } from './InscriptionPage'

const fetchMock = vi.fn()

beforeEach(() => {
  loginAny.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(window, 'location', { value: { replace: vi.fn(), search: '' }, writable: true })
})

async function fill(code = 'abcde fghjk') {
  await userEvent.type(screen.getByLabelText('Code d’inscription'), code)
  await userEvent.type(screen.getByLabelText('Identifiant'), 'prof.dupont')
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'unmotdepasse1')
  await userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'unmotdepasse1')
  await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
}

describe('InscriptionPage', () => {
  it('envoie le code normalisé puis connecte et redirige', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    loginAny.mockResolvedValue({ kind: 'prof', id: '1', username: 'prof.dupont' })
    render(<InscriptionPage />)
    await fill()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/inscription')
    expect(JSON.parse(init.body)).toEqual({ code: 'ABCDEFGHJK', username: 'prof.dupont', password: 'unmotdepasse1' })
    expect(loginAny).toHaveBeenCalledWith('prof.dupont', 'unmotdepasse1')
    expect(window.location.replace).toHaveBeenCalledWith('/dashboard/')
  })

  it('affiche le message du serveur pour un 400', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Code invalide ou expiré."}', { status: 400 }))
    render(<InscriptionPage />)
    await fill()
    expect(await screen.findByText('Code invalide ou expiré.')).toBeInTheDocument()
    expect(window.location.replace).not.toHaveBeenCalled()
  })

  it('affiche un message précis pour un 429', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }))
    render(<InscriptionPage />)
    await fill()
    expect(await screen.findByText('Trop de tentatives. Réessayez dans une minute.')).toBeInTheDocument()
  })

  it('affiche un message générique pour les autres statuts', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))
    render(<InscriptionPage />)
    await fill()
    expect(await screen.findByText('L’inscription a échoué (erreur 500).')).toBeInTheDocument()
  })

  it('préremplit le code depuis ?code= sans planter sur un échappement mal formé', () => {
    Object.defineProperty(window, 'location', { value: { replace: vi.fn(), search: '?code=%E0%A4%A' }, writable: true })
    expect(() => render(<InscriptionPage />)).not.toThrow()
  })
})
