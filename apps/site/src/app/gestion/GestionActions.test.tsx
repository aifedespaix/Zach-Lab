import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

const api = vi.hoisted(() => ({
  listUsers: vi.fn(), listCodes: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), setPassword: vi.fn(),
  deleteUser: vi.fn(), createCode: vi.fn(), revokeCode: vi.fn(), deleteCode: vi.fn(),
}))
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, ...api }
})
vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, currentSession: () => ({ kind: 'admin', email: 'admin@test.local' }), logout: vi.fn() }
})
import { GestionPage } from './GestionPage'

const user = (over: Record<string, string>) => ({
  id: 'x', username: 'x', role: 'eleve', teacher: '', invite_code: '', created: '2026-10-01 10:00:00.000Z', ...over,
})
const PROF = user({ id: 'p1', username: 'dupont', role: 'prof' })

const main = () => within(screen.getByRole('main'))
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const click = (el: HTMLElement) => fireEvent.click(el)

async function open(tab?: string, users: unknown[] = [PROF]) {
  api.listUsers.mockResolvedValue(users)
  render(<GestionPage />)
  await screen.findByRole('tablist')
  await main().findAllByRole('button', { name: 'Ajouter' })
  if (tab !== undefined) click(screen.getByRole('tab', { name: tab }))
}

function fillAccount(username: string, password: string) {
  // Dans le formulaire d'ajout seulement : les lignes ont aussi des champs « Identifiant de … ».
  const form = within(main().getByRole('button', { name: 'Ajouter' }).closest('form') as HTMLElement)
  type(form.getByLabelText(/^Identifiant/), username)
  type(form.getByLabelText(/^Mot de passe/), password)
}

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset())
  api.listCodes.mockResolvedValue([])
  api.createUser.mockResolvedValue({})
  api.createCode.mockResolvedValue({ code: 'ABCDEFGHJK' })
  Object.defineProperty(window, 'location', { value: { replace: vi.fn(), origin: 'http://localhost' }, writable: true })
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('élève sans prof', () => {
  it('refuse sans prof choisi, puis crée avec le prof choisi', async () => {
    await open('Élèves')
    fillAccount('alice', 'motdepasse12')
    click(main().getByRole('button', { name: 'Ajouter' }))
    expect(await main().findByText('Choisissez le professeur de cet élève.')).toBeInTheDocument()
    expect(api.createUser).not.toHaveBeenCalled()

    type(main().getByLabelText('Professeur'), 'p1')
    click(main().getByRole('button', { name: 'Ajouter' }))
    await vi.waitFor(() => expect(api.createUser).toHaveBeenCalledTimes(1))
    expect(api.createUser).toHaveBeenCalledWith({ username: 'alice', password: 'motdepasse12', role: 'eleve', teacher: 'p1' })
  })

  it('sans aucun prof, le formulaire d’ajout n’est pas proposé', async () => {
    api.listUsers.mockResolvedValue([])
    render(<GestionPage />)
    await screen.findByRole('tablist')
    await main().findAllByRole('button', { name: 'Ajouter' })
    click(screen.getByRole('tab', { name: 'Élèves' }))
    expect(await main().findByText('Aucun professeur')).toBeInTheDocument()
    expect(main().queryByRole('button', { name: 'Ajouter' })).toBeNull()
  })
})

describe('rattachement et renommage', () => {
  const STUDENT = user({ id: 'e1', username: 'alice', role: 'eleve', teacher: '' })

  it('élève sans prof et un seul prof : « — aucun — » est choisi, et choisir le prof rattache', async () => {
    api.updateUser.mockResolvedValue({})
    await open('Élèves', [PROF, STUDENT])
    const select = main().getAllByLabelText('Prof de alice')[0] as HTMLSelectElement
    expect(select.selectedOptions[0]).toHaveTextContent('— aucun —')
    type(select, 'p1')
    await vi.waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('e1', { teacher: 'p1' }))
  })

  it('une ligne d’élève n’a aucun contrôle de renommage', async () => {
    await open('Élèves', [PROF, { ...STUDENT, teacher: 'p1' }])
    expect(main().queryByLabelText('Identifiant de alice')).toBeNull()
    expect(main().queryByRole('button', { name: 'Renommer' })).toBeNull()
  })

  it('une ligne de prof garde le renommage et son avertissement', async () => {
    await open('Profs')
    expect(main().getAllByLabelText('Identifiant de dupont').length).toBeGreaterThan(0)
    expect(main().getAllByRole('button', { name: 'Renommer' }).length).toBeGreaterThan(0)
    expect(main().getAllByText('Les cartes déjà publiées gardent l’ancien identifiant comme auteur.').length).toBeGreaterThan(0)
  })
})

