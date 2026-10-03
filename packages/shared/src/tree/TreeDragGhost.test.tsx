import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TreeDragGhost } from './TreeDragGhost'
import { useTreeDragStore } from './useTreeDragStore'

const props = { describeTarget: (path: string) => `Déplacer dans « ${path} »` }
const drag = (targetPath: string | null) =>
  act(() => {
    useTreeDragStore.setState({ source: { path: 'A/un.json', name: 'Un', kind: 'file' }, pointer: { x: 100, y: 50 }, targetPath })
  })

describe('TreeDragGhost', () => {
  beforeEach(() => useTreeDragStore.setState({ source: null, pointer: null, targetPath: null }))

  it('is absent outside a drag', () => {
    render(<TreeDragGhost {...props} />)
    expect(screen.queryByTestId('tree-drag-ghost')).toBeNull()
  })

  it('names the row in flight and follows the pointer', () => {
    render(<TreeDragGhost {...props} />)
    drag(null)
    const ghost = screen.getByTestId('tree-drag-ghost')
    expect(ghost).toHaveTextContent('Un')
    expect(ghost).toHaveStyle({ left: '114px', top: '64px' })
    expect(ghost).toHaveAttribute('data-valid', 'false')
  })

  it('states the destination when valid, a plain refusal otherwise', () => {
    render(<TreeDragGhost {...props} />)
    drag('B')
    expect(screen.getByTestId('tree-drag-ghost')).toHaveTextContent('Déplacer dans « B »')
    expect(screen.getByTestId('tree-drag-ghost')).toHaveAttribute('data-valid', 'true')
    drag(null)
    expect(screen.getByTestId('tree-drag-ghost')).toHaveTextContent('Déposer sur un dossier')
  })

  it('lets the app choose the refusal text and the icon of each kind', () => {
    render(<TreeDragGhost {...props} refusal="Dépose sur un chapitre" icon={kind => <span data-testid={`icon-${kind}`} />} />)
    drag(null)
    expect(screen.getByTestId('tree-drag-ghost')).toHaveTextContent('Dépose sur un chapitre')
    expect(screen.getByTestId('icon-file')).toBeInTheDocument()
  })

  it('disappears when the drag ends', () => {
    render(<TreeDragGhost {...props} />)
    drag('B')
    act(() => useTreeDragStore.getState().end())
    expect(screen.queryByTestId('tree-drag-ghost')).toBeNull()
  })
})
