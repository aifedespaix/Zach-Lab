/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { oklchWcagContrast, type Oklch } from './contrast'

// Ni `import.meta.url` (jsdom : pas une URL `file:`) ni `?raw` (vitest vide les
// `.css`) ne donnent le fichier : la suite tourne depuis `packages/shared`.
const css = readFileSync(resolve(process.cwd(), 'src/theme/theme.css'), 'utf8')

/** Le corps du premier bloc `selector { … }` du fichier. */
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `bloc ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('\n}', start))
}

function oklchToken(body: string, name: string): Oklch {
  const match = new RegExp(`${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(body)
  expect(match, `jeton ${name}`).not.toBeNull()
  return { l: Number(match![1]), c: Number(match![2]), h: Number(match![3]) }
}

describe('la surbrillance de la parenthèse jumelle (MathLive)', () => {
  // MathLive choisit sa palette sombre avec `prefers-color-scheme` (le thème de
  // Windows), pas avec celui de l'app : un Windows sombre sous une app claire
  // donnait un fond gris foncé sous un texte foncé. Les jetons ci-dessous sont
  // posés sur `math-field` et priment, dans les deux thèmes.
  it.each([':root', '.dark'])('%s : parenthèse lisible sur son fond (WCAG AA)', selector => {
    const body = block(selector)
    const bg = oklchToken(body, '--math-fence-bg')
    const fg = oklchToken(body, '--math-fence-fg')
    expect(oklchWcagContrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('branche les jetons sur les variables publiques de MathLive', () => {
    const body = block('math-field')
    expect(body).toContain('--contains-highlight-background-color: var(--math-fence-bg)')
    expect(body).toContain('--contains-highlight-color: var(--math-fence-fg)')
  })
})
