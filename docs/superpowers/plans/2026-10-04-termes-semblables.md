# Coloration des termes semblables — plan d'implémentation

> **Pour les agents d'exécution :** utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour réaliser ce plan tâche par tâche. Les étapes utilisent des cases `- [ ]`.

**But :** dans le bloc équation de Zach'Math, afficher sous le bloc (quand il a le focus) une ligne en lecture seule où les termes semblables (`3x` et `5x`, les constantes) ont la même couleur, des deux côtés du « = » et d'une étape à l'autre.

**Architecture :** un analyseur pur découpe chaque membre en termes et les groupe par partie littérale (`likeTerms.ts`) ; une palette hexadécimale selon le thème donne une couleur par groupe (`termColors.ts`) ; `LikeTermsHelp` construit le LaTeX avec `\colorbox` et l'affiche par KaTeX (`renderMathToHtml`) ; `EquationEditor` suit le focus du bloc et affiche l'aide. Le champ MathLive n'est jamais modifié.

**Pile :** React 19, TypeScript, KaTeX via `@suite/shared/math`, zustand (`useUnitColors`), Vitest + Testing Library, Bun. Tout vit dans `apps/zachart-maths/src/exercises/`.

**Spec :** `docs/superpowers/specs/2026-10-04-termes-semblables-design.md` (à lire avant de commencer). Suite de la coloration des unités (`2026-10-04-coloration-unites-design.md`), déjà livrée sur `main`.

## Contraintes globales

- Rien dans `packages/shared`, rien dans `apps/zachart-mentale`.
- Le champ MathLive n'est jamais modifié : l'aide est une ligne à côté, jamais une écriture dans la valeur LaTeX. Aucun `onChange` n'est appelé par l'aide.
- Un terme est coloré seulement s'il est lu sûrement. Tout le reste (parenthèses, fractions, racines, `/`, commandes inconnues, accolades non appariées) donne `group: null` : l'erreur possible est « pas de couleur », jamais une valeur changée. La concaténation des `text` des segments redonne exactement le LaTeX d'entrée.
- Groupe d'un terme = sa partie littérale : lettres triées par ordre alphabétique, avec exposant s'il est supérieur à 1 (`x`, `xy`, `x^2`) ; `''` pour une constante. Le coefficient est ignoré.
- Couleurs en **hexadécimal** (`#rrggbb`) : `\colorbox` de KaTeX n'accepte pas `var(--…)`. Une version pour le thème clair, une pour le sombre (`'light' | 'dark'`).
- Les couleurs sont attribuées dans l'ordre d'apparition sur **tout le bloc** (étape par étape, membre gauche puis droit) ; 6 teintes de lettres qui recommencent au-delà ; une teinte grise fixe pour les constantes.
- La ligne d'aide n'apparaît que si le réglage `useUnitColors.enabled` est actif ET que le focus est dans le bloc ; une ligne par étape ayant au moins deux termes colorés ; `aria-hidden` ; le conteneur garde une hauteur minimale (28 px) tant qu'il est affiché.
- Le bouton et la commande existants (`view.toggleUnitColors`) pilotent les deux aides ; libellé final : « Colorer unités et termes » (tâche 5).
- Les textes de l'app sont en français ; les commentaires expliquent le pourquoi, en français, comme dans le code voisin.
- Commits : chemins explicites, jamais `git add -A`. Ne rien pousser (le contrôleur pousse).

## Points de vigilance (Review Focus)

1. **LaTeX cassé ou tronqué** (`3x+`, `{3x`, `\frac{`, parenthèse ouverte, chaîne vide) : aucune exception, concaténation des segments égale à l'entrée. Test en tâche 1.
2. **Termes non lisibles** (`2(x+1)`, `\frac{1}{2}x`, `x/2`, `\sqrt{2}`, `\pi`) : jamais colorés, et leur voisinage reste correctement découpé. Test en tâche 1.
3. **Signes** : `-x`, `x-3`, signe en tête, signe sans terme (`3x+`), espaces autour : le signe reste avec son terme, les espaces ne sont jamais dans une boîte colorée. Tests en tâche 1.
4. **Le focus passe d'un champ à l'autre du même bloc** (Tab, flèches) : l'aide ne doit ni disparaître ni clignoter. Test en tâche 4 (`relatedTarget` intérieur au bloc).
5. **Réglage coupé ou focus hors du bloc** : aucune aide, aucun conteneur. Tests en tâche 4.
6. **Changement de thème** : les couleurs changent avec le thème ; texte lisible. Test en tâche 3, contrôle visuel à la main.

---

