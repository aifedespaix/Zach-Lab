import { describe, expect, it } from 'vitest'
import { insertLineAfter, isLineEmpty, newLine, removeLineAt } from './lines'

const L = (id: string, latex = '') => ({ id, latex })

describe('lines', () => {
  it("insère une ligne vide juste après l'index", () => {
    const { lines, added } = insertLineAfter([L('a', '1'), L('b', '2')], 0)
    expect(lines.map(l => l.id)).toEqual(['a', added.id, 'b'])
    expect(added.latex).toBe('')
  })
  it('retire une ligne mais jamais la dernière', () => {
    expect(removeLineAt([L('a'), L('b')], 0).map(l => l.id)).toEqual(['b'])
    expect(removeLineAt([L('a')], 0).map(l => l.id)).toEqual(['a'])
  })
  it('sait si une ligne est vide (espaces compris)', () => {
    expect(isLineEmpty(L('a', '  '))).toBe(true)
    expect(isLineEmpty(L('a', 'x'))).toBe(false)
    expect(newLine().latex).toBe('')
  })
})
