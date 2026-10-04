import { describe, expect, it } from 'vitest'
import { assignTermColors, TERM_HUES } from './termColors'

const HEX = /^#[0-9a-f]{6}$/

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** Hex -> sRGB linéaire -> XYZ D65 -> Lab. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(linear)
  const xyz = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ]
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = xyz.map(f)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const deltaE76 = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]))

const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

const LETTER_GROUPS = ['a', 'b', 'c', 'd', 'e', 'f']

describe('palette mesurée', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme} : la constante se distingue de chaque couleur de lettre (ΔE76 >= 22)`, () => {
      const colors = assignTermColors(['', ...LETTER_GROUPS], theme)
      for (const g of LETTER_GROUPS) expect(deltaE76(colors.get('')!, colors.get(g)!)).toBeGreaterThanOrEqual(22)
    })

    it(`${theme} : le texte de la page reste lisible sur chaque fond (contraste >= 4.5)`, () => {
      const text = theme === 'light' ? '#0a0a0a' : '#fafafa'
      for (const color of assignTermColors(['', ...LETTER_GROUPS], theme).values()) {
        expect(contrast(text, color)).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

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