### Tâche 1 : découper un membre en termes (`likeTerms.ts`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/likeTerms.ts`
- Test : `apps/zachart-maths/src/exercises/likeTerms.test.ts`

**Interfaces :**
- Consomme : rien.
- Produit : `interface TermSegment { text: string; group: string | null }` et `colorTerms(latex: string): TermSegment[]`. Les `text` mis bout à bout redonnent exactement `latex` ; `''` donne `[]`. `group` est la partie littérale (`'x'`, `'xy'`, `'x^2'`), `''` pour une constante, `null` pour tout ce qui n'est pas coloré (opérateurs, espaces, termes illisibles).

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/zachart-maths/src/exercises/likeTerms.test.ts
import { describe, expect, it } from 'vitest'
import { colorTerms } from './likeTerms'

/** Les termes colorés seulement, sous la forme [texte, groupe] : plus lisible que tous les segments. */
const colored = (latex: string) => colorTerms(latex).filter(s => s.group !== null).map(s => [s.text, s.group])

describe('colorTerms', () => {
  it('découpe aux signes de premier niveau et groupe par partie littérale', () => {
    expect(colored('3x+2y+1')).toEqual([['3x', 'x'], ['+2y', 'y'], ['+1', '']])
    expect(colored('5x-3y-4')).toEqual([['5x', 'x'], ['-3y', 'y'], ['-4', '']])
  })

  it('garde le signe avec son terme et les espaces hors des termes', () => {
    expect(colored('3x + 2y + 1')).toEqual([['3x', 'x'], ['+ 2y', 'y'], ['+ 1', '']])
    const spaces = colorTerms('3x + 2').filter(s => s.group === null).map(s => s.text)
    expect(spaces).toEqual([' '])
  })

  it('lit un signe en tête comme celui du premier terme', () => {
    expect(colored('-x+2')).toEqual([['-x', 'x'], ['+2', '']])
    expect(colored('-4')).toEqual([['-4', '']])
    expect(colored('−4')).toEqual([['−4', '']])
  })

  it('distingue les exposants et ignore l\'ordre des lettres', () => {
    expect(colored('x^2 + x')).toEqual([['x^2', 'x^2'], ['+ x', 'x']])
    expect(colored('x^{2}+3x')).toEqual([['x^{2}', 'x^2'], ['+3x', 'x']])
    expect(colored('2xy + 3yx')).toEqual([['2xy', 'xy'], ['+ 3yx', 'xy']])
    expect(colored('x \\cdot x')).toEqual([['x \\cdot x', 'x^2']])
  })

  it('lit les produits écrits avec \\cdot ou \\times et les décimales', () => {
    expect(colored('3\\cdot x + 2')).toEqual([['3\\cdot x', 'x'], ['+ 2', '']])
    expect(colored('2\\times y')).toEqual([['2\\times y', 'y']])
    expect(colored('1,5x + 2.5')).toEqual([['1,5x', 'x'], ['+ 2.5', '']])
  })

  it('ne colore jamais un terme qu\'il ne sait pas lire sûrement', () => {
    expect(colored('2(x+1) + 3')).toEqual([['+ 3', '']])
    expect(colored('\\frac{1}{2}x + 1')).toEqual([['+ 1', '']])
    expect(colored('x/2 + 1')).toEqual([['+ 1', '']])
    expect(colored('\\sqrt{2} + 1')).toEqual([['+ 1', '']])
    expect(colored('\\pi + 1')).toEqual([['+ 1', '']])
    expect(colored('x = 3')).toEqual([])
  })

  it('ne lève rien sur un LaTeX cassé ou tronqué', () => {
    expect(colored('3x+')).toEqual([['3x', 'x']])
    expect(colored('{3x')).toEqual([])
    expect(colored('\\frac{')).toEqual([])
    expect(colored('(3x')).toEqual([])
    expect(colored('+')).toEqual([])
    expect(colorTerms('')).toEqual([])
  })

  it('redonne exactement le LaTeX d\'entrée en recollant les segments', () => {
    for (const latex of ['3x+2y+1', ' 3x  +  2y -1 ', '-x+2', '2(x+1) + 3', '\\frac{1}{2}x + 1', '3x+', '{3x', '+', 'x^{2}+3x', '  ']) {
      expect(colorTerms(latex).map(s => s.text).join('')).toBe(latex)
    }
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- likeTerms`
Attendu : échec, module `./likeTerms` introuvable.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// apps/zachart-maths/src/exercises/likeTerms.ts

/**
 * Un morceau d'un membre d'équation. `group` est la partie littérale du terme (`x`, `xy`, `x^2`),
 * `''` pour une constante, `null` quand le morceau n'est pas coloré (opérateur, espace, terme que
 * l'on ne sait pas lire sûrement). Les `text` mis bout à bout redonnent exactement le LaTeX lu.
 */
export interface TermSegment {
  text: string
  group: string | null
}

const SIGN = /^[+\-−]\s*/
// Ce qu'on refuse de lire : regrouper `2(x+1)` ou `\frac{1}{2}x` demanderait de développer.
const UNREADABLE = /[()[\]/]|\\(?:left|right|frac|dfrac|tfrac|sqrt|div|over)/
const NOISE = /\\cdot|\\times|\\,|\\ |[×·*\s]/g
const FACTOR = '(\\d+(?:[.,]\\d+)?)|([A-Za-z])(?:\\^(?:\\{(\\d+)\\}|(\\d+)))?'

/** La partie littérale d'un terme, ou `null` si on ne sait pas le lire. */
function groupOf(term: string): string | null {
  const body = term.replace(SIGN, '')
  if (UNREADABLE.test(body)) return null
  const flat = body.replace(NOISE, '')
  if (flat === '') return null
  const letters = new Map<string, number>()
  const factor = new RegExp(FACTOR, 'y')
  let at = 0
  while (at < flat.length) {
    factor.lastIndex = at
    const match = factor.exec(flat)
    if (match === null) return null // un caractère inattendu : on ne colore pas
    if (match[2] !== undefined) letters.set(match[2], (letters.get(match[2]) ?? 0) + Number(match[3] ?? match[4] ?? 1))
    at = factor.lastIndex
  }
  if (letters.size === 0) return '' // que des nombres : une constante
  return [...letters]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([letter, power]) => (power === 1 ? letter : `${letter}^${power}`))
    .join('')
}

/**
 * Découpe un membre aux `+` et `−` de premier niveau (hors accolades, parenthèses et crochets).
 * Le signe reste avec le terme qu'il précède ; les espaces autour d'un terme sont des segments à
 * part, pour ne jamais finir dans une boîte colorée.
 */
export function colorTerms(latex: string): TermSegment[] {
  if (latex === '') return []
  const cuts = [0]
  let depth = 0
  for (let i = 0; i < latex.length; i++) {
    const char = latex[i]
    if (char === '{' || char === '(' || char === '[') depth++
    else if (char === '}' || char === ')' || char === ']') depth = Math.max(0, depth - 1)
    // Un signe en tête n'est pas une coupure : il appartient au premier terme.
    else if (depth === 0 && (char === '+' || char === '-' || char === '−') && latex.slice(cuts[cuts.length - 1], i).trim() !== '') cuts.push(i)
  }
  cuts.push(latex.length)

  const segments: TermSegment[] = []
  for (let k = 0; k < cuts.length - 1; k++) {
    const raw = latex.slice(cuts[k], cuts[k + 1])
    if (raw.trim() === '') {
      segments.push({ text: raw, group: null })
      continue
    }
    const lead = /^\s*/.exec(raw)![0]
    const trail = /\s*$/.exec(raw)![0]
    const core = raw.slice(lead.length, raw.length - trail.length)
    if (lead !== '') segments.push({ text: lead, group: null })
    segments.push({ text: core, group: groupOf(core) })
    if (trail !== '') segments.push({ text: trail, group: null })
  }
  return segments
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- likeTerms`
Attendu : tous les tests passent. Si un cas échoue, corriger l'analyseur, pas le test : les attentes viennent du spec. Si une attente du test lui-même est fausse (par exemple l'indice d'un espace), le dire dans le rapport au lieu de l'affaiblir.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/likeTerms.ts apps/zachart-maths/src/exercises/likeTerms.test.ts
git commit -m "feat(zachart-maths): découpe un membre d'équation en termes groupés par partie littérale"
```

---

### Tâche 2 : une couleur par groupe (`termColors.ts`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/termColors.ts`
- Test : `apps/zachart-maths/src/exercises/termColors.test.ts`

**Interfaces :**
- Consomme : rien (les groupes sont des `string | null`, comme `TermSegment['group']` de la tâche 1).
- Produit : `type Theme = 'light' | 'dark'` ; `TERM_HUES: readonly number[]` (6 teintes) ; `assignTermColors(groups: readonly (string | null)[], theme: Theme): Map<string, string>` (groupe → couleur de fond `#rrggbb` ; les `null` sont ignorés ; `''`, la constante, reçoit une teinte grise fixe).

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/zachart-maths/src/exercises/termColors.test.ts
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

  it('attribue les couleurs dans l\'ordre d\'apparition', () => {
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
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- termColors`
Attendu : échec, module `./termColors` introuvable.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// apps/zachart-maths/src/exercises/termColors.ts

export type Theme = 'light' | 'dark'

/** Les teintes (HSL) des groupes de lettres, dans l'ordre. La constante a la sienne, grise. */
export const TERM_HUES = [215, 340, 150, 30, 280, 175] as const
const CONSTANT_HUE = 215

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
  if (theme === 'light') return hslToHex(hue, muted ? 0.15 : 0.75, 0.86)
  return hslToHex(hue, muted ? 0.1 : 0.45, muted ? 0.32 : 0.3)
}

/**
 * Une couleur par groupe de termes, attribuée à la première apparition en parcourant `groups` dans
 * l'ordre : `3x` et `5x` ont la même couleur partout, des deux côtés du « = » et d'une étape à
 * l'autre. La constante (`''`) a sa teinte grise et ne consomme aucune teinte de la palette ; au-delà
 * de six groupes de lettres la palette recommence.
 */
export function assignTermColors(groups: readonly (string | null)[], theme: Theme): Map<string, string> {
  const colors = new Map<string, string>()
  let letters = 0
  for (const group of groups) {
    if (group === null || colors.has(group)) continue
    if (group === '') {
      colors.set(group, background(CONSTANT_HUE, theme, true))
    } else {
      colors.set(group, background(TERM_HUES[letters % TERM_HUES.length], theme, false))
      letters++
    }
  }
  return colors
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- termColors`
Attendu : 8 tests passent. Si le test de luminosité échoue, ajuster la saturation ou la clarté dans `background`, pas le test : l'intention (fond pâle en clair, profond en sombre) vient du spec.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/termColors.ts apps/zachart-maths/src/exercises/termColors.test.ts
git commit -m "feat(zachart-maths): une couleur hexadécimale par groupe de termes, selon le thème"
```

---

### Tâche 3 : la ligne d'aide colorée (`LikeTermsHelp.tsx`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/LikeTermsHelp.tsx`
- Test : `apps/zachart-maths/src/exercises/LikeTermsHelp.test.tsx`

**Interfaces :**
- Consomme : `colorTerms`, `TermSegment` (tâche 1) ; `assignTermColors`, `Theme` (tâche 2) ; `renderMathToHtml(latex: string, display?: boolean): string` de `@suite/shared/math` ; le type `EquationStep` de `./blocks`.
- Produit : `coloredLatex(segments: readonly TermSegment[], colors: ReadonlyMap<string, string>): string` ; `LikeTermsHelp({ steps, theme })` : un conteneur `<div data-like-terms-help aria-hidden>` (toujours rendu, hauteur minimale 28 px) avec une `<div data-like-terms-line>` par étape ayant au moins deux termes colorés.

- [ ] **Étape 1 : écrire le test qui échoue**

```tsx
// apps/zachart-maths/src/exercises/LikeTermsHelp.test.tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { colorTerms } from './likeTerms'
import { coloredLatex, LikeTermsHelp } from './LikeTermsHelp'
import { assignTermColors } from './termColors'

const lines = (container: HTMLElement) => container.querySelectorAll('[data-like-terms-line]')

describe('coloredLatex', () => {
  it('enveloppe chaque terme coloré dans une boîte, et laisse le reste tel quel', () => {
    const colors = new Map([['x', '#111111'], ['', '#222222']])
    expect(coloredLatex(colorTerms('3x + 2'), colors)).toBe('\\colorbox{#111111}{$3x$} \\colorbox{#222222}{$+ 2$}')
  })

  it('ne colore pas un terme non lu, et recolle le LaTeX tel quel sans couleurs', () => {
    expect(coloredLatex(colorTerms('2(x+1) + 3'), new Map())).toBe('2(x+1) + 3')
  })

  it('rend une chaîne vide pour un membre vide', () => {
    expect(coloredLatex([], new Map())).toBe('')
  })
})

describe('LikeTermsHelp', () => {
  it('montre une ligne par étape, un fond par terme coloré, et garde sa hauteur minimale', () => {
    const { container } = render(<LikeTermsHelp steps={[{ left: '3x+2y+1', right: '5x+3y-4' }]} theme="light" />)
    expect(container.querySelector('[data-like-terms-help]')).toHaveAttribute('aria-hidden', 'true')
    expect(lines(container)).toHaveLength(1)
    expect(container.querySelectorAll('[style*="background-color"]')).toHaveLength(6)
    expect((container.querySelector('[data-like-terms-help]') as HTMLElement).style.minHeight).toBe('28px')
  })

  it('ne montre aucune ligne quand l\'étape a moins de deux termes colorés, mais garde son conteneur', () => {
    const { container } = render(<LikeTermsHelp steps={[{ left: '3x', right: '(2+1)' }]} theme="light" />)
    expect(container.querySelector('[data-like-terms-help]')).not.toBeNull()
    expect(lines(container)).toHaveLength(0)
  })

  it('ignore les étapes vides et celles qui n\'ont rien à regrouper', () => {
    const { container } = render(
      <LikeTermsHelp steps={[{ left: '', right: '' }, { left: '3x+2', right: '7' }, { left: '(1+2)', right: '' }]} theme="light" />,
    )
    expect(lines(container)).toHaveLength(1)
  })

  it('garde la même couleur pour un même groupe d\'une étape à l\'autre', () => {
    const steps = [{ left: '1+x', right: '7' }, { left: 'x', right: '6' }]
    const { container } = render(<LikeTermsHelp steps={steps} theme="light" />)
    const xColor = assignTermColors(['', 'x'], 'light').get('x')!
    expect(container.innerHTML.split(xColor).length - 1).toBeGreaterThanOrEqual(2)
  })

  it('change de couleurs avec le thème', () => {
    const steps = [{ left: '3x+2y', right: '5' }]
    const light = render(<LikeTermsHelp steps={steps} theme="light" />).container.innerHTML
    const dark = render(<LikeTermsHelp steps={steps} theme="dark" />).container.innerHTML
    expect(light).not.toBe(dark)
  })

  it('ne lève rien sur une entrée absurde', () => {
    expect(() =>
      render(<LikeTermsHelp steps={[{ left: '\\frac{', right: '{{{x' }, { left: '3x+', right: '+-' }]} theme="dark" />),
    ).not.toThrow()
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- LikeTermsHelp`
Attendu : échec, module `./LikeTermsHelp` introuvable.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```tsx
// apps/zachart-maths/src/exercises/LikeTermsHelp.tsx
import { renderMathToHtml } from '@suite/shared/math'
import type { EquationStep } from './blocks'
import { colorTerms, type TermSegment } from './likeTerms'
import { assignTermColors, type Theme } from './termColors'

/**
 * Le LaTeX d'un membre dont chaque terme coloré est dans une boîte : `\colorbox{#hex}{$3x$}`. Le
 * texte d'un terme coloré a été validé par l'analyseur (chiffres, lettres, exposants, signes,
 * `\cdot`), donc il ne peut ni fermer la boîte ni ouvrir autre chose. Les morceaux non colorés
 * (opérateurs, espaces, termes illisibles) sont recopiés tels quels.
 */
export function coloredLatex(segments: readonly TermSegment[], colors: ReadonlyMap<string, string>): string {
  return segments
    .map(({ text, group }) => {
      const color = group === null ? undefined : colors.get(group)
      return color === undefined ? text : `\\colorbox{${color}}{$${text}$}`
    })
    .join('')
}

/**
 * L'aide du bloc équation : la même équation que l'élève écrit, recomposée en lecture seule, où les
 * termes semblables (`3x` et `5x`, les constantes) ont la même couleur. Le champ MathLive, lui, n'est
 * jamais touché : une copie colorée vit à côté, la valeur enregistrée reste celle de l'élève.
 *
 * Les couleurs sont attribuées sur tout le bloc, pas étape par étape, pour que `x` garde sa couleur
 * d'une étape à l'autre. Le conteneur garde une hauteur minimale tant qu'il est affiché : les blocs
 * suivants ne sautent pas quand une ligne apparaît ou disparaît en cours de frappe.
 */
export function LikeTermsHelp({ steps, theme }: { steps: readonly Pick<EquationStep, 'left' | 'right'>[]; theme: Theme }) {
  const parsed = steps.map(step => ({ left: colorTerms(step.left), right: colorTerms(step.right) }))
  const colors = assignTermColors(parsed.flatMap(p => [...p.left, ...p.right]).map(segment => segment.group), theme)
  const worthShowing = parsed.filter(p => [...p.left, ...p.right].filter(segment => segment.group !== null).length >= 2)
  return (
    <div data-like-terms-help aria-hidden style={{ marginTop: 6, minHeight: 28, fontSize: 14, pointerEvents: 'none' }}>
      {worthShowing.map((p, index) => (
        <div
          key={index}
          data-like-terms-line
          style={{ padding: '2px 0' }}
          // Sûr : KaTeX échappe ce qu'il émet et `renderMathToHtml` passe `trust: false` (même usage que `Formula`).
          dangerouslySetInnerHTML={{ __html: renderMathToHtml(`${coloredLatex(p.left, colors)} = ${coloredLatex(p.right, colors)}`) }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- LikeTermsHelp`
Attendu : tous les tests passent. Point à vérifier sur la sortie réelle de KaTeX : le test compte `[style*="background-color"]` ; si KaTeX écrit autrement le fond de `\colorbox` (par exemple une autre propriété), regarder le HTML réellement produit (`console.log(container.innerHTML)` le temps de l'étape) et adapter le sélecteur du test, sans changer ce qu'il établit : une boîte de fond par terme coloré, six ici.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/LikeTermsHelp.tsx apps/zachart-maths/src/exercises/LikeTermsHelp.test.tsx
git commit -m "feat(zachart-maths): la ligne d'aide qui colore les termes semblables d'une équation"
```

---

### Tâche 4 : brancher l'aide sur le bloc équation

**Fichiers :**
- Modifier : `apps/zachart-maths/src/exercises/EquationEditor.tsx` (imports ; corps de `EquationEditor`)
- Test : `apps/zachart-maths/src/exercises/EquationEditor.test.tsx` (nouveau)

**Interfaces :**
- Consomme : `LikeTermsHelp` (tâche 3) ; `useUnitColors` (existant, `apps/zachart-maths/src/exercises/useUnitColors.ts`, `{ enabled: boolean }`) ; `useResolvedTheme` de `@suite/shared/theme` (`'light' | 'dark'`) ; `EquationStepsField`, `toPlain`, `withIds` (déjà utilisés).
- Produit : `EquationEditor` entouré d'un `<div data-like-terms-root>` qui suit le focus ; l'aide s'affiche sous le champ quand le bloc a le focus ET que `useUnitColors.enabled` est vrai.

- [ ] **Étape 1 : écrire le test qui échoue**

```tsx
// apps/zachart-maths/src/exercises/EquationEditor.test.tsx
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@suite/shared/ui'
import type { EquationBlock } from './blocks'
import { EquationEditor, type SubBlockContext } from './EquationEditor'
import { useUnitColors } from './useUnitColors'

vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) {
    customElements.define('math-field', class extends HTMLElement {
      value = ''
      connectedCallback() { this.tabIndex = 0 }
      insert(fragment: string) { this.value += fragment.replace(/#[0?]/g, '') }
    })
  }
  return {}
})

const block: EquationBlock = {
  id: 'e1',
  type: 'equation',
  etapes: [{ id: 's1', left: '3x+2y+1', right: '5x+3y-4', operation: '' }],
}

const ctx: SubBlockContext = {
  index: 0,
  onEnterBlock: vi.fn(),
  onDeleteEmpty: vi.fn(),
  onDeleteForward: vi.fn(),
  onExitBlock: vi.fn(),
  onFieldChange: vi.fn(),
  edge: { current: null },
}

function setup(onChange = vi.fn()) {
  const view = render(
    <TooltipProvider>
      <EquationEditor block={block} onChange={onChange} ctx={ctx} />
    </TooltipProvider>,
  )
  const root = view.container.querySelector('[data-like-terms-root]') as HTMLElement
  return { ...view, root, onChange, help: () => view.container.querySelector('[data-like-terms-help]') }
}

describe('EquationEditor : aide des termes semblables', () => {
  beforeEach(() => useUnitColors.setState({ enabled: true }))

  it('n\'affiche rien tant que le bloc n\'a pas le focus', () => {
    const { help } = setup()
    expect(help()).toBeNull()
  })

  it('affiche la ligne colorée quand le bloc a le focus, et la retire quand il le perd', () => {
    const { root, help, container } = setup()
    fireEvent.focusIn(root)
    expect(help()).not.toBeNull()
    expect(container.querySelectorAll('[data-like-terms-line]')).toHaveLength(1)
    fireEvent.focusOut(root, { relatedTarget: null })
    expect(help()).toBeNull()
  })

  it('garde l\'aide quand le focus passe d\'un champ à l\'autre du même bloc', () => {
    const { root, help } = setup()
    fireEvent.focusIn(root)
    fireEvent.focusOut(root, { relatedTarget: root.firstElementChild })
    expect(help()).not.toBeNull()
  })

  it('n\'affiche rien quand le réglage est coupé', () => {
    useUnitColors.setState({ enabled: false })
    const { root, help } = setup()
    fireEvent.focusIn(root)
    expect(help()).toBeNull()
  })

  it('ne modifie jamais la valeur de l\'élève', () => {
    const { root, onChange } = setup()
    fireEvent.focusIn(root)
    fireEvent.focusOut(root, { relatedTarget: null })
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- EquationEditor`
Attendu : échec (`root` est `null` : aucun `[data-like-terms-root]` n'existe encore).

- [ ] **Étape 3 : brancher l'aide**

Dans `EquationEditor.tsx`, remplacer la première ligne d'import et ajouter les autres :

```tsx
import { useState } from 'react'
import { EquationStepsField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'
import { useResolvedTheme } from '@suite/shared/theme'
import type { EquationBlock } from './blocks'
import { LikeTermsHelp } from './LikeTermsHelp'
import { toPlain, withIds } from './stepIds'
import { useUnitColors } from './useUnitColors'
```

puis remplacer le corps de `EquationEditor` (le commentaire de documentation au-dessus est conservé, complété) :

```tsx
/**
 * Le bloc Équation : l'éditeur partagé avec Mentale (`@suite/shared/equation`), branché sur les
 * étapes de Maths. Le moteur ne connaît pas les ids ; `withIds` les rend après chaque changement.
 *
 * Sous le champ, tant que le bloc a le focus et que la coloration est active, `LikeTermsHelp`
 * recompose les étapes en lecture seule avec les termes semblables de la même couleur. Le champ
 * lui-même n'est pas touché : l'aide ne passe jamais par `onChange`.
 */
export function EquationEditor({ block, onChange, ctx }: { block: EquationBlock; onChange: (patch: Partial<EquationBlock>) => void; ctx: SubBlockContext }) {
  const colorEnabled = useUnitColors(state => state.enabled)
  const theme = useResolvedTheme()
  const [focused, setFocused] = useState(false)
  return (
    <div
      data-like-terms-root
      onFocusCapture={() => setFocused(true)}
      // Le focus qui passe d'un champ à l'autre du bloc (Tab, flèches) fait un `blur` dont la cible
      // suivante est encore dans le bloc : l'aide ne doit ni disparaître ni clignoter.
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <EquationStepsField
        steps={toPlain(block.etapes)}
        onChange={next => onChange({ etapes: withIds(block.etapes, next) })}
        index={ctx.index}
        onEnterBlock={ctx.onEnterBlock}
        onDeleteEmpty={ctx.onDeleteEmpty}
        onDeleteForward={ctx.onDeleteForward}
        onExitBlock={ctx.onExitBlock}
        onFieldChange={ctx.onFieldChange}
        ref={ctx.edge}
      />
      {colorEnabled && focused && <LikeTermsHelp steps={block.etapes} theme={theme} />}
    </div>
  )
}
```

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

Run : `bun run --filter zachart-maths test -- EquationEditor` puis `bun run --filter zachart-maths test`
Attendu : les 5 nouveaux tests passent et toute la suite de `zachart-maths` aussi (les tests de `BlockStack` et d'`ExerciseWorkspace` qui rendent un bloc équation doivent passer : le `<div>` ajouté ne change ni les libellés ni la navigation au clavier). Si un test existant casse à cause du `<div>` englobant, le corriger minimalement et le dire dans le rapport ; si on ne sait pas si c'est le test ou le composant qui a tort, s'arrêter et le rapporter.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/EquationEditor.tsx apps/zachart-maths/src/exercises/EquationEditor.test.tsx
git commit -m "feat(zachart-maths): l'aide des termes semblables sous le bloc équation qui a le focus"
```

---

### Tâche 5 : libellé du bouton, documentation, vérification d'ensemble

**Fichiers :**
- Modifier : `apps/zachart-maths/src/commands.ts` (libellé et description de `view.toggleUnitColors`)
- Modifier : `apps/zachart-maths/src/App.test.tsx` (le nom du bouton dans le test existant)
- Modifier : `apps/zachart-maths/src/exercises/useUnitColors.ts` (le commentaire de doc cite l'ancien libellé)
- Modifier : `CLAUDE.md` (section « Zach'Math », après le point « Coloration des unités »)

- [ ] **Étape 1 : écrire le test qui échoue**

Dans `App.test.tsx`, dans le test « le bouton « Colorer les unités » bascule la coloration, et le choix est mémorisé », remplacer le titre par « le bouton « Colorer unités et termes » bascule la coloration, et le choix est mémorisé » et remplacer les deux `getByRole('button', { name: /Colorer les unités/ })` par `getByRole('button', { name: /Colorer unités et termes/ })`.

Run : `bun run --filter zachart-maths test -- App.test`
Attendu : échec (aucun bouton nommé « Colorer unités et termes »).

- [ ] **Étape 2 : changer le libellé**

Dans `commands.ts`, l'entrée `view.toggleUnitColors` devient :

```ts
  {
    id: 'view.toggleUnitColors',
    label: 'Colorer unités et termes',
    description: 'Colore les grandeurs et leurs unités (16 km, 3 km/h) dans l’énoncé, les textes et la réponse, et les termes semblables d’une équation (3x et 5x) dans l’aide sous le bloc.',
    category: 'view',
    defaultBinding: null,
  },
```

Dans `useUnitColors.ts`, remplacer `« Colorer les unités »` par `« Colorer unités et termes »` dans le commentaire de doc.

- [ ] **Étape 3 : documenter pour les prochains agents**

Dans `CLAUDE.md`, section `## Zach'Math (apps/zachart-maths)`, juste après le point `**Coloration des unités**`, ajouter :

```markdown
- **Termes semblables** (`likeTerms.ts`, `termColors.ts`, `LikeTermsHelp.tsx`) : `colorTerms(latex)` découpe un
  membre aux `+`/`−` de premier niveau en segments `{ text, group }` (`group` = partie littérale `x`, `xy`, `x^2` ;
  `''` constante ; `null` non coloré — parenthèses, fractions, racines, `/`, commande inconnue ; les segments
  recollés redonnent l'entrée) ; `assignTermColors(groups, theme)` donne une couleur HEXADÉCIMALE par groupe
  (`\colorbox` de KaTeX n'accepte pas `var(--…)`), attribuée sur TOUT le bloc ; `LikeTermsHelp` recompose les
  étapes en lecture seule (`\colorbox`, `renderMathToHtml`) sous le bloc équation tant qu'il a le focus et que le
  réglage est actif. Le champ MathLive n'est jamais modifié et l'aide n'appelle jamais `onChange`. Même bouton que
  les unités (`view.toggleUnitColors`, « Colorer unités et termes »).
```

- [ ] **Étape 4 : vérification d'ensemble**

```bash
bun run --filter zachart-maths test
bun run --filter @suite/shared test
bunx tsc --noEmit -p apps/zachart-maths
bunx tsc --noEmit -p packages/shared
```

Attendu : tout passe, aucune erreur de type. Si un test hors de ce plan échoue, lire l'erreur : le rapporter sans le corriger s'il n'a aucun lien avec la coloration. Les suites de `zachart-mentale` ne sont pas concernées par ce plan (aucun de ses fichiers n'est touché) : ne pas les lancer en parallèle de tout le reste, elles dépassent leur délai de 5 s sous charge.

- [ ] **Étape 5 : commit**

```bash
git add apps/zachart-maths/src/commands.ts apps/zachart-maths/src/App.test.tsx apps/zachart-maths/src/exercises/useUnitColors.ts CLAUDE.md
git commit -m "feat(zachart-maths): le bouton colore les unités et les termes, et la doc suit"
```

**Contrôle visuel (humain, hors plan d'agent) :** `bun run --filter zachart-maths tauri dev`, ouvrir un exercice, ajouter un bloc Équation, écrire `3x+2y+1` à gauche et `5x+3y-4` à droite, puis vérifier en thème clair et sombre : les `x` d'une couleur, les `y` d'une autre, les constantes en gris, la ligne lisible, le signe qui reste avec son terme, aucun saut des blocs suivants à la frappe, la ligne qui disparaît en sortant du bloc et ne clignote pas en passant de gauche à droite, et le champ MathLive intact.

---

## Auto-relecture

**Couverture du spec.** Analyseur (tâche 1), couleurs hexadécimales par thème et attribution sur tout le bloc (tâche 2), ligne KaTeX avec `\colorbox`, deux termes colorés minimum, hauteur minimale, `aria-hidden` (tâche 3), suivi du focus par `onFocusCapture`/`onBlurCapture` avec `relatedTarget`, réglage actif, champ non modifié (tâche 4), même bouton et libellé « Colorer unités et termes », documentation (tâche 5). Les décisions confirmées (groupe à un seul terme coloré ; toutes les étapes du bloc) sont dans les tâches 1 et 3. Les « Suites possibles » du spec restent hors plan.

**Types cohérents.** `TermSegment { text, group }` et `colorTerms` (tâche 1) sont consommés tels quels en tâches 3 et 5 ; `assignTermColors(groups, theme): Map<string, string>` et `Theme` (tâche 2) en tâche 3 ; `coloredLatex(segments, colors)` et `LikeTermsHelp({ steps, theme })` (tâche 3) en tâche 4 ; `useUnitColors` (existant) en tâche 4.

**Points à surveiller à l'exécution.** La sortie réelle de KaTeX pour `\colorbox` fixe le sélecteur du test de la tâche 3 : le vérifier sur le HTML produit, pas de mémoire. Le `<div>` englobant de la tâche 4 peut gêner un test existant de `BlockStack`. Le contrôle visuel est le seul garde-fou du rendu des couleurs (lisibilité du texte sur fond, espacement des signes dans les boîtes).