describe('validation des comptes', () => {
  it.each([
    ['mot de passe de 9 caractères', 'alice', '123456789', 'au moins 10 caractères'],
    ['identifiant avec espace', 'al ice', 'motdepasse12', '1 à 64 caractères'],
    ['identifiant avec barre oblique', 'al/ice', 'motdepasse12', '1 à 64 caractères'],
  ])('refuse un %s', async (_name, username, password, message) => {
    await open()
    fillAccount(username, password)
    click(main().getByRole('button', { name: 'Ajouter' }))
    expect(await main().findByText(new RegExp(message))).toBeInTheDocument()
    expect(api.createUser).not.toHaveBeenCalled()
  })

  it('crée un prof valide puis recharge', async () => {
    await open()
    const before = api.listUsers.mock.calls.length
    fillAccount('martin', 'motdepasse12')
    click(main().getByRole('button', { name: 'Ajouter' }))
    await vi.waitFor(() => expect(api.listUsers.mock.calls.length).toBeGreaterThan(before))
    expect(api.createUser).toHaveBeenCalledWith({ username: 'martin', password: 'motdepasse12', role: 'prof', teacher: '' })
  })
})

describe('code créé', () => {
  it('crée un code unique, l’affiche formaté avec lien, et le copie', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await open('Codes')
    click(main().getByRole('button', { name: 'Créer le code' }))
    const notice = await main().findByRole('status')
    expect(api.createCode).toHaveBeenCalledWith(expect.objectContaining({ kind: 'unique' }))
    expect(within(notice).getByText('ABCDE-FGHJK')).toBeInTheDocument()
    expect(within(notice).getByText('http://localhost/inscription/?code=ABCDEFGHJK')).toBeInTheDocument()
    click(within(notice).getByRole('button', { name: 'Copier' }))
    expect(writeText).toHaveBeenCalledWith('http://localhost/inscription/?code=ABCDEFGHJK')
  })

  it('Copier sans presse-papiers ne plante pas', async () => {
    await open('Codes')
    click(main().getByRole('button', { name: 'Créer le code' }))
    const notice = await main().findByRole('status')
    expect(navigator.clipboard).toBeUndefined()
    expect(() => click(within(notice).getByRole('button', { name: 'Copier' }))).not.toThrow()
    expect(main().getByRole('button', { name: 'Créer le code' })).toBeEnabled()
  })
})

describe('date d’expiration', () => {
  const choose = (value: string) => {
    type(main().getByLabelText('Type'), 'duree')
    type(main().getByLabelText('Expire le'), value)
    click(main().getByRole('button', { name: 'Créer le code' }))
  }

  it('refuse une date passée', async () => {
    await open('Codes')
    choose('2020-01-01T10:00')
    expect(await main().findByText('La date d’expiration est déjà passée.')).toBeInTheDocument()
    expect(api.createCode).not.toHaveBeenCalled()
  })

  it('transmet telle quelle une date future', async () => {
    await open('Codes')
    choose('2999-01-01T10:00')
    await vi.waitFor(() => expect(api.createCode).toHaveBeenCalledTimes(1))
    expect(api.createCode).toHaveBeenCalledWith({ kind: 'duree', expiresAt: '2999-01-01T10:00', note: '' })
  })
})

describe('mot de passe réinitialisé', () => {
  it('l’affiche une fois avec la consigne, et vide le champ', async () => {
    api.setPassword.mockResolvedValue({})
    await open()
    const input = main().getAllByLabelText('Nouveau mot de passe de dupont')[0]
    type(input, 'nouveaumdp123')
    click(main().getAllByRole('button', { name: 'Réinitialiser' })[0])
    const notice = await main().findByRole('status')
    expect(api.setPassword).toHaveBeenCalledWith('p1', 'nouveaumdp123')
    expect(within(notice).getByText('nouveaumdp123')).toBeInTheDocument()
    expect(within(notice).getByText('Notez-le : il ne sera plus affiché.')).toBeInTheDocument()
    expect(main().getAllByLabelText('Nouveau mot de passe de dupont')[0]).toHaveValue('')
  })
})

describe('erreurs d’action', () => {
  const attempt = async (error: unknown) => {
    api.createUser.mockRejectedValue(error)
    await open()
    fillAccount('martin', 'motdepasse12')
    click(main().getByRole('button', { name: 'Ajouter' }))
  }

  it('status 0 : serveur injoignable', async () => {
    await attempt({ status: 0 })
    expect(await main().findByText('Serveur injoignable.')).toBeInTheDocument()
  })

  it('status 403 : accès refusé', async () => {
    await attempt({ status: 403 })
    expect(await main().findByText('Accès refusé : reconnectez-vous.')).toBeInTheDocument()
  })

  it('erreur locale : son message est conservé', async () => {
    await attempt(new Error('Date d’expiration invalide.'))
    expect(await main().findByText('Date d’expiration invalide.')).toBeInTheDocument()
  })
})
