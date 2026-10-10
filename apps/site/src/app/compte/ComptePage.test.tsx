import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  update: vi.fn(),
  loginAny: vi.fn(),
  logout: vi.fn(),
  session: { kind: 'prof', id: 'p1', username: 'dupont' } as unknown,
}))
vi.mock('../session/pb', () => ({ pb: { collection: vi.fn(() => ({ update: h.update })) } }))
vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, currentSession: () => h.session, loginAny: h.loginAny, logout: h.logout }
})
import { pb } from '../session/pb'
import { ComptePage } from './ComptePage'

const main = () => within(screen.getByRole('main'))
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

beforeEach(() => {
  h.update.mockReset().mockResolvedValue({})
  h.loginAny.mockReset().mockResolvedValue({})
  h.logout.mockReset()
  h.session = { kind: 'prof', id: 'p1', username: 'dupont' }
  vi.mocked(pb.collection).mockClear()
})

describe('/compte — prof', () => {
  it('propose l’identifiant prérempli et les trois champs de mot de passe', () => {
    render(<ComptePage />)
    expect(main().getByLabelText('Identifiant')).toHaveValue('dupont')
    expect(main().getByLabelText('Mot de passe actuel')).toBeInTheDocument()
    expect(main().getByLabelText('Nouveau mot de passe')).toBeInTheDocument()
    expect(main().getByLabelText('Confirmer le nouveau mot de passe')).toBeInTheDocument()
  })

  it('change le mot de passe puis se reconnecte avec le nouveau', async () => {
    render(<ComptePage />)
    type(main().getByLabelText('Mot de passe actuel'), 'ancienmotdepasse')
    type(main().getByLabelText('Nouveau mot de passe'), 'nouveaumotdepasse')
    type(main().getByLabelText('Confirmer le nouveau mot de passe'), 'nouveaumotdepasse')
    fireEvent.click(main().getByRole('button', { name: 'Changer le mot de passe' }))
    await waitFor(() => expect(h.loginAny).toHaveBeenCalledTimes(1))
    expect(pb.collection).toHaveBeenCalledWith('users')
    expect(h.update).toHaveBeenCalledTimes(1)
    expect(h.update).toHaveBeenCalledWith('p1', {
      oldPassword: 'ancienmotdepasse', password: 'nouveaumotdepasse', passwordConfirm: 'nouveaumotdepasse',
    })
    expect(h.loginAny).toHaveBeenCalledWith('dupont', 'nouveaumotdepasse')
  })

  it('refuse un nouveau mot de passe trop court sans rien appeler', async () => {
    render(<ComptePage />)
    type(main().getByLabelText('Mot de passe actuel'), 'ancienmotdepasse')
    type(main().getByLabelText('Nouveau mot de passe'), 'court')
    type(main().getByLabelText('Confirmer le nouveau mot de passe'), 'court')
    fireEvent.click(main().getByRole('button', { name: 'Changer le mot de passe' }))
    expect(await main().findByText('Le mot de passe doit faire au moins 10 caractères.')).toBeInTheDocument()
    expect(h.update).not.toHaveBeenCalled()
    expect(h.loginAny).not.toHaveBeenCalled()
  })

  it('refuse une confirmation différente sans rien appeler', async () => {
    render(<ComptePage />)
    type(main().getByLabelText('Mot de passe actuel'), 'ancienmotdepasse')
    type(main().getByLabelText('Nouveau mot de passe'), 'nouveaumotdepasse')
    type(main().getByLabelText('Confirmer le nouveau mot de passe'), 'autremotdepasse')
    fireEvent.click(main().getByRole('button', { name: 'Changer le mot de passe' }))
    expect(await main().findByRole('alert')).toHaveTextContent('ne correspond pas')
    expect(h.update).not.toHaveBeenCalled()
  })

  it('change l’identifiant', async () => {
    render(<ComptePage />)
    type(main().getByLabelText('Identifiant'), 'durand')
    fireEvent.click(main().getByRole('button', { name: 'Changer l’identifiant' }))
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1))
    expect(h.update).toHaveBeenCalledWith('p1', { username: 'durand' })
    expect(h.loginAny).not.toHaveBeenCalled()
  })

  it('refuse un identifiant invalide sans rien appeler', async () => {
    render(<ComptePage />)
    type(main().getByLabelText('Identifiant'), 'du rand')
    fireEvent.click(main().getByRole('button', { name: 'Changer l’identifiant' }))
    expect(await main().findByRole('alert')).toHaveTextContent('Identifiant')
    expect(h.update).not.toHaveBeenCalled()
  })

  it('affiche en français l’erreur 400 d’un identifiant déjà pris', async () => {
    h.update.mockRejectedValue({ status: 400, response: { data: { username: { code: 'validation_not_unique', message: 'The username is invalid or already in use.' } } } })
    render(<ComptePage />)
    type(main().getByLabelText('Identifiant'), 'durand')
    fireEvent.click(main().getByRole('button', { name: 'Changer l’identifiant' }))
    expect(await main().findByRole('alert')).toHaveTextContent('Identifiant : déjà utilisé')
  })

  it('traduit un ancien mot de passe erroné, garde les champs et ne se reconnecte pas', async () => {
    h.update.mockRejectedValue({ status: 400, response: { data: { oldPassword: { code: 'validation_invalid_old_password', message: 'Invalid value.' } } } })
    render(<ComptePage />)
    type(main().getByLabelText('Mot de passe actuel'), 'mauvaismotdepasse')
    type(main().getByLabelText('Nouveau mot de passe'), 'nouveaumotdepasse')
    type(main().getByLabelText('Confirmer le nouveau mot de passe'), 'nouveaumotdepasse')
    fireEvent.click(main().getByRole('button', { name: 'Changer le mot de passe' }))
    expect(await main().findByRole('alert')).toHaveTextContent('Mot de passe actuel : incorrect')
    expect(h.loginAny).not.toHaveBeenCalled()
    expect(main().getByLabelText('Mot de passe actuel')).toHaveValue('mauvaismotdepasse')
    expect(main().getByLabelText('Nouveau mot de passe')).toHaveValue('nouveaumotdepasse')
  })

  it('mot de passe changé mais reconnexion en échec : message exact, champs vidés, déconnexion puis redirection', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    h.loginAny.mockRejectedValue(new Error('Identifiant ou mot de passe incorrect.'))
    render(<ComptePage />)
    type(main().getByLabelText('Mot de passe actuel'), 'ancienmotdepasse')
    type(main().getByLabelText('Nouveau mot de passe'), 'nouveaumotdepasse')
    type(main().getByLabelText('Confirmer le nouveau mot de passe'), 'nouveaumotdepasse')
    fireEvent.click(main().getByRole('button', { name: 'Changer le mot de passe' }))
    const alert = await main().findByRole('alert')
    expect(alert).toHaveTextContent('Mot de passe modifié, mais la reconnexion a échoué : reconnectez-vous.')
    expect(alert).not.toHaveTextContent('Identifiant ou mot de passe incorrect')
    expect(main().getByLabelText('Mot de passe actuel')).toHaveValue('')
    expect(main().getByLabelText('Nouveau mot de passe')).toHaveValue('')
    expect(main().getByLabelText('Confirmer le nouveau mot de passe')).toHaveValue('')
    expect(h.logout).toHaveBeenCalledTimes(1)
    // La redirection est différée pour laisser lire le message.
    expect(replace).not.toHaveBeenCalled()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login/'), { timeout: 4000 })
    vi.unstubAllGlobals()
  })

  it('se déconnecte', () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    render(<ComptePage />)
    fireEvent.click(main().getByRole('button', { name: 'Se déconnecter' }))
    expect(h.logout).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/login/')
    vi.unstubAllGlobals()
  })
})

describe('/compte — admin', () => {
  beforeEach(() => { h.session = { kind: 'admin', email: 'a@b.fr' } })

  it('n’a aucun champ de mot de passe mais explique où sont les identifiants', () => {
    render(<ComptePage />)
    expect(main().queryByLabelText(/mot de passe/i)).not.toBeInTheDocument()
    expect(main().getByText('Vos identifiants d’administration sont définis dans infra/.env (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD) ; les modifier ici serait annulé au redémarrage du serveur.')).toBeInTheDocument()
    expect(main().getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
    expect(h.update).not.toHaveBeenCalled()
  })
})
