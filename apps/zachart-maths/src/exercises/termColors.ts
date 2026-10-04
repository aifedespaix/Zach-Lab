export type Theme = 'light' | 'dark'

/** Les teintes (HSL) des groupes de lettres, dans l'ordre. La constante est un vrai gris, sans teinte. */
export const TERM_HUES = [215, 340, 150, 30, 280, 175] as const

/**
 * Un HSL (teinte en degrés, saturation et clarté entre 0 et 1) en `#rrggbb`. Hexadécimal et non
 * `var(--…)` : `\colorbox` de KaTeX ne lit que de vraies couleurs.
 */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const a = saturation * Math.min(lightness, 1 - lightness)
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * value).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/** Le fond d'un terme : pâle en thème clair, profond en thème sombre, le texte de la page restant lisible dessus. */
function background(hue: number, theme: Theme, muted: boolean): string {
  if (theme === 'light') return hslToHex(hue, muted ? 0 : 0.9, muted ? 0.68 : 0.86)
  return hslToHex(hue, muted ? 0 : 0.45, muted ? 0.32 : 0.3)
}

/**
 * Une couleur par groupe de termes, attribuée à la première apparition en parcourant `groups` dans
 * l'ordre : `3x` et `5x` ont la même couleur partout, des deux côtés du « = » et d'une étape à
 * l'autre. La constante (`''`) est un gris neutre (saturation 0) : une teinte, même pâle, la ferait
 * ressembler à celle de x. Elle ne consomme aucune teinte ; au-delà de six groupes de lettres la palette recommence.
 */
export function assignTermColors(groups: readonly (string | null)[], theme: Theme): Map<string, string> {
  const colors = new Map<string, string>()
  let letters = 0
  for (const group of groups) {
    if (group === null || colors.has(group)) continue
    if (group === '') {
      colors.set(group, background(0, theme, true))
    } else {
      colors.set(group, background(TERM_HUES[letters % TERM_HUES.length], theme, false))
      letters++
    }
  }
  return colors
}
