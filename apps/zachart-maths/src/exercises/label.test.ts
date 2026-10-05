import { describe, expect, it } from 'vitest'
import { bumpLabel } from './label'

describe('bumpLabel', () => {
  it('incrémente et décrémente un nombre, sans passer sous 0', () => {
    expect(bumpLabel('3', 1)).toBe('4')
    expect(bumpLabel('10', -1)).toBe('9')
    expect(bumpLabel('0', -1)).toBeNull()
    expect(bumpLabel('Ex 9', 1)).toBe('Ex 10')
  })
  it('passe à la lettre suivante ou précédente, en gardant la casse', () => {
    expect(bumpLabel('1a', 1)).toBe('1b')
    expect(bumpLabel('a', 1)).toBe('b')
    expect(bumpLabel('A', 1)).toBe('B')
    expect(bumpLabel('2c', -1)).toBe('2b')
  })
  it('ne force rien aux bornes, ni sur un mot ou un texte vide', () => {
    expect(bumpLabel('z', 1)).toBeNull()
    expect(bumpLabel('1a', -1)).toBeNull()
    expect(bumpLabel('bis', 1)).toBeNull()
    expect(bumpLabel('', 1)).toBeNull()
  })
})
