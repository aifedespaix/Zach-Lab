import { describe, expect, it } from 'vitest'
import { toPlain, withIds } from './stepIds'

const S = (id: string, left = '', right = '', operation = '') => ({ id, left, right, operation })
const P = (left = '', right = '', operation = '') => ({ left, right, operation })

describe('stepIds', () => {
  it('toPlain retire les ids et garde les champs', () => {
    expect(toPlain([S('a', '1', '2', '+3')])).toEqual([P('1', '2', '+3')])
  })
  it("garde les ids quand seul un champ change", () => {
    expect(withIds([S('a', '1'), S('b', '2')], [P('1x'), P('2')]).map(s => s.id)).toEqual(['a', 'b'])
  })
  it("donne un id neuf à l'étape insérée au milieu et garde les autres", () => {
    const out = withIds([S('a', '1'), S('b', '2')], [P('1'), P(), P('2')])
    expect(out[0].id).toBe('a')
    expect(out[2].id).toBe('b')
    expect(['a', 'b']).not.toContain(out[1].id)
  })
  it('garde les ids restants quand une étape disparaît', () => {
    expect(withIds([S('a', '1'), S('b', ''), S('c', '3')], [P('1'), P('3')]).map(s => s.id)).toEqual(['a', 'c'])
  })
})
