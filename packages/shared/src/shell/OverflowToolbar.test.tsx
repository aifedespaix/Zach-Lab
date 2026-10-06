import { describe, expect, it } from 'vitest'
import { visibleIds } from './OverflowToolbar'

const item = (id: string, priority = 0) => ({ id, width: 30, priority })

describe('visibleIds', () => {
  const items = [item('a'), item('b'), item('c'), item('d')]
  it('garde tout quand ça tient, ou quand la barre n’est pas mesurée', () => {
    expect([...visibleIds(items, 200, 8, 32)]).toEqual(['a', 'b', 'c', 'd'])
    expect([...visibleIds(items, 0, 8, 32)]).toEqual(['a', 'b', 'c', 'd'])
  })
  it('retire les derniers d’abord, en gardant la place du bouton « … »', () => {
    // Cinq demandent 182 ; à 170, quatre + le « … » demandent 184 : il en reste trois (146).
    expect([...visibleIds([...items, item('e')], 170, 8, 32)]).toEqual(['a', 'b', 'c'])
    expect([...visibleIds(items, 110, 8, 32)]).toEqual(['a', 'b'])
  })
  it('retire d’abord les moins prioritaires', () => {
    const ranked = [item('a'), item('b', 5), item('c'), item('d', 5)]
    expect([...visibleIds(ranked, 110, 8, 32)].sort()).toEqual(['b', 'd'])
  })
  it('peut tout ranger dans le menu', () => {
    expect([...visibleIds(items, 20, 8, 32)]).toEqual([])
  })
})
