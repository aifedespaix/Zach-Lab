import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../session/session'

const h = vi.hoisted(() => ({
  session: null as Session | null,
  conflicts: [] as unknown[],
}))

vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, currentSession: () => h.session, logout: vi.fn() }
})
vi.mock('./components/LibraryView', () => ({ LibraryView: () => <p>vue fichiers</p> }))
vi.mock('./components/NewMapView', () => ({ NewMapView: () => <p>vue nouvelle</p> }))
vi.mock('./components/ConflictsView', () => ({ ConflictsView: () => <p>vue conflits</p> }))
vi.mock('./components/DuplicatesView', () => ({ DuplicatesView: () => <p>vue doublons</p> }))
vi.mock('./components/LogsView', () => ({ LogsView: () => <p>vue journal</p> }))
vi.mock('./lib/pb', () => ({
  currentUser: () => ({ id: 'p1', username: 'aife', role: 'prof' }),
}))
vi.mock('./state/useLibrary', () => ({
  useLibrary: () => ({ conflicts: h.conflicts, refreshAll: vi.fn() }),
  // Le stub compte les conflits « ouverts » : seul ce que la coque en fait nous intéresse.
  openConflictCount: (list: { open: boolean }[]) => list.filter(c => c.open).length,
}))

import { BibliothequeApp } from './BibliothequeApp'

const PROF: Session = { kind: 'prof', id: 'p1', username: 'aife' }
const HREFS = ['#/fichiers', '#/nouvelle', '#/conflits', '#/doublons', '#/journal']

function setHash(hash: string) {
  window.location.hash = hash
  act(() => {
    window.dispatchEvent(new Event('hashchange'))
  })
}

beforeEach(() => {
  h.session = PROF
  h.conflicts = []
  // jsdom ne sait pas naviguer : on observe `replace` sur un faux `location`.
  Object.defineProperty(window, 'location', { value: { replace: vi.fn(), hash: '' }, writable: true })
})
afterEach(cleanup)

describe('BibliothequeApp (coque)', () => {
  it('affiche les cinq onglets avec leur lien', () => {
    render(<BibliothequeApp />)
    const main = within(screen.getByRole('main'))
    const links = main.getAllByRole('link')
    expect(links.map(l => l.getAttribute('href'))).toEqual(HREFS)
  })

  it('l’onglet actif suit le fragment, un seul aria-current', () => {
    render(<BibliothequeApp />)
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: /Fichiers/ })).toHaveAttribute('aria-current', 'page')
    setHash('#/conflits')
    const current = main.getAllByRole('link').filter(l => l.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '#/conflits')
  })

  it('montre le nombre de conflits ouverts', () => {
    h.conflicts = [{ open: true }, { open: true }, { open: false }]
    render(<BibliothequeApp />)
    const conflits = within(screen.getByRole('main')).getByRole('link', { name: /Conflits/ })
    expect(within(conflits).getByText('2')).toBeInTheDocument()
  })

  it('visiteur : rien n’est rendu et redirection vers /login/', () => {
    h.session = null
    render(<BibliothequeApp />)
    expect(screen.queryByRole('main')).toBeNull()
    expect(screen.queryByText('vue fichiers')).toBeNull()
    expect(window.location.replace).toHaveBeenCalledWith('/login/')
  })

  it('admin : redirection vers /gestion/', () => {
    h.session = { kind: 'admin', email: 'a@b.fr' }
    render(<BibliothequeApp />)
    expect(screen.queryByText('vue fichiers')).toBeNull()
    expect(window.location.replace).toHaveBeenCalledWith('/gestion/')
  })
})
