import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTreeDragStore } from '@suite/shared/tree'
import { ExerciseTree } from './ExerciseTree'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'

const fiche = (titre: string) =>
  JSON.stringify({ version: 2, id: titre, titre, exercices: [{ id: 'e', numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' }] })

const originalElementFromPoint = document.elementFromPoint as ((x: number, y: number) => Element | null) | undefined
const pointAt = (el: Element | null) => vi.mocked(document.elementFromPoint).mockReturnValue(el)
const paths = (chapter: string) => useExerciseStore.getState().tree.find(c => c.name === chapter)?.exercises.map(e => e.path) ?? []

async function setup() {
  const fs = createMemoryFs({ 'A/un.json': fiche('Un'), 'B/deux.json': fiche('Deux') })
  render(<ExerciseTree />)
  await act(async () => useExerciseStore.getState().init(fs))
  return { fs, user: userEvent.setup() }
}
const chapter = (name: string) => screen.getByRole('button', { name })
const file = (titre: string) => screen.getByRole('button', { name: titre })
const pointerDown = (el: Element, x = 10, y = 10, button = 0) => fireEvent.pointerDown(el, { button, clientX: x, clientY: y })
const move = (x: number, y: number) => fireEvent(window, new MouseEvent('pointermove', { clientX: x, clientY: y }))
const release = () => fireEvent(window, new MouseEvent('pointerup'))

describe("glisser-déposer dans l'arbre des exercices", () => {
  beforeEach(() => {
    Object.defineProperty(document, 'elementFromPoint', { value: vi.fn(() => null), writable: true, configurable: true })
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useTreeDragStore.setState({ source: null, pointer: null, targetPath: null })
  })
  afterEach(() => {
    if (originalElementFromPoint === undefined) delete (document as unknown as Record<string, unknown>).elementFromPoint
    else document.elementFromPoint = originalElementFromPoint
  })

  it('glisser un fichier sur un autre chapitre le déplace', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('B'))
    pointerDown(file('Un'))
    move(60, 60)
    release()
    await waitFor(() => expect(paths('B')).toContain('B/un.json'))
    expect(paths('A')).not.toContain('A/un.json')
  })

  it('le déposer sur son propre chapitre ne change rien, et le fantôme refuse', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('A'))
    pointerDown(file('Un'))
    move(60, 60)
    expect(await screen.findByTestId('tree-drag-ghost')).toHaveTextContent('Déposer sur un chapitre')
    release()
    expect(paths('A')).toEqual(['A/un.json'])
  })

  it('le fantôme annonce le chapitre visé, et disparaît après le dépôt', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('B'))
    pointerDown(file('Un'))
    move(60, 60)
    expect(await screen.findByTestId('tree-drag-ghost')).toHaveTextContent('Déplacer dans « B »')
    release()
    await waitFor(() => expect(screen.queryByTestId('tree-drag-ghost')).toBeNull())
  })

  it('Échap annule : rien ne bouge, plus de fantôme', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('B'))
    pointerDown(file('Un'))
    move(60, 60)
    fireEvent(window, new KeyboardEvent('keydown', { key: 'Escape' }))
    release()
    expect(screen.queryByTestId('tree-drag-ghost')).toBeNull()
    expect(paths('A')).toEqual(['A/un.json'])
  })

  it('un chapitre replié s’ouvre au survol, puis reçoit le fichier', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { user } = await setup()
      await user.click(chapter('B'))
      expect(screen.queryByText('Deux')).toBeNull()
      pointAt(chapter('B'))
      pointerDown(file('Un'))
      move(60, 60)
      await act(async () => void vi.advanceTimersByTime(700))
      expect(await screen.findByText('Deux')).toBeInTheDocument()
      release()
      await waitFor(() => expect(paths('B')).toContain('B/un.json'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('un simple clic sélectionne le fichier, un clic après un vrai drag ne le sélectionne pas', async () => {
    const { user } = await setup()
    await screen.findByText('Un')
    await user.click(file('Un'))
    expect(useExerciseStore.getState().selected).toBe('A/un.json')
    useExerciseStore.setState({ selected: null })
    pointAt(chapter('A'))
    pointerDown(file('Un'))
    move(60, 60)
    release()
    fireEvent.click(file('Un'))
    expect(useExerciseStore.getState().selected).toBeNull()
  })

  it('un clic droit ouvre le menu sans démarrer de drag', async () => {
    await setup()
    await screen.findByText('Un')
    pointerDown(file('Un'), 10, 10, 2)
    move(80, 80)
    release()
    expect(useTreeDragStore.getState().source).toBeNull()
    fireEvent.contextMenu(file('Un'))
    expect(await screen.findByRole('menuitem', { name: /Renommer/ })).toBeInTheDocument()
  })

  it('les boutons de fichier ne sont plus « draggable » (le navigateur ne dispute plus le geste)', async () => {
    await setup()
    await screen.findByText('Un')
    expect(file('Un')).not.toHaveAttribute('draggable', 'true')
  })
})
