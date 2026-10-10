import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const loginAny = vi.fn()
vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, loginAny: (...args: unknown[]) => loginAny(...args), currentSession: () => null }
})
import { LoginPage } from './LoginPage'
import { LoginError } from '../session/session'

beforeEach(() => {
  loginAny.mockReset()
  Object.defineProperty(window, 'location', { value: { replace: vi.fn(), search: '' }, writable: true })
})

describe('LoginPage', () => {
  it("redirige un prof vers son accueil", async () => {
    loginAny.mockResolvedValue({ kind: 'prof', id: '1', username: 'p' })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Identifiant'), 'p')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(window.location.replace).toHaveBeenCalledWith('/dashboard/')
  })

  it("affiche le refus d'un compte élève sans planter", async () => {
    loginAny.mockRejectedValue(new LoginError('Les comptes élèves se connectent dans l’application de bureau, pas sur le site.'))
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Identifiant'), 'e')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByText(/application de bureau/)).toBeInTheDocument()
    expect(window.location.replace).not.toHaveBeenCalled()
  })

  it('propose le lien « j’ai un code »', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: /j’ai un code/i })).toHaveAttribute('href', '/inscription/')
  })
})
