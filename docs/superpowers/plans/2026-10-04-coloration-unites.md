# Coloration des quantités et des unités — plan d'implémentation

> **Pour les agents d'exécution :** utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour réaliser ce plan tâche par tâche. Les étapes utilisent des cases `- [ ]`.

**But :** dans Zach'Math, colorer d'un fond les quantités (`16 km`, `3 km/h`, `x km/h`) et les unités composées seules (`km/h`), une couleur par unité sur tout l'exercice, activable par un bouton de la barre du haut.

**Architecture :** deux modules purs (`quantities.ts` trouve les grandeurs d'un texte, `unitColors.ts` attribue une teinte par unité), un store zustand pour le toggle, et un composant `HighlightedTextarea` qui place un calque miroir coloré derrière chaque `<textarea>` transparent. Les teintes de l'exercice arrivent aux champs par un contexte React.

**Pile :** React 19, TypeScript, zustand, Vitest + Testing Library, Bun. Tout vit dans `apps/zachart-maths/src/`.

**Spec :** `docs/superpowers/specs/2026-10-04-coloration-unites-design.md` (à lire avant de commencer).

## Contraintes globales

- Rien dans `packages/shared`, rien dans `apps/zachart-mentale` : la règle « shared n'importe jamais d'une app » ne change pas, et Mentale n'est pas touchée.
- Champs couverts : l'énoncé, les blocs `texte` des zones A et B, la réponse. Hors périmètre : formules MathLive (calcul, équation), cellules de tableau, cours Markdown, export.
- Toggle activé par défaut ; clé `localStorage` `zachart-maths:unit-colors` (`'off'` quand coupé, absent ou `'on'` sinon).
- Lettres de variable : `x y z t v d n`. Une inconnue n'est colorée que suivie d'une unité ; un `x` seul ne l'est pas.
- Une unité d'un seul caractère (`m h g s t L € ° %`, sans puissance) n'est jamais colorée seule : seulement derrière un nombre. Une inconnue ne se combine pas avec une unité d'un seul caractère.
- Une unité n'est reconnue que si elle n'est ni précédée ni suivie d'une lettre.
- Palette de 8 teintes, attribuées à la première apparition de chaque unité, dans l'ordre énoncé → zone A → zone B → réponse ; au-delà de 8 on recommence.
- Les `<mark>` du miroir ne changent aucune métrique (ni padding, ni bordure, ni marge) et ont `color: transparent`.
- Les textes de l'app sont en français ; les commentaires expliquent le pourquoi, en français, comme dans le code voisin.
- On n'ajoute **jamais** de fichier avec `git add -A` : chemins explicites. Le dépôt contient déjà des modifications étrangères à ce plan (cours, `ExerciseWorkspace.tsx` côté cadre bleu, `packages/shared`) ; ne les inclure dans aucun commit de ce plan sauf mention.

## Points de vigilance (Review Focus)

Les cas que le spec implique et qu'aucune tâche ne testerait sans qu'on les liste. Chacun a un test dans la tâche indiquée.

1. **Saisie de la toute première unité** : le champ passe de « aucune teinte » à « une teinte » ; si l'arbre React change de forme à ce moment, le `<textarea>` est remonté et le curseur saute. Test en tâche 4.
2. **Mots qui ressemblent à des unités** : « 16 kilos », « 3 solutions », « mètres », la lettre `s` d'un mot, `t s`. Tests en tâche 1.
3. **Plus de 8 unités** dans un exercice : la palette recommence sans planter. Test en tâche 2.
4. **Bloc de type inconnu, `blocsB` absent, `null` dans `blocs`** : le calcul des textes ne plante pas. Test en tâche 2.
5. **`localStorage` indisponible ou corrompu** : le toggle retombe sur « activé » et la bascule ne plante pas. Test en tâche 3.
6. **Texte se terminant par un saut de ligne** : le miroir garde la hauteur du champ. Test en tâche 4.

---

### Tâche 1 : détection des grandeurs (`quantities.ts`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/quantities.ts`
- Test : `apps/zachart-maths/src/exercises/quantities.test.ts`

**Interfaces :**
- Consomme : rien.
- Produit : `interface Quantity { start: number; end: number; unit: string; kind: 'valeur' | 'unite' }` et `findQuantities(text: string): Quantity[]` (triée par `start`, sans chevauchement ; `start`/`end` sont des indices dans `text`, `end` exclu ; `unit` est la forme canonique : `km`, `km/h`, `m²`, `L`…).

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/zachart-maths/src/exercises/quantities.test.ts
import { describe, expect, it } from 'vitest'
import { findQuantities } from './quantities'

/** Ce que `findQuantities` trouve, vu comme le texte coupé : plus lisible que des indices. */
const found = (text: string) => findQuantities(text).map(q => ({ text: text.slice(q.start, q.end), unit: q.unit, kind: q.kind }))

describe('findQuantities', () => {
  it('trouve une valeur et son unité, accolées ou non', () => {
    expect(found('16 km')).toEqual([{ text: '16 km', unit: 'km', kind: 'valeur' }])
    expect(found('16km')).toEqual([{ text: '16km', unit: 'km', kind: 'valeur' }])
  })

  it("trouve la vitesse et la distance de l'exemple, chacune avec son unité", () => {
    expect(found('Je vais à 3 km/h, en combien de temps je fais 16 km ?')).toEqual([
      { text: '3 km/h', unit: 'km/h', kind: 'valeur' },
      { text: '16 km', unit: 'km', kind: 'valeur' },
    ])
  })

  it('reconnaît une inconnue suivie d\'une unité', () => {
    expect(found('x km/h')).toEqual([{ text: 'x km/h', unit: 'km/h', kind: 'valeur' }])
    expect(found('t min')).toEqual([{ text: 't min', unit: 'min', kind: 'valeur' }])
  })

  it('trouve une unité composée seule, et une unité longue seule', () => {
    expect(found('en km/h')).toEqual([{ text: 'km/h', unit: 'km/h', kind: 'unite' }])
    expect(found('exprime en min')).toEqual([{ text: 'min', unit: 'min', kind: 'unite' }])
    expect(found('une aire en m²')).toEqual([{ text: 'm²', unit: 'm²', kind: 'unite' }])
  })

  it('ne colore pas une unité d\'une lettre sans nombre devant', () => {
    expect(found('un m')).toEqual([])
    expect(found('exprimer en h')).toEqual([])
    expect(found('la lettre s')).toEqual([])
  })

  it('colore une unité d\'une lettre derrière un nombre', () => {
    expect(found('il court 3 s')).toEqual([{ text: '3 s', unit: 's', kind: 'valeur' }])
    expect(found('5 m')).toEqual([{ text: '5 m', unit: 'm', kind: 'valeur' }])
  })

  it('ne combine pas une inconnue avec une unité d\'un seul caractère', () => {
    expect(found('t s')).toEqual([])
    expect(found('x m')).toEqual([])
  })

  it('ne confond pas un mot avec une unité', () => {
    expect(found('16 kilos')).toEqual([])
    expect(found('3 solutions')).toEqual([])
    expect(found('12 mètres')).toEqual([])
  })

  it('ne prend pas la lettre d\'un mot pour une inconnue', () => {
    // Le « x » de « max » n'en est pas une ; « km » reste une unité longue, colorée seule.
    expect(found('max km')).toEqual([{ text: 'km', unit: 'km', kind: 'unite' }])
  })

  it('lit les décimales à virgule ou à point, et les milliers séparés par une espace', () => {
    expect(found('3,5 km')).toEqual([{ text: '3,5 km', unit: 'km', kind: 'valeur' }])
    expect(found('3.5 km')).toEqual([{ text: '3.5 km', unit: 'km', kind: 'valeur' }])
    expect(found('1 200 m')).toEqual([{ text: '1 200 m', unit: 'm', kind: 'valeur' }])
    expect(found('1 200 m')).toEqual([{ text: '1 200 m', unit: 'm', kind: 'valeur' }])
  })

  it('reconnaît %, €, ° et les puissances', () => {
    expect(found('25 %')).toEqual([{ text: '25 %', unit: '%', kind: 'valeur' }])
    expect(found('25%')).toEqual([{ text: '25%', unit: '%', kind: 'valeur' }])
    expect(found('12 €')).toEqual([{ text: '12 €', unit: '€', kind: 'valeur' }])
    expect(found('90°')).toEqual([{ text: '90°', unit: '°', kind: 'valeur' }])
    expect(found('5 m²')).toEqual([{ text: '5 m²', unit: 'm²', kind: 'valeur' }])
    expect(found('4 m^2')).toEqual([{ text: '4 m^2', unit: 'm²', kind: 'valeur' }])
    expect(found('2 kg/m³')).toEqual([{ text: '2 kg/m³', unit: 'kg/m³', kind: 'valeur' }])
    expect(found('12 €/kg')).toEqual([{ text: '12 €/kg', unit: '€/kg', kind: 'valeur' }])
  })

  it('met les litres sous une forme unique', () => {
    expect(found('2 l')).toEqual([{ text: '2 l', unit: 'L', kind: 'valeur' }])
    expect(found('25 cl')).toEqual([{ text: '25 cl', unit: 'cL', kind: 'valeur' }])
    expect(found('3 mL')).toEqual([{ text: '3 mL', unit: 'mL', kind: 'valeur' }])
  })

  it('ne trouve pas deux fois la même unité (valeur + unité seule)', () => {
    expect(findQuantities('16 km')).toHaveLength(1)
    expect(findQuantities('3 km/h')).toHaveLength(1)
  })

  it('donne des indices exacts dans le texte', () => {
    const text = 'Il fait 16 km puis 4 km.'
    const [first, second] = findQuantities(text)
    expect(first.start).toBe(text.indexOf('16 km'))
    expect(first.end).toBe(text.indexOf('16 km') + '16 km'.length)
    expect(second.start).toBe(text.indexOf('4 km'))
  })

  it('ne trouve rien dans un texte sans grandeur', () => {
    expect(found('Résous x + 3 = 5')).toEqual([])
    expect(found('')).toEqual([])
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- quantities`
Attendu : échec, `Cannot find module './quantities'` (ou import introuvable).

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// apps/zachart-maths/src/exercises/quantities.ts

/**
 * Une grandeur trouvée dans un texte : une valeur et son unité (`16 km`, `x km/h`) ou une unité
 * composée toute seule (`km/h`). `unit` est la forme canonique, celle qui sert de clé de couleur :
 * `16 km` et `4km` partagent `km`, `4 m^2` devient `m²`, `2 l` devient `L`.
 */
export interface Quantity {
  start: number
  /** Exclu, comme pour `String.slice`. */
  end: number
  unit: string
  /** `valeur` : un nombre ou une inconnue précède l'unité ; `unite` : l'unité est seule. */
  kind: 'valeur' | 'unite'
}

const BASE_CANON: Record<string, string> = { l: 'L', dl: 'dL', cl: 'cL', ml: 'mL' }

// Les unités à plusieurs lettres passent avant celles d'une lettre : `min` avant `m`, `km` avant `m`.
const LONG_BASES = 'km|dm|cm|mm|kg|mg|min|ms|dL|dl|cL|cl|mL|ml'
const SHORT_BASES = 'm|g|t|h|s|L|l|€|°|%'
const BASE = `(?:${LONG_BASES}|${SHORT_BASES})`
const POWER = '(?:²|³|\\^2|\\^3)'
const OPT_POWER = `${POWER}?`
/** Une unité, composée ou non : `km`, `m²`, `km/h`, `kg/m³`. */
const UNIT = `${BASE}${OPT_POWER}(?:/${BASE}${OPT_POWER})?`

const SPACE = '[\\u0020\\u00a0\\u202f]'
const NUMBER = `\\d+(?:${SPACE}\\d{3})*(?:[.,]\\d+)?`
const VARIABLE = '[xyztvdn]'

// Ni lettre ni chiffre avant, pas de lettre après : « 16 kilos », « 3 solutions » et « max km » n'en sont pas.
const START = '(?<![\\p{L}\\d])'
const END = '(?![\\p{L}])'

const VALUE = new RegExp(`${START}(?:${NUMBER}|${VARIABLE})${SPACE}?(${UNIT})${END}`, 'gu')

// Une unité seule n'est colorée que si rien ne la confond avec une lettre ou un mot : composée,
// longue, ou portant une puissance. `m`, `h` ou `s` tout seuls ne le sont jamais.
const BARE = new RegExp(
  `${START}(?:${BASE}${OPT_POWER}/${BASE}${OPT_POWER}|(?:${LONG_BASES})${OPT_POWER}|${BASE}${POWER})${END}`,
  'gu',
)

function canonical(raw: string): string {
  return raw
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .split('/')
    .map(part => {
      const power = /[²³]$/.exec(part)?.[0] ?? ''
      const base = part.slice(0, part.length - power.length)
      return (BASE_CANON[base] ?? base) + power
    })
    .join('/')
}

/** Les grandeurs d'un texte, dans l'ordre, sans chevauchement. */
export function findQuantities(text: string): Quantity[] {
  const found: Quantity[] = []
  for (const match of text.matchAll(VALUE)) {
    const unit = canonical(match[1])
    // Une inconnue (« t ») devant une unité d'un caractère (« s ») n'est presque jamais une grandeur.
    if (!/\d/.test(match[0][0]) && unit.length < 2) continue
    found.push({ start: match.index, end: match.index + match[0].length, unit, kind: 'valeur' })
  }
  for (const match of text.matchAll(BARE)) {
    const start = match.index
    const end = start + match[0].length
    if (found.some(q => start < q.end && end > q.start)) continue
    found.push({ start, end, unit: canonical(match[0]), kind: 'unite' })
  }
  return found.sort((a, b) => a.start - b.start)
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- quantities`
Attendu : tous les tests de `quantities.test.ts` passent. Si un cas limite échoue, corriger l'expression régulière, pas le test (les attentes viennent du spec).

- [ ] **Étape 5 : vérifier les types, puis committer**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/quantities.ts apps/zachart-maths/src/exercises/quantities.test.ts
git commit -m "feat(zachart-maths): détecte les grandeurs et leurs unités dans un texte"
```

---

### Tâche 2 : une teinte par unité (`unitColors.ts`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/unitColors.ts`
- Test : `apps/zachart-maths/src/exercises/unitColors.test.ts`

**Interfaces :**
- Consomme : `findQuantities(text): Quantity[]` (tâche 1) ; le type `Exercise` de `./types`.
- Produit : `UNIT_HUES: readonly number[]` (8 teintes) ; `assignHues(texts: readonly string[]): Map<string, number>` (unité canonique → teinte) ; `exerciseTexts(exercise): string[]` (énoncé, blocs texte de la zone A, blocs texte de la zone B, réponse, dans cet ordre).

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/zachart-maths/src/exercises/unitColors.test.ts
import { describe, expect, it } from 'vitest'
import { assignHues, exerciseTexts, UNIT_HUES } from './unitColors'

describe('assignHues', () => {
  it('donne une teinte à chaque unité, dans l\'ordre où elles apparaissent', () => {
    const hues = assignHues(['Je vais à 3 km/h, je fais 16 km ?'])
    expect(hues.get('km/h')).toBe(UNIT_HUES[0])
    expect(hues.get('km')).toBe(UNIT_HUES[1])
  })

  it('garde la même teinte pour une unité d\'un texte à l\'autre', () => {
    const hues = assignHues(['3 km/h et 16 km', '4 km', 'x km/h'])
    expect(hues.size).toBe(2)
    expect(hues.get('km')).toBe(UNIT_HUES[1])
    expect(hues.get('km/h')).toBe(UNIT_HUES[0])
  })

  it('ne donne rien à un texte sans grandeur', () => {
    expect(assignHues(['Résous x + 3 = 5', '']).size).toBe(0)
  })

  it('recommence la palette au-delà de huit unités, sans planter', () => {
    const hues = assignHues(['1 km 1 m 1 kg 1 g 1 h 1 s 1 L 1 € 1 min'])
    expect(hues.size).toBe(9)
    expect(hues.get('min')).toBe(UNIT_HUES[0])
  })
})

describe('exerciseTexts', () => {
  const base = { enonce: 'Énoncé', reponse: 'Réponse' }

  it('range les textes : énoncé, zone A, zone B, réponse', () => {
    const texts = exerciseTexts({
      ...base,
      blocs: [{ id: 'a', type: 'texte', contenu: 'A1' }, { id: 'b', type: 'calcul', lignes: [] }, { id: 'c', type: 'texte', contenu: 'A2' }],
      blocsB: [{ id: 'd', type: 'texte', contenu: 'B1' }],
    })
    expect(texts).toEqual(['Énoncé', 'A1', 'A2', 'B1', 'Réponse'])
  })

  it('supporte une zone B absente, un bloc inconnu et des valeurs inattendues', () => {
    const texts = exerciseTexts({
      ...base,
      blocs: [null, 42, { id: 'x', type: 'inconnu' }, { id: 'y', type: 'texte' }, { id: 'z', type: 'texte', contenu: 12 }],
    })
    expect(texts).toEqual(['Énoncé', 'Réponse'])
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- unitColors`
Attendu : échec, module `./unitColors` introuvable.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// apps/zachart-maths/src/exercises/unitColors.ts
import { findQuantities } from './quantities'
import type { Exercise } from './types'

/**
 * Les teintes (HSL) que reçoivent les unités, dans l'ordre. Le bleu de l'énoncé et de la réponse
 * n'est pas en tête : la première unité d'un exercice ne doit pas se fondre dans leur cadre.
 */
export const UNIT_HUES = [150, 30, 280, 340, 175, 60, 215, 100] as const

/**
 * Une teinte par unité, attribuée à sa première apparition en parcourant `texts` dans l'ordre :
 * `16 km` et `4 km` ont donc la même couleur partout dans l'exercice. Au-delà de huit unités la
 * palette recommence, deux unités peuvent alors se ressembler : mieux vaut cela qu'un refus.
 */
export function assignHues(texts: readonly string[]): Map<string, number> {
  const hues = new Map<string, number>()
  for (const text of texts) {
    for (const quantity of findQuantities(text)) {
      if (!hues.has(quantity.unit)) hues.set(quantity.unit, UNIT_HUES[hues.size % UNIT_HUES.length])
    }
  }
  return hues
}

const isTextBlock = (block: unknown): block is { type: 'texte'; contenu: string } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'texte' &&
  typeof (block as { contenu?: unknown }).contenu === 'string'

/**
 * Les textes d'un exercice que la coloration couvre, dans l'ordre de lecture : l'énoncé, les blocs
 * texte de la zone A puis de la zone B, la réponse. Les blocs de formule, de tableau et ceux d'un
 * type inconnu n'y sont pas : leur contenu n'est pas du texte libre.
 */
export function exerciseTexts(exercise: Pick<Exercise, 'enonce' | 'blocs' | 'blocsB' | 'reponse'>): string[] {
  return [
    exercise.enonce,
    ...exercise.blocs.filter(isTextBlock).map(block => block.contenu),
    ...(exercise.blocsB ?? []).filter(isTextBlock).map(block => block.contenu),
    exercise.reponse,
  ]
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- unitColors`
Attendu : tous les tests passent.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/unitColors.ts apps/zachart-maths/src/exercises/unitColors.test.ts
git commit -m "feat(zachart-maths): une teinte par unité, attribuée sur tout l'exercice"
```

---

### Tâche 3 : l'état du toggle (`useUnitColors.ts`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/useUnitColors.ts`
- Test : `apps/zachart-maths/src/exercises/useUnitColors.test.ts`

**Interfaces :**
- Consomme : zustand (déjà une dépendance de l'app).
- Produit : `UNIT_COLORS_KEY = 'zachart-maths:unit-colors'` ; `useUnitColors` : un store `{ enabled: boolean; toggle(): void }`, lisible par `useUnitColors(s => s.enabled)` ou `useUnitColors.getState()`.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/zachart-maths/src/exercises/useUnitColors.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const load = async () => (await import('./useUnitColors')).useUnitColors

describe('useUnitColors', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })
  afterEach(() => vi.restoreAllMocks())

  it('est activé par défaut', async () => {
    expect((await load()).getState().enabled).toBe(true)
  })

  it('relit un réglage coupé', async () => {
    localStorage.setItem('zachart-maths:unit-colors', 'off')
    expect((await load()).getState().enabled).toBe(false)
  })

  it('bascule et mémorise le choix', async () => {
    const store = await load()
    store.getState().toggle()
    expect(store.getState().enabled).toBe(false)
    expect(localStorage.getItem('zachart-maths:unit-colors')).toBe('off')
    store.getState().toggle()
    expect(store.getState().enabled).toBe(true)
    expect(localStorage.getItem('zachart-maths:unit-colors')).toBe('on')
  })

  it('retombe sur « activé » si le stockage est indisponible, et bascule quand même', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage indisponible')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage indisponible')
    })
    const store = await load()
    expect(store.getState().enabled).toBe(true)
    expect(() => store.getState().toggle()).not.toThrow()
    expect(store.getState().enabled).toBe(false)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- useUnitColors`
Attendu : échec, module `./useUnitColors` introuvable.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// apps/zachart-maths/src/exercises/useUnitColors.ts
import { create } from 'zustand'

export const UNIT_COLORS_KEY = 'zachart-maths:unit-colors'

/** Activé tant qu'on n'a pas écrit `off` : un stockage absent ou illisible ne coupe pas la fonction. */
function readEnabled(): boolean {
  try {
    return localStorage.getItem(UNIT_COLORS_KEY) !== 'off'
  } catch {
    return true
  }
}

interface UnitColorsStore {
  enabled: boolean
  toggle(): void
}

/**
 * Le bouton « Colorer les unités » de la barre du haut. Un réglage immédiat : il ne passe pas par
 * « Enregistrer » de la fenêtre des Paramètres, comme le thème.
 */
export const useUnitColors = create<UnitColorsStore>((set, get) => ({
  enabled: readEnabled(),
  toggle: () => {
    const enabled = !get().enabled
    set({ enabled })
    try {
      localStorage.setItem(UNIT_COLORS_KEY, enabled ? 'on' : 'off')
    } catch {
      // Stockage indisponible : le choix vaut pour la session, il ne survivra pas au redémarrage.
    }
  },
}))
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- useUnitColors`
Attendu : 4 tests passent.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/useUnitColors.ts apps/zachart-maths/src/exercises/useUnitColors.test.ts
git commit -m "feat(zachart-maths): l'état du bouton qui colore les unités, mémorisé"
```

---

### Tâche 4 : le champ à calque miroir (`HighlightedTextarea.tsx`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/HighlightedTextarea.tsx`
- Test : `apps/zachart-maths/src/exercises/HighlightedTextarea.test.tsx`

**Interfaces :**
- Consomme : `findQuantities` (tâche 1), `assignHues` (tâche 2, dans les tests), `useUnitColors` (tâche 3), `toneOf(hue: number): string` de `./toolbarCatalog`.
- Produit : `UnitHuesContext: Context<ReadonlyMap<string, number>>` (valeur par défaut : une `Map` vide) ; `HighlightedTextarea(props: ComponentProps<'textarea'>)` : un `<textarea>` qui accepte exactement les props d'un `<textarea>` (dont `ref`), plus un calque `<div aria-hidden data-unit-mirror>` contenant des `<mark data-unit="…">` quand le réglage est actif.

**Disposition (à respecter) :**
- Réglage coupé : le composant rend le `<textarea>` seul, avec `className` et `style` reçus.
- Réglage actif : un `<div>` enveloppe `position: relative; width: 100%; min-width: 0; background: var(--background); border-radius: 4px`, contenant le miroir (même `className` que le champ, `position: absolute; inset: 0; overflow: hidden; pointer-events: none; white-space: pre-wrap; overflow-wrap: break-word; background: transparent; border-color: transparent; color: transparent`) puis le `<textarea>` (`position: relative; display: block; background: transparent`).
- L'arbre ne dépend **que** du réglage, jamais de la présence de teintes : sinon la première unité tapée remonterait le `<textarea>` et ferait sauter le curseur.

- [ ] **Étape 1 : écrire le test qui échoue**

```tsx
// apps/zachart-maths/src/exercises/HighlightedTextarea.test.tsx
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { HighlightedTextarea, UnitHuesContext } from './HighlightedTextarea'
import { assignHues } from './unitColors'
import { useUnitColors } from './useUnitColors'

const marks = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('mark')]

function Field({ text, hues }: { text: string; hues: ReadonlyMap<string, number> }) {
  return (
    <UnitHuesContext value={hues}>
      <HighlightedTextarea aria-label="champ" value={text} onChange={() => {}} className="w-full" />
    </UnitHuesContext>
  )
}

/** Un champ contrôlé dont les teintes viennent de son propre texte, comme dans l'app. */
function Live() {
  const [value, setValue] = useState('')
  return (
    <UnitHuesContext value={assignHues([value])}>
      <HighlightedTextarea aria-label="champ" value={value} onChange={e => setValue(e.target.value)} />
    </UnitHuesContext>
  )
}

describe('HighlightedTextarea', () => {
  beforeEach(() => useUnitColors.setState({ enabled: true }))

  it('marque chaque grandeur du texte, avec la teinte de son unité', () => {
    const text = '3 km/h et 16 km, puis 4 km'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    const found = marks(container)
    expect(found.map(m => m.textContent)).toEqual(['3 km/h', '16 km', '4 km'])
    expect(found.map(m => m.dataset.unit)).toEqual(['km/h', 'km', 'km'])
    expect(found[1].style.background).toBe(found[2].style.background)
    expect(found[0].style.background).not.toBe(found[1].style.background)
  })

  it('rend le texte des marques invisible : seul le champ au-dessus s\'écrit', () => {
    const text = '16 km'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    expect(marks(container)[0]).toHaveStyle({ color: 'transparent' })
  })

  it('reproduit exactement le texte du champ dans le miroir', () => {
    const text = 'Il fait 16 km\npuis 4 km.'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    expect(container.querySelector('[data-unit-mirror]')!.textContent).toBe(text)
  })

  it('garde la hauteur de la dernière ligne quand le texte finit par un saut de ligne', () => {
    const text = '16 km\n'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    expect(container.querySelector('[data-unit-mirror]')!.textContent).toBe('16 km\n​')
  })

  it('ne marque rien sans teinte connue pour l\'unité', () => {
    const { container } = render(<Field text="16 km" hues={new Map()} />)
    expect(marks(container)).toHaveLength(0)
  })

  it('réglage coupé : un simple champ, sans miroir ni marque', () => {
    useUnitColors.setState({ enabled: false })
    const text = '16 km'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    expect(container.querySelector('[data-unit-mirror]')).toBeNull()
    expect(marks(container)).toHaveLength(0)
    expect(screen.getByLabelText('champ')).toHaveValue(text)
  })

  it('transmet ses props au champ (libellé, valeur)', () => {
    render(<Field text="abc" hues={new Map()} />)
    expect(screen.getByLabelText('champ')).toHaveValue('abc')
  })

  it('garde le focus quand la toute première unité apparaît en tapant', async () => {
    const user = userEvent.setup()
    const { container } = render(<Live />)
    const field = screen.getByLabelText('champ')
    await user.click(field)
    await user.type(field, '3 km')
    expect(field).toHaveFocus()
    expect(screen.getByLabelText('champ')).toBe(field)
    expect(marks(container).map(m => m.textContent)).toEqual(['3 km'])
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- HighlightedTextarea`
Attendu : échec, module `./HighlightedTextarea` introuvable.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```tsx
// apps/zachart-maths/src/exercises/HighlightedTextarea.tsx
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'
import { findQuantities } from './quantities'
import { toneOf } from './toolbarCatalog'
import { useUnitColors } from './useUnitColors'

/**
 * La teinte de chaque unité de l'exercice ouvert (voir `assignHues`), fournie par l'espace de
 * travail. Vide hors d'un exercice : rien n'est coloré.
 */
export const UnitHuesContext = createContext<ReadonlyMap<string, number>>(new Map())

/** Le texte découpé : les grandeurs dans un `<mark>`, le reste tel quel. */
function marked(text: string, hues: ReadonlyMap<string, number>): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const quantity of findQuantities(text)) {
    const hue = hues.get(quantity.unit)
    if (hue === undefined) continue
    if (quantity.start > cursor) nodes.push(text.slice(cursor, quantity.start))
    nodes.push(
      // Aucune métrique ajoutée (ni padding, ni bordure, ni marge) : le texte du miroir doit
      // rester exactement sous celui du champ. `color` explicite : la feuille de style du
      // navigateur donne du noir à `mark`, qui doublerait le texte du champ.
      <mark
        key={quantity.start}
        data-unit={quantity.unit}
        style={{ background: toneOf(hue), color: 'transparent', borderRadius: 3 }}
      >
        {text.slice(quantity.start, quantity.end)}
      </mark>,
    )
    cursor = quantity.end
  }
  nodes.push(text.slice(cursor))
  // Un saut de ligne final n'a pas de hauteur dans un bloc : sans ce caractère de largeur nulle,
  // le miroir serait plus court d'une ligne que le champ.
  if (text.endsWith('\n')) nodes.push('​')
  return nodes
}

/**
 * Un `<textarea>` dont les grandeurs (`16 km`, `3 km/h`) sont colorées PENDANT la saisie.
 *
 * Un `<textarea>` ne colore pas une partie de son texte. Le texte est donc reproduit derrière lui,
 * dans un calque aux métriques identiques (même `className`, même `white-space`), où seuls les
 * fonds des `<mark>` se voient ; le champ, transparent, est posé par-dessus. Les champs de l'app
 * s'agrandissent déjà à leur contenu (`rows`), donc il n'y a pas de défilement à synchroniser.
 *
 * L'arbre ne dépend que du réglage, jamais de la présence de teintes : si la forme changeait au
 * moment où la première unité est tapée, React remonterait le champ et le curseur sauterait.
 */
export function HighlightedTextarea({ className, style, ref, ...props }: ComponentProps<'textarea'>) {
  const enabled = useUnitColors(state => state.enabled)
  const hues = useContext(UnitHuesContext)
  if (!enabled) return <textarea ref={ref} className={className} style={style} {...props} />
  const text = typeof props.value === 'string' ? props.value : ''
  return (
    <div style={{ position: 'relative', width: '100%', minWidth: 0, background: 'var(--background)', borderRadius: 4 }}>
      <div
        aria-hidden
        data-unit-mirror
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          background: 'transparent',
          borderColor: 'transparent',
          color: 'transparent',
        }}
      >
        {marked(text, hues)}
      </div>
      <textarea
        ref={ref}
        className={className}
        style={{ ...style, position: 'relative', display: 'block', background: 'transparent' }}
        {...props}
      />
    </div>
  )
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- HighlightedTextarea`
Attendu : 8 tests passent. Si « garde le focus » échoue, l'arbre change de forme quand les teintes apparaissent : vérifier que la condition de la branche ne porte que sur `enabled`.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/HighlightedTextarea.tsx apps/zachart-maths/src/exercises/HighlightedTextarea.test.tsx
git commit -m "feat(zachart-maths): un champ texte qui colore les grandeurs pendant la saisie"
```

---

### Tâche 5 : brancher les champs de l'exercice

**Fichiers :**
- Modifier : `apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx` (imports ; calcul des teintes après `const split = isSplit(exercise)` ; le fournisseur de contexte ; le `<textarea>` de l'énoncé, ~ligne 190 ; celui de la réponse, ~ligne 253)
- Modifier : `apps/zachart-maths/src/exercises/BlockStack.tsx` (import ; `TextEditor`, lignes 20-32)
- Test : `apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx` (ajout d'un `it`)

**Interfaces :**
- Consomme : `HighlightedTextarea`, `UnitHuesContext` (tâche 4) ; `assignHues`, `exerciseTexts` (tâche 2) ; `useUnitColors` (tâche 3, pour le test).
- Produit : rien de nouveau ; les champs énoncé, texte et réponse colorent leurs grandeurs.

- [ ] **Étape 1 : écrire le test qui échoue**

Dans `ExerciseWorkspace.test.tsx`, ajouter l'import `useUnitColors` avec les autres imports locaux :

```tsx
import { useUnitColors } from './useUnitColors'
```

puis, dans le `describe('ExerciseWorkspace', …)`, à la fin :

```tsx
  it('colore les grandeurs de l\'énoncé, des blocs texte et de la réponse, une teinte par unité', async () => {
    useUnitColors.setState({ enabled: true })
    await setup({
      'A/a.json': sheetFile('Vitesse', [
        ex('e1', {
          enonce: 'Je vais à 3 km/h, je fais 16 km ?',
          blocs: [{ id: 'b1', type: 'texte', contenu: 'Il reste 4 km.' }],
          reponse: '16 km en 5 h',
        }),
      ]),
    })
    await open('A/a.json')
    const km = [...document.querySelectorAll<HTMLElement>('mark[data-unit="km"]')]
    const kmh = [...document.querySelectorAll<HTMLElement>('mark[data-unit="km/h"]')]
    expect(km.map(m => m.textContent)).toEqual(['16 km', '4 km', '16 km'])
    expect(new Set(km.map(m => m.style.background)).size).toBe(1)
    expect(kmh.map(m => m.textContent)).toEqual(['3 km/h'])
    expect(kmh[0].style.background).not.toBe(km[0].style.background)
  })

  it('ne colore rien quand le réglage est coupé', async () => {
    useUnitColors.setState({ enabled: false })
    await setup({ 'A/a.json': sheetFile('Vitesse', [ex('e1', { enonce: '16 km' })]) })
    await open('A/a.json')
    expect(document.querySelectorAll('mark')).toHaveLength(0)
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('16 km')
    useUnitColors.setState({ enabled: true })
  })
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- ExerciseWorkspace`
Attendu : le premier nouveau test échoue (`km` est vide : aucun `<mark>`) ; les autres tests du fichier passent encore.

- [ ] **Étape 3 : brancher le composant**

Dans `ExerciseWorkspace.tsx`, ajouter aux imports :

```tsx
import { HighlightedTextarea, UnitHuesContext } from './HighlightedTextarea'
import { assignHues, exerciseTexts } from './unitColors'
```

Après `const split = isSplit(exercise)` (là où `blank` et `split` sont calculés, après les retours anticipés) :

```tsx
  // Une teinte par unité pour tout l'exercice : un champ la consulte, il ne parcourt pas l'exercice.
  const unitHues = assignHues(exerciseTexts(exercise))
```

Envelopper la section dans le fournisseur : remplacer

```tsx
    <SymbolInsertContext value={insertSymbol}>
    <section aria-label="Exercice"
```

par

```tsx
    <SymbolInsertContext value={insertSymbol}>
    <UnitHuesContext value={unitHues}>
    <section aria-label="Exercice"
```

(la suite de la ligne `<section …>` ne change pas) et, à la fin du composant, remplacer

```tsx
    </section>
    </SymbolInsertContext>
```

par

```tsx
    </section>
    </UnitHuesContext>
    </SymbolInsertContext>
```

Remplacer les deux `<textarea` du fichier (l'énoncé, `aria-label="Énoncé de l'exercice"`, et la réponse, `id="reponse-finale"`) par `<HighlightedTextarea` : leurs props (`ref`, `aria-label`, `value`, `rows`, `onChange`, `className`) ne changent pas, et la balise est auto-fermante comme avant.

Dans `BlockStack.tsx`, ajouter l'import :

```tsx
import { HighlightedTextarea } from './HighlightedTextarea'
```

et dans `TextEditor` remplacer `<textarea` par `<HighlightedTextarea` (même props).

- [ ] **Étape 4 : lancer les tests de l'app, vérifier qu'ils passent**

Run : `bun run --filter zachart-maths test`
Attendu : toute la suite de `zachart-maths` passe, y compris les tests existants de `ExerciseWorkspace`, `BlockStack` et des menus contextuels (le champ garde son `aria-label`, son focus et son menu de clic droit). Si un test existant échoue parce qu'un `<textarea>` n'est plus trouvé, vérifier que le composant transmet bien toutes les props et la `ref`.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/BlockStack.tsx apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx
git commit -m "feat(zachart-maths): l'énoncé, les blocs texte et la réponse colorent leurs unités"
```

Attention : `ExerciseWorkspace.tsx` contient déjà une modification qui n'est pas de ce plan (le cadre bleu de l'énoncé, non commitée). Ne l'ajouter qu'après avoir décidé avec l'utilisateur de la commiter avec ce changement ; sinon utiliser `git add -p apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx` et ne retenir que les hunks de cette tâche.

---

### Tâche 6 : le bouton de la barre du haut

**Fichiers :**
- Modifier : `apps/zachart-maths/src/commands.ts` (nouvelle commande, après `app.toggleTheme`)
- Modifier : `apps/zachart-maths/src/App.tsx` (imports ; `useCommand` ; bouton dans `toolbar`)
- Test : `apps/zachart-maths/src/App.test.tsx` (ajout d'un `it`)

**Interfaces :**
- Consomme : `useUnitColors` (tâche 3) ; `CommandButton`, `useCommand` de `@suite/shared/commands` (déjà importés dans `App.tsx`).
- Produit : la commande `view.toggleUnitColors` (libellé « Colorer les unités »), son bouton dans la barre du haut, sans raccourci par défaut.

- [ ] **Étape 1 : écrire le test qui échoue**

Dans `App.test.tsx`, ajouter l'import :

```tsx
import { useUnitColors } from './exercises/useUnitColors'
```

puis dans le `describe('App base', …)` :

```tsx
  it('le bouton « Colorer les unités » bascule la coloration, et le choix est mémorisé', async () => {
    useUnitColors.setState({ enabled: true })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Colorer les unités/ }))
    expect(useUnitColors.getState().enabled).toBe(false)
    expect(localStorage.getItem('zachart-maths:unit-colors')).toBe('off')
    await user.click(screen.getByRole('button', { name: /Colorer les unités/ }))
    expect(useUnitColors.getState().enabled).toBe(true)
    await act(async () => {})
  })
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- App.test`
Attendu : échec, aucun bouton nommé « Colorer les unités ».

- [ ] **Étape 3 : déclarer la commande, la brancher, ajouter le bouton**

Dans `commands.ts`, après l'entrée `app.toggleTheme` :

```ts
  {
    id: 'view.toggleUnitColors',
    label: 'Colorer les unités',
    description: 'Colore les grandeurs et leurs unités (16 km, 3 km/h) dans l’énoncé, les textes et la réponse.',
    category: 'view',
    defaultBinding: null,
  },
```

Dans `App.tsx` : ajouter `Highlighter` à l'import de `lucide-react`, ajouter l'import

```tsx
import { useUnitColors } from './exercises/useUnitColors'
```

dans le composant `App`, avec les autres `useCommand` :

```tsx
  const unitColors = useUnitColors(state => state.enabled)
  useCommand('view.toggleUnitColors', () => useUnitColors.getState().toggle())
```

et dans la `toolbar`, entre le bouton des notes et celui du thème :

```tsx
            <CommandButton command="view.toggleUnitColors" icon={Highlighter} variant={unitColors ? 'secondary' : 'ghost'} size="icon-sm" />
```

(`secondary` quand la coloration est active, `ghost` sinon : c'est le seul indice visuel de l'état, comme le bouton de scission des zones.)

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

Run : `bun run --filter zachart-maths test`
Attendu : toute la suite passe. Les tests existants de la palette de commandes (qui listent des commandes par leur nom) ne doivent pas casser : une commande de plus dans la catégorie « Affichage » est attendue.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/commands.ts apps/zachart-maths/src/App.tsx apps/zachart-maths/src/App.test.tsx
git commit -m "feat(zachart-maths): un bouton dans la barre du haut pour colorer les unités"
```

---

### Tâche 7 : documentation, vérification d'ensemble, contrôle visuel

**Fichiers :**
- Modifier : `CLAUDE.md` (section « Zach'Math », après le point `Toolbar`)

- [ ] **Étape 1 : documenter pour les prochains agents**

Dans la section `## Zach'Math (apps/zachart-maths)` de `CLAUDE.md`, après le point `**Toolbar**` (`toolbarCatalog.ts`), ajouter :

```markdown
- **Coloration des unités** (`quantities.ts`, `unitColors.ts`, `HighlightedTextarea.tsx`,
  `useUnitColors.ts`) : `findQuantities(text)` trouve les grandeurs (`16 km`, `3 km/h`, `x km/h`, `km/h`
  seul) ; `assignHues(exerciseTexts(exercise))` donne une teinte par unité canonique pour TOUT l'exercice
  (énoncé → zone A → zone B → réponse) ; `HighlightedTextarea` remplace les `<textarea>` de l'énoncé, des blocs
  texte et de la réponse : un calque miroir coloré derrière un champ transparent, dont l'arbre ne dépend QUE du
  réglage (jamais des teintes, sinon la première unité tapée remonte le champ et fait sauter le curseur). Les
  `<mark>` n'ajoutent aucune métrique et ont `color: transparent`. Les formules MathLive, les tableaux et les
  cours ne sont pas colorés. Réglage : bouton `view.toggleUnitColors` de la barre du haut, clé `localStorage`
  `zachart-maths:unit-colors`, activé par défaut.
```

- [ ] **Étape 2 : lancer toute la vérification**

```bash
bun run test
bunx tsc --noEmit -p apps/zachart-maths
bunx tsc --noEmit -p packages/shared
```

Attendu : toutes les suites passent, aucune erreur de type. Si un test hors de ce plan échoue, vérifier d'abord s'il échouait avant (`git stash` n'est pas nécessaire : lire l'erreur) et le signaler sans le corriger s'il est étranger à la coloration.

- [ ] **Étape 3 : mettre à jour le graphe de connaissances**

Run : `graphify update .`
Attendu : le graphe se reconstruit sans coût LLM (voir `CLAUDE.md`).

- [ ] **Étape 4 : contrôle visuel dans l'app (jsdom ne mesure pas la mise en page)**

Run : `bun run --filter zachart-maths tauri dev`, ouvrir un exercice, puis vérifier à l'œil, en thème clair puis sombre :
1. Écrire dans l'énoncé « Je vais à 3 km/h, en combien de temps je fais 16 km ? » : `3 km/h` et `16 km` ont deux fonds de couleurs différentes, le texte reste net (pas de texte doublé ni flou).
2. Écrire « Il reste 4 km. » dans un bloc texte : `4 km` prend la même couleur que `16 km`.
3. Taper un texte assez long pour passer à la ligne, dans l'énoncé et dans un bloc texte : le fond reste exactement sous les mots, sans décalage, y compris après un retour à la ligne.
4. Cliquer sur le bouton en forme de surligneur dans la barre du haut : les fonds disparaissent et le champ redevient un champ ordinaire ; recliquer : ils reviennent. Le bouton change d'aspect.
5. Taper la toute première unité dans un champ vide : le curseur ne saute pas.
6. Clic droit dans un champ coloré : le menu couper/copier/coller s'ouvre.
7. Le curseur et la sélection de texte restent visibles sur un fond coloré.

Noter tout décalage du miroir : c'est le risque principal de cette approche (voir le spec, « Risques »).

- [ ] **Étape 5 : commit**

```bash
git add CLAUDE.md
git commit -m "docs: la coloration des unités de Zach'Math, pour les prochains agents"
```

---

## Auto-relecture

**Couverture du spec.** Détection (tâche 1), teintes par unité sur tout l'exercice (tâche 2), toggle et mémorisation (tâches 3 et 6), calque miroir (tâche 4), champs couverts : énoncé, blocs texte, réponse (tâche 5), documentation et contrôle visuel (tâche 7). Décisions confirmées : activé par défaut (tâche 3), lettres `x y z t v d n` (tâche 1), réponse colorée (tâches 2 et 5). Les « Suites possibles » du spec sont hors plan, comme prévu.

**Types cohérents.** `Quantity { start, end, unit, kind }` et `findQuantities` (tâche 1) sont utilisés tels quels en tâches 2 et 4 ; `assignHues(texts): Map<string, number>` et `exerciseTexts(exercise)` (tâche 2) en tâches 4 et 5 ; `UnitHuesContext`, `HighlightedTextarea` (tâche 4) en tâche 5 ; `useUnitColors` avec `enabled` et `toggle` (tâche 3) en tâches 4, 5 et 6 ; clé `zachart-maths:unit-colors` identique partout.

**Points à surveiller à l'exécution.** Le contrôle visuel de la tâche 7 est le seul à pouvoir attraper une dérive du miroir. Les modifications déjà présentes dans l'arbre de travail (cadre bleu de `ExerciseWorkspace.tsx`, cours, `packages/shared`) ne doivent pas partir dans les commits de ce plan sans accord.
