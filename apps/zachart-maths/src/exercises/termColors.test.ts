import { describe, expect, it } from 'vitest'
import { assignTermColors, TERM_HUES } from './termColors'

const HEX = /^#[0-9a-f]{6}$/

describe('assignTermColors', () => {
  it('donne une couleur hexadécimale à chaque groupe, et ignore les termes non colorés', () => {
    const colors = assignTermColors(['x', null, 'y', ''], 'light')
    expect([...colors.keys()]).toEqual(['x', 'y', ''])
    for (const color of colors.values()) expect(color).toMatch(HEX)
  })

  it('garde une couleur par groupe, quelle que soit la fréquence', () => {
    const colors = assignTermColors(['x', 'y', 'x', 'x', 'y'], 'light')
    expect(colors.size).toBe(2)
  })

  it('distingue les groupes entre eux et la constante des lettres', () => {
    const colors = assignTermColors(['x', 'y', ''], 'light')
    expect(new Set(colors.values()).size).toBe(3)
  })

  it("attribue les couleurs dans l'ordre d'apparition", () => {
    const a = assignTermColors(['x', 'y'], 'light')
    const b = assignTermColors(['y', 'x'], 'light')
    expect(a.get('x')).toBe(b.get('y'))
    expect(a.get('y')).toBe(b.get('x'))
  })

  it('ne dépend pas de la place de la constante parmi les lettres', () => {
    const early = assignTermColors(['', 'x', 'y'], 'light')
    const late = assignTermColors(['x', 'y', ''], 'light')
    expect(early.get('x')).toBe(late.get('x'))
    expect(early.get('y')).toBe(late.get('y'))
    expect(early.get('')).toBe(late.get(''))
  })

  it('recommence la palette au-delà de six groupes de lettres, sans planter', () => {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(TERM_HUES).toHaveLength(6)
    const colors = assignTermColors(letters, 'light')
    expect(colors.size).toBe(7)
    expect(colors.get('g')).toBe(colors.get('a'))
  })

  it('a une version pour chaque thème', () => {
    const light = assignTermColors(['x', ''], 'light')
    const dark = assignTermColors(['x', ''], 'dark')
    expect(light.get('x')).not.toBe(dark.get('x'))
    expect(light.get('')).not.toBe(dark.get(''))
    for (const color of dark.values()) expect(color).toMatch(HEX)
  })

  it('un fond de thème clair est clair, un fond de thème sombre est sombre', () => {
    const brightness = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
      return (r + g + b) / 3
    }
    expect(brightness(assignTermColors(['x'], 'light').get('x')!)).toBeGreaterThan(170)
    expect(brightness(assignTermColors(['x'], 'dark').get('x')!)).toBeLessThan(110)
  })
})
