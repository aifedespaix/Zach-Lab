import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset())
  api.listUsers.mockResolvedValue([
    user({ id: 'p1', username: 'dupont', role: 'prof', invite_code: 'BBBBBBBBBB' }),
    user({ id: 'e1', username: 'alice', teacher: 'p1' }),
    user({ id: 'e2', username: 'bob', teacher: 'p1' }),
  ])
  api.listCodes.mockResolvedValue([
    { id: 'c1', code: 'AAAAAAAAAA', kind: 'unique', expires_at: '', revoked: false, note: '', created: '2026-10-02 10:00:00.000Z' },
  ])
  Object.defineProperty(window, 'location', { value: { replace: vi.fn(), origin: 'http://localhost' }, writable: true })
})

const main = () => within(screen.getByRole('main'))

async function ready() {
  render(<GestionPage />)
  await screen.findAllByText('dupont')
}

describe('GestionPage', () => {
  it('propose les trois onglets', async () => {
    await ready()
    for (const name of ['Profs', 'Élèves', 'Codes']) expect(screen.getByRole('tab', { name })).toBeInTheDocument()
  })

  it('montre le prof et son nombre d’élèves', async () => {
    await ready()
    expect(main().getAllByText('dupont').length).toBeGreaterThan(0)
    expect(main().getAllByText('2 élèves').length).toBeGreaterThan(0)
  })

  it('désactive Supprimer tant que le prof a des élèves', async () => {
    await ready()
    const buttons = main().getAllByRole('button', { name: 'Supprimer' })
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', expect.stringContaining('Rattachez ou supprimez d’abord ses 2 élèves'))
    }
  })

  it('affiche le code formaté avec le badge Actif', async () => {
    await ready()
    await userEvent.click(screen.getByRole('tab', { name: 'Codes' }))
    expect(main().getAllByText('AAAAA-AAAAA').length).toBeGreaterThan(0)
    expect(main().getAllByText('Actif').length).toBeGreaterThan(0)
  })

  it('refuse un code « durée » sans date, sans appeler createCode', async () => {
    await ready()
    await userEvent.click(screen.getByRole('tab', { name: 'Codes' }))
    await userEvent.selectOptions(main().getByLabelText('Type'), 'duree')
    await userEvent.click(main().getByRole('button', { name: 'Créer le code' }))
    expect(await main().findByText('Choisissez une date d’expiration.')).toBeInTheDocument()
    expect(api.createCode).not.toHaveBeenCalled()
  })

  it('révoque en deux clics', async () => {
    await ready()
    await userEvent.click(screen.getByRole('tab', { name: 'Codes' }))
    api.revokeCode.mockResolvedValue({})
    await userEvent.click(main().getAllByRole('button', { name: 'Révoquer' })[0])
    expect(api.revokeCode).not.toHaveBeenCalled()
    await userEvent.click(main().getByRole('button', { name: 'Confirmer' }))
    expect(api.revokeCode).toHaveBeenCalledWith('c1')
  })
})
