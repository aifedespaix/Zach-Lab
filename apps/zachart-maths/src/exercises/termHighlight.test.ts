import { describe, expect, it } from 'vitest'
import { assignTermColors } from './termColors'
import { termHighlighter } from './termHighlight'

const at = (step: number, side: 'left' | 'right' = 'left') => ({ step, side })

describe('termHighlighter', () => {
  it('donne un fond à chaque terme coloré, avec des indices dans le LaTeX reçu', () => {
    const highlight = termHighlighter([{ left: '3x+2y+1', right: '5x+3y-4' }], 'light')
    const colors = assignTermColors(['x', 'y', ''], 'light')
    expect(highlight('3x+2y+1', at(0))).toEqual([
      { from: 0, to: 2, color: colors.get('x') },
      { from: 2, to: 5, color: colors.get('y') },
      { from: 5, to: 7, color: colors.get('') },
    ])
  })

  it('ne colore rien quand aucun groupe n\'a deux termes dans l\'étape', () => {
    expect(termHighlighter([{ left: '5x', right: '10' }], 'light')('5x', at(0))).toEqual([])
  })

  it('compte l\'autre membre : 3x à gauche, 2x+5 à droite', () => {
    const highlight = termHighlighter([{ left: '3x', right: '2x+5' }], 'light')
    expect(highlight('3x', at(0))).toHaveLength(1)
    expect(highlight('2x+5', at(0, 'right'))).toHaveLength(2)
  })

  it('garde la même couleur pour un groupe d\'une étape à l\'autre', () => {
    const highlight = termHighlighter([{ left: '3y+y', right: '1' }, { left: '2x+x', right: 'y' }], 'light')
    const colors = assignTermColors(['y', 'x'], 'light')
    expect(highlight('2x+x', at(1))[0].color).toBe(colors.get('x'))
    expect(highlight('3y+y', at(0))[0].color).toBe(colors.get('y'))
  })

  it('lit la valeur fraîchement tapée, pas celle du bloc', () => {
    const highlight = termHighlighter([{ left: '3x', right: '1' }], 'light')
    expect(highlight('3x+2x', at(0))).toHaveLength(2)
  })

  it('ne colore pas un terme illisible, ni un membre vide', () => {
    const highlight = termHighlighter([{ left: '2(x+1)+3', right: '' }], 'light')
    expect(highlight('', at(0))).toEqual([])
    expect(highlight('2(x+1)+3', at(0)).every(h => h.to - h.from === 2)).toBe(true)
  })
})
