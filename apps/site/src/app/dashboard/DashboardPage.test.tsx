import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const h = vi.hoisted(() => ({
  getList: vi.fn(),
  getFullList: vi.fn(),
  listUsers: vi.fn(),
  listCodes: vi.fn(),
  collection: vi.fn(),
  session: { kind: 'prof', id: 'p1', username: 'dupont' } as unknown,
}))
vi.mock('../session/pb', () => ({ pb: { collection: h.collection } }))
vi.mock('../gestion/api', async () => {
  const actual = await vi.importActual<typeof import('../gestion/api')>('../gestion/api')
  return { ...actual, listUsers: h.listUsers, listCodes: h.listCodes }
})
vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, currentSession: () => h.session, logout: vi.fn() }
})
import { DashboardPage } from './DashboardPage'

const NOW = Date.parse('2026-10-10T12:00:00.000Z')
const user = (over: Record<string, string>) => ({
  id: 'x', username: 'x', role: 'eleve', teacher: 'p1', invite_code: '', created: '2026-10-01 10:00:00.000Z', ...over,
})
const USERS = [
  user({ id: 'p1', username: 'dupont', role: 'prof', teacher: '' }),
  user({ id: 'e1', username: 'lea' }),
  user({ id: 'e2', username: 'tom' }),
  user({ id: 'e3', username: 'autre', teacher: 'p2' }),
]
const EVENTS = [
  { username: 'lea', level: 'error', created: '2026-10-10 09:00:00.000Z' },
  { username: 'lea', level: 'info', created: '2026-10-09 09:00:00.000Z' },
  { username: 'autre', level: 'info', created: '2026-10-10 11:59:00.000Z' },
]
const CONFLICTS = [
  { username: 'lea', status: 'open' }, { username: 'lea', status: 'open' }, { username: 'autre', status: 'open' },
]

const main = () => within(screen.getByRole('main'))
/** Valeur d'une tuile : le libellé de tuile est un <p>, ceux du tableau sont des <th>/<span>. */
const tile = (label: string) => main().getAllByText(label).find(el => el.tagName === 'P')!.nextElementSibling
const hrefs = () => main().getAllByRole('link').map(a => a.getAttribute('href'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  Object.values(h).forEach(v => { if (typeof v === 'function') (v as ReturnType<typeof vi.fn>).mockReset() })
  h.session = { kind: 'prof', id: 'p1', username: 'dupont' }
  h.listUsers.mockResolvedValue(USERS)
  h.listCodes.mockResolvedValue([])
  h.getList.mockResolvedValue({ items: EVENTS })
  h.getFullList.mockResolvedValue(CONFLICTS)
  h.collection.mockImplementation((name: string) => ({ getList: h.getList, getFullList: h.getFullList, name }))
})
afterEach(() => vi.useRealTimers())

describe('/dashboard — prof', () => {
  it('calcule les tuiles et les lignes à partir de SES élèves seulement', async () => {
    render(<DashboardPage />)
    await main().findByRole('link', { name: /Conflits à résoudre/ })
    // 2 élèves (pas « autre », élève d'un autre prof) ; 2 conflits ouverts (pas celui de « autre »).
    expect(tile('Élèves')).toHaveTextContent('2')
    expect(tile('Conflits ouverts')).toHaveTextContent('2')
    expect(tile('Dernière synchro')).toHaveTextContent('il y a 3 h')
    expect(main().queryByText('autre')).not.toBeInTheDocument()
    expect(main().getAllByText('lea').length).toBeGreaterThan(0)
    expect(main().getAllByText('tom').length).toBeGreaterThan(0)
    // lea : dernière synchro il y a 3 h, niveau erreur ; tom : jamais, pas de niveau.
    expect(main().getAllByText('il y a 3 h').length).toBeGreaterThan(1)
    expect(main().getAllByText('Erreur').length).toBeGreaterThan(0)
    expect(main().getAllByText('jamais').length).toBeGreaterThan(0)
  })

  it('interroge les événements (500 récents) et seulement les conflits ouverts', async () => {
    render(<DashboardPage />)
    await main().findByRole('link', { name: /Conflits à résoudre/ })
    expect(h.collection).toHaveBeenCalledWith('sync_events')
    expect(h.getList).toHaveBeenCalledWith(1, 500, { sort: '-created' })
    expect(h.collection).toHaveBeenCalledWith('sync_conflicts')
    expect(h.getFullList).toHaveBeenCalledWith({ filter: 'status = "open"' })
  })

  it('liens exacts, avec le nombre de conflits en pastille', async () => {
    render(<DashboardPage />)
    await main().findByRole('link', { name: /Conflits à résoudre/ })
    expect(hrefs()).toEqual(['/eleves/', '/bibliotheque/#/conflits', '/compte/'])
    const conflits = main().getByRole('link', { name: /Conflits à résoudre/ })
    expect(within(conflits).getByText('2')).toBeInTheDocument()
  })

  it('sans conflit, pas de pastille', async () => {
    h.getFullList.mockResolvedValue([])
    render(<DashboardPage />)
    await main().findByRole('link', { name: /Conflits à résoudre/ })
    const conflits = main().getByRole('link', { name: /Conflits à résoudre/ })
    expect(conflits).toHaveTextContent(/^Conflits à résoudre$/)
  })

  it('une collection absente (404) affiche une bannière sans masquer le reste', async () => {
    h.getList.mockRejectedValue({ status: 404 })
    render(<DashboardPage />)
    expect(await main().findByText(/Synchronisations : la collection n’existe pas encore/)).toBeInTheDocument()
    expect(tile('Élèves')).toHaveTextContent('2')
    expect(main().getAllByText('lea').length).toBeGreaterThan(0)
    expect(tile('Dernière synchro')).toHaveTextContent('jamais')
    expect(hrefs()).toContain('/eleves/')
  })
})

describe('/dashboard — admin', () => {
  beforeEach(() => {
    h.session = { kind: 'admin', email: 'a@b.fr' }
    h.listUsers.mockResolvedValue([
      user({ id: 'p1', username: 'dupont', role: 'prof', teacher: '', invite_code: 'CODEA' }),
      user({ id: 'e1', username: 'lea' }),
      user({ id: 'e2', username: 'tom' }),
    ])
    h.listCodes.mockResolvedValue([
      { id: 'c1', code: 'CODEA', kind: 'unique', expires_at: '', revoked: false, note: '', created: '2026-10-01 10:00:00.000Z' },
      { id: 'c2', code: 'CODEB', kind: 'unique', expires_at: '', revoked: false, note: '', created: '2026-10-02 10:00:00.000Z' },
    ])
  })

  it('montre profs, élèves, codes actifs et le lien /gestion/, rien du côté prof', async () => {
    render(<DashboardPage />)
    await main().findByText('Codes actifs')
    expect(tile('Profs')).toHaveTextContent('1')
    expect(tile('Élèves')).toHaveTextContent('2')
    // CODEA est utilisé par le prof, CODEB reste actif.
    expect(tile('Codes actifs')).toHaveTextContent('1')
    expect(hrefs()).toEqual(['/gestion/'])
    expect(main().queryByText('Conflits ouverts')).not.toBeInTheDocument()
    expect(h.collection).not.toHaveBeenCalled()
  })
})
