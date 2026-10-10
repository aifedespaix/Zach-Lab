import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

const api = vi.hoisted(() => ({
  listUsers: vi.fn(), createUser: vi.fn(), setPassword: vi.fn(), deleteUser: vi.fn(),
}))
vi.mock('../gestion/api', async () => {
  const actual = await vi.importActual<typeof import('../gestion/api')>('../gestion/api')
  return { ...actual, ...api }
})
vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, currentSession: () => ({ kind: 'prof', id: 'p1', username: 'dupont' }), logout: vi.fn() }
})
import { ElevesPage } from './ElevesPage'

const row = (over: Record<string, string>) => ({
  id: 'x', username: 'x', role: 'eleve', teacher: 'p1', invite_code: '', created: '2026-10-01 10:00:00.000Z', ...over,
})
const PROF = row({ id: 'p1', username: 'dupont', role: 'prof', teacher: '' })
const LEA = row({ id: 'e1', username: 'lea' })

const main = () => within(screen.getByRole('main'))
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const click = (el: HTMLElement) => fireEvent.click(el)

async function open(users: unknown[] = [PROF, LEA]) {
  api.listUsers.mockResolvedValue(users)
  render(<ElevesPage />)
  await main().findByRole('button', { name: 'Créer' })
}
function form() {
  return within(main().getByRole('button', { name: 'Créer' }).closest('form') as HTMLElement)
}

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset())
  api.createUser.mockResolvedValue({})
  api.setPassword.mockResolvedValue({})
  api.deleteUser.mockResolvedValue(undefined)
})

describe('/eleves', () => {
  it('ne liste que les élèves du prof, jamais le prof lui-même ni ceux d’un autre', async () => {
    await open([PROF, LEA, row({ id: 'e2', username: 'autre', teacher: 'p2' })])
    expect(main().getAllByText('lea').length).toBeGreaterThan(0)
    expect(main().queryByText('dupont')).not.toBeInTheDocument()
    expect(main().queryByText('autre')).not.toBeInTheDocument()
  })

  it('crée un élève rattaché au prof de la session', async () => {
    await open()
    type(form().getByLabelText(/^Identifiant/), 'paul')
    type(form().getByLabelText(/^Mot de passe/), 'motdepasse12')
    click(main().getByRole('button', { name: 'Créer' }))
    await main().findByRole('status')
    expect(api.createUser).toHaveBeenCalledTimes(1)
    expect(api.createUser).toHaveBeenCalledWith({ username: 'paul', password: 'motdepasse12', role: 'eleve', teacher: 'p1' })
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })

  it('refuse un mot de passe trop court ou un identifiant invalide sans appeler l’API', async () => {
    await open()
    type(form().getByLabelText(/^Identifiant/), 'paul')
    type(form().getByLabelText(/^Mot de passe/), 'court')
    click(main().getByRole('button', { name: 'Créer' }))
    expect(await main().findByText('Le mot de passe doit faire au moins 10 caractères.')).toBeInTheDocument()
    type(form().getByLabelText(/^Identifiant/), 'pa ul')
    type(form().getByLabelText(/^Mot de passe/), 'motdepasse12')
    click(main().getByRole('button', { name: 'Créer' }))
    expect(await main().findByText(/^Identifiant : 1 à 64/)).toBeInTheDocument()
    expect(api.createUser).not.toHaveBeenCalled()
  })

  it('affiche le mot de passe une seule fois après la création', async () => {
    await open()
    type(form().getByLabelText(/^Identifiant/), 'paul')
    type(form().getByLabelText(/^Mot de passe/), 'motdepasse12')
    click(main().getByRole('button', { name: 'Créer' }))
    const status = await main().findByRole('status')
    expect(status).toHaveTextContent('motdepasse12')
    expect(status).toHaveTextContent('Notez-le : il ne sera plus affiché.')
    expect((form().getByLabelText(/^Mot de passe/) as HTMLInputElement).value).toBe('')
  })

  it('« Générer » remplit un mot de passe de 12 caractères', async () => {
    await open()
    click(main().getByRole('button', { name: 'Générer' }))
    const value = (form().getByLabelText(/^Mot de passe/) as HTMLInputElement).value
    expect(value).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(value).not.toMatch(/[0OIl1]/)
  })

  it('supprime en deux temps et réinitialise un mot de passe affiché une fois', async () => {
    await open()
    click(main().getAllByRole('button', { name: 'Supprimer' })[0])
    expect(api.deleteUser).not.toHaveBeenCalled()
    click(main().getAllByRole('button', { name: /^Confirmer/ })[0])
    await vi.waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith('e1'))

    type(main().getAllByLabelText('Nouveau mot de passe de lea')[0], 'nouveaumdp123')
    click(main().getAllByRole('button', { name: 'Réinitialiser' })[0])
    const status = await main().findByRole('status')
    expect(api.setPassword).toHaveBeenCalledWith('e1', 'nouveaumdp123')
    expect(status).toHaveTextContent('nouveaumdp123')
  })

  it('affiche un état vide sans élève', async () => {
    await open([PROF])
    expect(main().getByText('Aucun élève')).toBeInTheDocument()
  })

  it('propose de réessayer quand le chargement échoue', async () => {
    api.listUsers.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([PROF, LEA])
    render(<ElevesPage />)
    click(await main().findByRole('button', { name: 'Réessayer' }))
    expect((await main().findAllByText('lea')).length).toBeGreaterThan(0)
  })
})
