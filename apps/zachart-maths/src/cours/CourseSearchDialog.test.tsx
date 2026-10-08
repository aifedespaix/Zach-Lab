import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { COURSES } from './courses'
import { CourseSearchDialog } from './CourseSearchDialog'
import { useCoursesStore } from './useCoursesStore'

const open = () => useCoursesStore.setState({ searchOpen: true })
const tab = (name: RegExp) => screen.getByRole('tab', { name })

describe('CourseSearchDialog', () => {
  beforeEach(() => {
    localStorage.clear()
    useCoursesStore.setState({ selectedId: null, searchOpen: false })
  })

  it('a des onglets par chapitre, et l\'onglet Tous liste tous les cours regroupés par chapitre', async () => {
    render(<CourseSearchDialog />)
    open()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('tablist', { name: 'Catégories de cours' })).toBeInTheDocument()
    expect(tab(/^Géométrie/)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Recherche/ })).not.toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(COURSES.length)
    expect(screen.getByRole('region', { name: 'Géométrie' })).toBeInTheDocument()
  })

  it('un onglet de chapitre ne montre que ses cours', async () => {
    const user = userEvent.setup()
    render(<CourseSearchDialog />)
    open()
    await user.click(await screen.findByRole('tab', { name: /^Fractions/ }))
    const panel = screen.getByRole('tabpanel')
    const fractions = COURSES.filter(c => c.chapitre === 'Fractions')
    expect(within(panel).getAllByRole('button')).toHaveLength(fractions.length)
    expect(within(panel).getByRole('button', { name: /Additionner/ })).toBeInTheDocument()
  })

  it('taper ouvre l\'onglet Recherche, qui se referme quand la recherche est vidée', async () => {
    const user = userEvent.setup()
    render(<CourseSearchDialog />)
    open()
    const input = await screen.findByLabelText('Rechercher un cours')
    await user.type(input, 'pythagore')
    expect(tab(/^Recherche/)).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('tabpanel')).getByRole('button', { name: /Pythagore/ })).toBeInTheDocument()
    await user.clear(input)
    expect(screen.queryByRole('tab', { name: /^Recherche/ })).not.toBeInTheDocument()
    expect(tab(/^Tous/)).toHaveAttribute('aria-selected', 'true')
  })

  it('la recherche garde l\'onglet Recherche même si un autre onglet a été cliqué entre-temps', async () => {
    const user = userEvent.setup()
    render(<CourseSearchDialog />)
    open()
    await user.type(await screen.findByLabelText('Rechercher un cours'), 'pythagore')
    await user.click(tab(/^Géométrie/))
    expect(tab(/^Géométrie/)).toHaveAttribute('aria-selected', 'true')
    await user.type(screen.getByLabelText('Rechercher un cours'), ' ')
    expect(tab(/^Recherche/)).toBeInTheDocument()
  })

  it('l\'onglet Suggérés apparaît et s\'ouvre par défaut quand il y a des suggestions', async () => {
    render(<CourseSearchDialog suggested={[COURSES[0]]} />)
    open()
    expect(await screen.findByRole('tab', { name: /^Suggérés/ })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(1)
  })

  it('Entrée ouvre le premier résultat de la recherche', async () => {
    const user = userEvent.setup()
    render(<CourseSearchDialog />)
    open()
    await user.type(await screen.findByLabelText('Rechercher un cours'), 'pitagore{Enter}')
    await waitFor(() => expect(useCoursesStore.getState().selectedId).toBe('pythagore'))
  })
})
