# Coloration des tableaux par unité d'en-tête — plan d'implémentation

> **Pour les agents d'exécution :** utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour réaliser ce plan tâche par tâche. Les étapes utilisent des cases `- [ ]`.

**But :** dans un bloc Tableau de Zach'Math, quand l'en-tête d'une colonne (ou d'une ligne) est une unité, colorer toute la colonne (ou ligne) de la couleur de cette unité, la même que dans le reste de l'exercice.

**Architecture :** `quantities.ts` gagne `parseUnit` (un texte qui est tout entier une unité) ; `tableUnits.ts` lit un tableau (`headerUnit`, `tableLayout` : première ligne, sinon première colonne) ; `unitColors.ts` remplace `exerciseTexts` par `assignExerciseHues`, qui parcourt les blocs dans l'ordre de lecture et ajoute les unités d'en-tête de tableau ; `TableEditor` (dans `BlockStack.tsx`) pose un fond inline sur les `<input>` des cellules concernées.

**Pile :** React 19, TypeScript, Vitest + Testing Library, Bun. Tout vit dans `apps/zachart-maths/src/exercises/`.

**Spec :** `docs/superpowers/specs/2026-10-04-tableaux-unites-design.md` (à lire avant de commencer). Suite des coloration des unités et des termes semblables, déjà sur `main` ; même bouton (`view.toggleUnitColors`), même `useUnitColors`, même `UnitHuesContext`.

## Contraintes globales

- Rien dans `packages/shared` (`TableGrid` ne reçoit aucune nouvelle propriété), rien dans `apps/zachart-mentale`.
- Première ligne d'abord ; à défaut, première colonne ; quand les deux ont des unités, **la première ligne l'emporte**. La cellule du coin (ligne 0, colonne 0) n'est jamais un en-tête.
- Une cellule d'en-tête est une unité si, nettoyée, c'est **tout entière** une unité reconnue, ou si elle **finit** par une unité entre parenthèses ou crochets (`Distance (km)`, `Prix [€]`), ou par « en » suivi d'une unité (`Vitesse en km/h`). Une donnée comme `16 km` n'est pas un en-tête.
- Dans un en-tête, une unité d'une lettre (`h`, `s`, `m`, `g`) est acceptée ; la lettre `t` seule (ou `t²`, `t³`) est refusée : `t (s)` donne `s`.
- Seules les colonnes (ou lignes) dont l'en-tête est une unité sont colorées. Les unités écrites dans les cellules de données ne colorent rien.
- La teinte vient de la même attribution que pour le texte (`UNIT_HUES`, ordre de lecture énoncé → zone A → zone B → réponse, tableaux à leur place dans leur zone). Le fond d'une cellule est `toneOf(teinte)` ; celle d'en-tête, `headerToneOf(teinte)`, un cran plus soutenue.
- Le fond est inline sur le `<input>` de la cellule : il l'emporte sur `bg-background` ; bordure, focus et texte ne changent pas. Réglage coupé (`useUnitColors.enabled` faux) ou aucune unité : le tableau est celui d'aujourd'hui.
- Le comportement du texte ne change pas : les teintes attribuées aux unités des textes gardent leur ordre (l'ordre ne change que si un tableau apporte une unité nouvelle avant une autre).
- Les textes de l'app sont en français ; les commentaires expliquent le pourquoi, en français, comme dans le code voisin.
- Commits : chemins explicites, jamais `git add -A`. Ne rien pousser (le contrôleur pousse).

## Points de vigilance (Review Focus)

1. **Faux en-têtes** : une première ligne de nombres (`3 | 5`), une donnée avec unité (`16 km`), un mot qui commence comme une unité (`mètres`, `minutes`, `Entrée`), une cellule vide, un tableau 1×1 ou vide ne donnent jamais d'en-tête. Tests en tâches 1 et 2.
2. **Première ligne contre première colonne** : les deux ont des unités → la ligne l'emporte, la colonne n'est pas colorée ; le coin ignoré dans les deux sens. Tests en tâche 2 et 4.
3. **Unité d'une lettre uniquement dans un en-tête** (`h`) : elle reçoit une teinte (`findQuantities` ne la trouve pas dans un texte). Test en tâche 3.
4. **Tableau mal formé** dans un fichier (cellules qui ne sont pas des chaînes, lignes inégales, `cellules` absent) : aucune exception dans l'attribution des teintes. Test en tâche 3.
5. **Réglage coupé** : aucun fond. Test en tâche 4.
6. **Ordre des teintes** : le texte garde ses teintes ; une même unité a la même teinte dans l'énoncé et dans le tableau. Tests en tâche 3.

---

### Tâche 1 : reconnaître un texte qui est une unité (`parseUnit`)

**Fichiers :**
- Modifier : `apps/zachart-maths/src/exercises/quantities.ts` (ajout de `parseUnit`, en fin de fichier)
- Test : `apps/zachart-maths/src/exercises/quantities.test.ts` (ajout d'un `describe`)

**Interfaces :**
- Consomme : les constantes `UNIT` et `canonical` déjà dans `quantities.ts`.
- Produit : `parseUnit(text: string): string | null` : l'unité canonique si `text`, une fois les espaces retirés aux extrémités, est TOUT ENTIER une unité (`km`, `km/h`, `m²`, `€`, `L`) ; `null` sinon (vide, nombre avec unité, mot, `t` seul ou `t²` / `t³`).

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter à la fin de `quantities.test.ts` (l'import en tête devient `import { findQuantities, parseUnit } from './quantities'`) :

```ts
describe('parseUnit', () => {
  it('reconnaît un texte qui est tout entier une unité, sous sa forme canonique', () => {
    expect(parseUnit('km')).toBe('km')
    expect(parseUnit('h')).toBe('h')
    expect(parseUnit('s')).toBe('s')
    expect(parseUnit('km/h')).toBe('km/h')
    expect(parseUnit('m²')).toBe('m²')
    expect(parseUnit('m^2')).toBe('m²')
    expect(parseUnit('€')).toBe('€')
    expect(parseUnit('kg/m³')).toBe('kg/m³')
    expect(parseUnit('l')).toBe('L')
    expect(parseUnit('cl')).toBe('cL')
  })

  it('ignore les espaces aux extrémités', () => {
    expect(parseUnit('  km ')).toBe('km')
    expect(parseUnit(' h ')).toBe('h')
  })

  it('refuse ce qui n\'est pas une unité seule', () => {
    expect(parseUnit('')).toBeNull()
    expect(parseUnit('   ')).toBeNull()
    expect(parseUnit('16 km')).toBeNull()
    expect(parseUnit('kilos')).toBeNull()
    expect(parseUnit('minutes')).toBeNull()
    expect(parseUnit('Distance')).toBeNull()
    expect(parseUnit('km h')).toBeNull()
    expect(parseUnit('x')).toBeNull()
    expect(parseUnit('(km)')).toBeNull()
  })

  it('refuse la lettre t seule, avec ou sans puissance : tonne ou temps ?', () => {
    expect(parseUnit('t')).toBeNull()
    expect(parseUnit('t²')).toBeNull()
    expect(parseUnit('t^3')).toBeNull()
    expect(parseUnit('t/h')).toBe('t/h')
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- quantities`
Attendu : échec, `parseUnit` n'est pas exporté.

- [ ] **Étape 3 : écrire l'implémentation minimale**

À la fin de `quantities.ts` :

```ts
const WHOLE_UNIT = new RegExp(`^(${UNIT})$`, 'u')

/**
 * L'unité canonique d'un texte qui est TOUT ENTIER une unité (`km`, `h`, `km/h`, `m²`), ou `null`.
 * Sert aux en-têtes de tableau, où le contexte lève l'ambiguïté des unités d'une lettre (`h`, `s`) que
 * `findQuantities` refuse dans un texte libre. La lettre `t` seule reste refusée, comme dans un texte :
 * tonne ou temps ? (`t (s)` donne `s` par ailleurs.)
 */
export function parseUnit(text: string): string | null {
  const match = WHOLE_UNIT.exec(text.trim())
  if (match === null) return null
  const unit = canonical(match[1])
  return /^t[²³]?$/.test(unit) ? null : unit
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- quantities`
Attendu : tous les tests de `quantities.test.ts` passent (les anciens aussi). Si un cas du nouveau test échoue, corriger l'implémentation, pas le test : les attentes viennent du spec.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/quantities.ts apps/zachart-maths/src/exercises/quantities.test.ts
git commit -m "feat(zachart-maths): reconnaît un texte qui est tout entier une unité"
```

---

### Tâche 2 : lire l'en-tête d'un tableau (`tableUnits.ts`)

**Fichiers :**
- Créer : `apps/zachart-maths/src/exercises/tableUnits.ts`
- Test : `apps/zachart-maths/src/exercises/tableUnits.test.ts`

**Interfaces :**
- Consomme : `parseUnit(text): string | null` (tâche 1).
- Produit : `headerUnit(cell: string): string | null` ; `interface TableLayout { axis: 'columns' | 'rows'; units: (string | null)[] }` ; `tableLayout(cells: readonly (readonly string[])[]): TableLayout | null`. `units[c]` est l'unité de la colonne `c` quand `axis` vaut `'columns'`, celle de la ligne `r` quand il vaut `'rows'` ; `null` pour une colonne (ligne) sans unité et toujours pour la position 0 (le coin).

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/zachart-maths/src/exercises/tableUnits.test.ts
import { describe, expect, it } from 'vitest'
import { headerUnit, tableLayout } from './tableUnits'

describe('headerUnit', () => {
  it('lit une cellule qui est une unité seule', () => {
    expect(headerUnit('km')).toBe('km')
    expect(headerUnit(' h ')).toBe('h')
    expect(headerUnit('km/h')).toBe('km/h')
    expect(headerUnit('€')).toBe('€')
  })

  it('lit l\'unité entre parenthèses ou crochets en fin de cellule', () => {
    expect(headerUnit('Distance (km)')).toBe('km')
    expect(headerUnit('Temps (h)')).toBe('h')
    expect(headerUnit('Prix [€]')).toBe('€')
    expect(headerUnit('Distance (km) ')).toBe('km')
    expect(headerUnit('(km)')).toBe('km')
    expect(headerUnit('t (s)')).toBe('s')
  })

  it('lit l\'unité après « en »', () => {
    expect(headerUnit('Vitesse en km/h')).toBe('km/h')
    expect(headerUnit('Temps en h')).toBe('h')
    expect(headerUnit('Prix en €')).toBe('€')
    expect(headerUnit('Vitesse (en km/h)')).toBe('km/h')
  })

  it('refuse ce qui n\'est pas un en-tête d\'unité', () => {
    expect(headerUnit('')).toBeNull()
    expect(headerUnit('   ')).toBeNull()
    expect(headerUnit('Distance')).toBeNull()
    expect(headerUnit('16 km')).toBeNull()
    expect(headerUnit('5')).toBeNull()
    expect(headerUnit('mètres')).toBeNull()
    expect(headerUnit('Durée en minutes')).toBeNull()
    expect(headerUnit('Entrée')).toBeNull()
    expect(headerUnit('t')).toBeNull()
    expect(headerUnit('Prix (euros)')).toBeNull()
  })
})

describe('tableLayout', () => {
  it('prend les unités de la première ligne, coin exclu', () => {
    const cells = [['Grandeur', 'Distance (km)', 'Temps (h)'], ['A', '10', '2']]
    expect(tableLayout(cells)).toEqual({ axis: 'columns', units: [null, 'km', 'h'] })
  })

  it('ne retient que les colonnes dont l\'en-tête est une unité', () => {
    const cells = [['', 'Distance (km)', 'Remarque'], ['A', '10', 'ok']]
    expect(tableLayout(cells)).toEqual({ axis: 'columns', units: [null, 'km', null] })
  })

  it('à défaut, prend les unités de la première colonne', () => {
    const cells = [['', 'A', 'B'], ['Distance (km)', '10', '20'], ['Temps (h)', '2', '4']]
    expect(tableLayout(cells)).toEqual({ axis: 'rows', units: [null, 'km', 'h'] })
  })

  it('quand les deux ont des unités, la première ligne l\'emporte', () => {
    const cells = [['', 'Distance (km)'], ['Temps (h)', '2']]
    expect(tableLayout(cells)).toEqual({ axis: 'columns', units: [null, 'km'] })
  })

  it('ignore le coin : une unité seule en (0, 0) n\'est pas un en-tête', () => {
    expect(tableLayout([['km', 'x'], ['y', 'z']])).toBeNull()
    expect(tableLayout([['km', 'Distance'], ['x', '2']])).toBeNull()
    // Le coin est ignoré, mais un `h` plus bas dans la première colonne est bien un en-tête de ligne.
    expect(tableLayout([['km', 'Distance'], ['h', '2']])).toEqual({ axis: 'rows', units: [null, 'h'] })
  })

  it('ne trouve rien sans unité, dans un tableau vide, 1×1, ou de cellules vides', () => {
    expect(tableLayout([['a', 'b'], ['c', 'd']])).toBeNull()
    expect(tableLayout([['3', '5'], ['7', '9']])).toBeNull()
    expect(tableLayout([['km']])).toBeNull()
    expect(tableLayout([])).toBeNull()
    expect(tableLayout([[]])).toBeNull()
    expect(tableLayout([['', ''], ['', '']])).toBeNull()
  })

  it('supporte des lignes de longueurs inégales', () => {
    expect(tableLayout([['', 'Distance (km)'], ['A']])).toEqual({ axis: 'columns', units: [null, 'km'] })
    expect(tableLayout([['', 'a'], ['Temps (h)']])).toEqual({ axis: 'rows', units: [null, 'h'] })
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- tableUnits`
Attendu : échec, module `./tableUnits` introuvable.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// apps/zachart-maths/src/exercises/tableUnits.ts
import { parseUnit } from './quantities'

// Une unité entre parenthèses ou crochets, en fin de cellule : « Distance (km) », « Prix [€] ».
const IN_BRACKETS = /[([]\s*([^()[\]]+?)\s*[)\]]\s*$/
// « … en km/h » : « en » isolé suivi d'un mot, en fin de texte.
const AFTER_EN = /(?:^|\s)en\s+(\S+)\s*$/i

function afterEn(text: string): string | null {
  const match = AFTER_EN.exec(text)
  return match === null ? null : parseUnit(match[1])
}

/**
 * L'unité d'une cellule d'en-tête, ou `null` : la cellule est tout entière une unité (`km`), ou finit
 * par une unité entre parenthèses ou crochets (`Distance (km)`), ou par « en » et une unité
 * (`Vitesse en km/h`). Une donnée comme `16 km` n'est pas un en-tête.
 */
export function headerUnit(cell: string): string | null {
  const text = cell.trim()
  if (text === '') return null
  const whole = parseUnit(text)
  if (whole !== null) return whole
  const bracket = IN_BRACKETS.exec(text)
  if (bracket !== null) return parseUnit(bracket[1]) ?? afterEn(bracket[1])
  return afterEn(text)
}

/**
 * Ce que les en-têtes d'un tableau disent de ses unités : `columns` (les unités sont sur la première
 * ligne, `units[c]` est celle de la colonne `c`) ou `rows` (sur la première colonne, `units[r]` est
 * celle de la ligne `r`). `units[0]` est toujours `null` : le coin est souvent le titre du tableau.
 */
export interface TableLayout {
  axis: 'columns' | 'rows'
  units: (string | null)[]
}

/**
 * La première ligne d'abord ; à défaut, la première colonne ; quand les deux ont des unités, la première
 * ligne l'emporte. `null` quand aucun en-tête n'est une unité (tableau vide, 1×1, nombres, mots).
 */
export function tableLayout(cells: readonly (readonly string[])[]): TableLayout | null {
  const columns = (cells[0] ?? []).map((cell, c) => (c === 0 ? null : headerUnit(cell)))
  if (columns.some(unit => unit !== null)) return { axis: 'columns', units: columns }
  const rows = cells.map((row, r) => (r === 0 ? null : headerUnit(row[0] ?? '')))
  if (rows.some(unit => unit !== null)) return { axis: 'rows', units: rows }
  return null
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

Run : `bun run --filter zachart-maths test -- tableUnits`
Attendu : tous les tests passent. Si un cas échoue, corriger l'implémentation, pas le test (sauf typo évidente d'une attente par rapport aux règles des Contraintes globales, à signaler dans le rapport).

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/tableUnits.ts apps/zachart-maths/src/exercises/tableUnits.test.ts
git commit -m "feat(zachart-maths): lit l'unité de chaque colonne ou ligne d'en-tête d'un tableau"
```

---

### Tâche 3 : des teintes qui comptent les en-têtes de tableau (`assignExerciseHues`)

**Fichiers :**
- Modifier : `apps/zachart-maths/src/exercises/unitColors.ts` (remplace `exerciseTexts` par `assignExerciseHues` ; `assignHues` reste)
- Modifier : `apps/zachart-maths/src/exercises/unitColors.test.ts` (le `describe('exerciseTexts')` est remplacé)
- Modifier : `apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx` (l'import et la ligne `unitHues`)

**Interfaces :**
- Consomme : `findQuantities` (existant) ; `tableLayout` (tâche 2).
- Produit : `assignExerciseHues(exercise: Pick<Exercise, 'enonce' | 'blocs' | 'blocsB' | 'reponse'>): Map<string, number>` (unité canonique → teinte, ordre de lecture : énoncé → blocs de la zone A dans l'ordre → blocs de la zone B → réponse ; un bloc texte apporte ses grandeurs, un bloc tableau les unités de ses en-têtes). `exerciseTexts` est supprimée (plus aucun appelant) ; `assignHues(texts)` et `UNIT_HUES` restent.

- [ ] **Étape 1 : écrire le test qui échoue**

Dans `unitColors.test.ts`, remplacer l'import par `import { assignExerciseHues, assignHues, UNIT_HUES } from './unitColors'` et remplacer TOUT le `describe('exerciseTexts', …)` par :

```ts
describe('assignExerciseHues', () => {
  const base = { enonce: '', reponse: '' }
  const table = (...rows: string[][]) => ({ id: 't', type: 'tableau', cellules: rows })
  const text = (contenu: string) => ({ id: 'x', type: 'texte', contenu })

  it('range les unités dans l\'ordre de lecture : énoncé, zone A, zone B, réponse', () => {
    const hues = assignExerciseHues({
      enonce: '3 km',
      blocs: [text('2 kg')],
      blocsB: [text('5 L')],
      reponse: '1 g',
    })
    expect([...hues.keys()]).toEqual(['km', 'kg', 'L', 'g'])
    expect(hues.get('km')).toBe(UNIT_HUES[0])
    expect(hues.get('g')).toBe(UNIT_HUES[3])
  })

  it('compte les unités d\'en-tête d\'un tableau, à la place du bloc', () => {
    const hues = assignExerciseHues({
      enonce: '3 km',
      blocs: [text('2 kg'), table(['', 'Temps (h)'], ['a', '1'])],
      reponse: '1 m',
    })
    expect([...hues.keys()]).toEqual(['km', 'kg', 'h', 'm'])
  })

  it('donne une teinte à une unité d\'une lettre qui n\'est que dans un en-tête', () => {
    const hues = assignExerciseHues({ ...base, blocs: [table(['', 'h'], ['a', '1'])] })
    expect(hues.get('h')).toBe(UNIT_HUES[0])
  })

  it('donne la même teinte à une unité de l\'énoncé et du tableau', () => {
    const hues = assignExerciseHues({
      ...base,
      enonce: 'Je fais 16 km',
      blocs: [table(['', 'Distance (km)'], ['a', '16'])],
    })
    expect(hues.size).toBe(1)
    expect(hues.get('km')).toBe(UNIT_HUES[0])
  })

  it('lit les unités des lignes d\'en-tête d\'un tableau à première colonne', () => {
    const hues = assignExerciseHues({
      ...base,
      blocs: [table(['', 'a'], ['Distance (km)', '1'], ['Temps (h)', '2'])],
    })
    expect([...hues.keys()]).toEqual(['km', 'h'])
  })

  it('ne donne rien à un tableau sans en-tête d\'unité, ni aux cellules de données', () => {
    const hues = assignExerciseHues({ ...base, blocs: [table(['a', 'b'], ['16 km', '3 h'])] })
    expect(hues.size).toBe(0)
  })

  it('supporte une zone B absente, un bloc inconnu et des valeurs inattendues', () => {
    const hues = assignExerciseHues({
      ...base,
      blocs: [
        null,
        42,
        { id: 'x', type: 'inconnu' },
        { id: 'y', type: 'texte' },
        { id: 'z', type: 'texte', contenu: 12 },
        { id: 'a', type: 'tableau' },
        { id: 'b', type: 'tableau', cellules: 'oups' },
        { id: 'c', type: 'tableau', cellules: [[1, null], 'x', ['', 'h']] },
        { id: 'd', type: 'tableau', cellules: [['', 'Distance (km)'], ['a', 2]] },
      ],
    })
    expect(hues.size).toBe(0)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- unitColors`
Attendu : échec, `assignExerciseHues` n'est pas exporté. (Le dernier test attend `size === 0` : les tableaux mal formés sont ignorés EN ENTIER, même quand une partie de leurs cellules serait lisible.)

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `unitColors.ts`, ajouter l'import `import { tableLayout } from './tableUnits'`, mettre `assignHues` sur un petit utilitaire partagé, et remplacer `exerciseTexts` :

```ts
function addUnit(hues: Map<string, number>, unit: string): void {
  if (!hues.has(unit)) hues.set(unit, UNIT_HUES[hues.size % UNIT_HUES.length])
}

/**
 * Une teinte par unité, attribuée à sa première apparition en parcourant `texts` dans l'ordre :
 * `16 km` et `4 km` ont donc la même couleur partout dans l'exercice. Au-delà de huit unités la
 * palette recommence, deux unités peuvent alors se ressembler : mieux vaut cela qu'un refus.
 */
export function assignHues(texts: readonly string[]): Map<string, number> {
  const hues = new Map<string, number>()
  for (const text of texts) {
    for (const quantity of findQuantities(text)) addUnit(hues, quantity.unit)
  }
  return hues
}

const isTextBlock = (block: unknown): block is { type: 'texte'; contenu: string } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'texte' &&
  typeof (block as { contenu?: unknown }).contenu === 'string'

/** Un bloc tableau dont les cellules sont bien des chaînes ; un fichier mal formé n'est pas lu du tout. */
const isTableBlock = (block: unknown): block is { type: 'tableau'; cellules: string[][] } =>
  typeof block === 'object' &&
  block !== null &&
  (block as { type?: unknown }).type === 'tableau' &&
  Array.isArray((block as { cellules?: unknown }).cellules) &&
  ((block as { cellules: unknown[] }).cellules).every(row => Array.isArray(row) && row.every(cell => typeof cell === 'string'))

/**
 * Une teinte par unité de TOUT l'exercice, dans l'ordre de lecture : l'énoncé, les blocs de la zone A,
 * ceux de la zone B, la réponse. Un bloc texte apporte les grandeurs qu'il contient (`16 km`), un
 * bloc tableau les unités de ses en-têtes (`Distance (km)`, `h`) : une unité d'une lettre, que
 * `findQuantities` refuse dans un texte libre, a ainsi sa teinte quand elle n'est que dans un en-tête,
 * et la même unité a la même couleur dans l'énoncé et dans le tableau. Les formules, les tableaux mal
 * formés et les blocs d'un type inconnu n'apportent rien.
 */
export function assignExerciseHues(exercise: Pick<Exercise, 'enonce' | 'blocs' | 'blocsB' | 'reponse'>): Map<string, number> {
  const hues = new Map<string, number>()
  const fromText = (text: string) => {
    for (const quantity of findQuantities(text)) addUnit(hues, quantity.unit)
  }
  const fromBlock = (block: unknown) => {
    if (isTextBlock(block)) fromText(block.contenu)
    else if (isTableBlock(block)) {
      for (const unit of tableLayout(block.cellules)?.units ?? []) if (unit !== null) addUnit(hues, unit)
    }
  }
  fromText(exercise.enonce)
  exercise.blocs.forEach(fromBlock)
  ;(exercise.blocsB ?? []).forEach(fromBlock)
  fromText(exercise.reponse)
  return hues
}
```

Supprimer l'ancienne `exerciseTexts` et la fonction `assignHues` d'origine (remplacée ci-dessus).

Dans `ExerciseWorkspace.tsx` : remplacer `import { assignHues, exerciseTexts } from './unitColors'` par `import { assignExerciseHues } from './unitColors'` et la ligne `const unitHues = assignHues(exerciseTexts(exercise))` par `const unitHues = assignExerciseHues(exercise)`. Faire `Grep` de `exerciseTexts` dans `apps/` et `packages/` : plus aucun appelant ne doit rester (le seul texte restant peut être dans `CLAUDE.md`, traité en tâche 5).

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

Run : `bun run --filter zachart-maths test -- unitColors ExerciseWorkspace` puis `bun run --filter zachart-maths test`
Attendu : tous les tests passent, y compris le test d'`ExerciseWorkspace` « colore les grandeurs de l'énoncé, des blocs texte et de la réponse » (le comportement du texte ne change pas).

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/unitColors.ts apps/zachart-maths/src/exercises/unitColors.test.ts apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx
git commit -m "feat(zachart-maths): les unités d'en-tête de tableau ont leur teinte, dans l'ordre de lecture"
```

---

### Tâche 4 : colorer la colonne ou la ligne dans l'éditeur de tableau

**Fichiers :**
- Modifier : `apps/zachart-maths/src/exercises/toolbarCatalog.ts` (ajout de `headerToneOf`, après `borderOf`)
- Modifier : `apps/zachart-maths/src/exercises/BlockStack.tsx` (imports ; corps de `TableEditor`)
- Test : `apps/zachart-maths/src/exercises/BlockStack.test.tsx` (ajout d'un `describe`)

**Interfaces :**
- Consomme : `tableLayout` (tâche 2) ; `UnitHuesContext` (de `./HighlightedTextarea`, `ReadonlyMap<string, number>`) ; `useUnitColors` (`enabled`) ; `toneOf` (existant).
- Produit : `headerToneOf(hue: number): string` ; `TableEditor` pose `style.background` inline sur l'`<input>` de chaque cellule d'une colonne (ou ligne) dont l'en-tête est une unité.

- [ ] **Étape 1 : écrire le test qui échoue**

Dans `BlockStack.test.tsx`, ajouter les imports :

```tsx
import { UnitHuesContext } from './HighlightedTextarea'
import { useUnitColors } from './useUnitColors'
```

puis, à la fin du fichier, un nouveau `describe` (il a son propre harnais, avec le contexte des teintes) :

```tsx
describe('BlockStack : tableau coloré par unité d\'en-tête', () => {
  // km → teinte 150, h → teinte 30 : ce que `assignExerciseHues` donnerait à cet exercice.
  const hues = new Map([['km', 150], ['h', 30]])

  function TableHarness({ cells }: { cells: string[][] }) {
    const [value, setValue] = useState<unknown[]>([{ id: 't', type: 'tableau', cellules: cells }])
    return (
      <TooltipProvider>
        <UnitHuesContext value={hues}>
          <BlockStack value={value} onChange={(b: Block[]) => setValue(b)} />
        </UnitHuesContext>
      </TooltipProvider>
    )
  }
  const cell = (row: number, column: number) => screen.getByLabelText(`Ligne ${row}, colonne ${column}`) as HTMLInputElement
  const fill = (row: number, column: number) => cell(row, column).style.background

  beforeEach(() => useUnitColors.setState({ enabled: true }))

  it('colore chaque colonne dont l\'en-tête est une unité, l\'en-tête un cran plus soutenu', () => {
    render(<TableHarness cells={[['Grandeur', 'Distance (km)', 'Temps (h)'], ['A', '10', '2'], ['B', '20', '4']]} />)
    expect(fill(2, 2)).not.toBe('')
    expect(fill(2, 2)).toBe(fill(3, 2))
    expect(fill(2, 3)).toBe(fill(3, 3))
    expect(fill(2, 2)).not.toBe(fill(2, 3))
    expect(fill(1, 2)).not.toBe('')
    expect(fill(1, 2)).not.toBe(fill(2, 2))
    expect(fill(1, 3)).not.toBe(fill(2, 3))
  })

  it('ne colore ni le coin ni la colonne sans unité', () => {
    render(<TableHarness cells={[['Grandeur', 'Distance (km)', 'Remarque'], ['A', '10', 'ok']]} />)
    expect(fill(1, 1)).toBe('')
    expect(fill(2, 1)).toBe('')
    expect(fill(1, 3)).toBe('')
    expect(fill(2, 3)).toBe('')
    expect(fill(2, 2)).not.toBe('')
  })

  it('colore les lignes quand les unités sont dans la première colonne', () => {
    render(<TableHarness cells={[['', 'a', 'b'], ['Distance (km)', '10', '20'], ['Temps (h)', '2', '4']]} />)
    expect(fill(2, 2)).not.toBe('')
    expect(fill(2, 2)).toBe(fill(2, 3))
    expect(fill(3, 2)).toBe(fill(3, 3))
    expect(fill(2, 2)).not.toBe(fill(3, 2))
    expect(fill(2, 1)).not.toBe(fill(2, 2))
    expect(fill(1, 2)).toBe('')
  })

  it('quand les deux ont des unités, la première ligne l\'emporte', () => {
    render(<TableHarness cells={[['', 'Distance (km)'], ['Temps (h)', '2']]} />)
    expect(fill(1, 2)).not.toBe('')
    expect(fill(2, 2)).not.toBe('')
    expect(fill(2, 1)).toBe('')
  })

  it('ne colore rien sans en-tête d\'unité', () => {
    render(<TableHarness cells={[['a', 'b'], ['16 km', '3 h']]} />)
    for (const [row, column] of [[1, 1], [1, 2], [2, 1], [2, 2]]) expect(fill(row, column)).toBe('')
  })

  it('ne colore rien quand le réglage est coupé', () => {
    useUnitColors.setState({ enabled: false })
    render(<TableHarness cells={[['', 'Distance (km)'], ['a', '10']]} />)
    for (const [row, column] of [[1, 1], [1, 2], [2, 1], [2, 2]]) expect(fill(row, column)).toBe('')
  })

  it('ne colore pas une unité que l\'exercice n\'a pas (pas de teinte connue)', () => {
    render(<TableHarness cells={[['', 'Poids (g)'], ['a', '10']]} />)
    expect(fill(1, 2)).toBe('')
    expect(fill(2, 2)).toBe('')
  })

  it('garde la valeur des cellules : colorer ne change aucun texte', () => {
    render(<TableHarness cells={[['', 'Distance (km)'], ['a', '10']]} />)
    expect(cell(1, 2)).toHaveValue('Distance (km)')
    expect(cell(2, 2)).toHaveValue('10')
  })
})
```

Ajouter `beforeEach` à l'import de `vitest` en tête du fichier (`import { beforeEach, describe, expect, it, vi } from 'vitest'`).

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

Run : `bun run --filter zachart-maths test -- BlockStack`
Attendu : échec : les `fill(…)` valent `''` partout (aucune cellule n'est colorée), donc les assertions « non vide » échouent ; les autres tests de `BlockStack` passent encore.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `toolbarCatalog.ts`, après `borderOf` :

```ts
/** Le fond d'une cellule d'en-tête de tableau : un cran plus soutenu que `toneOf`, pour qu'on voie d'où la colonne tient sa couleur. */
export const headerToneOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 42%, var(--background))`
```

Dans `BlockStack.tsx` :
- l'import de React devient `import { useContext, useEffect, useMemo, useRef, useState } from 'react'` ;
- l'import `import { HighlightedTextarea } from './HighlightedTextarea'` devient `import { HighlightedTextarea, UnitHuesContext } from './HighlightedTextarea'` ;
- `import { borderOf, toneOf } from './toolbarCatalog'` devient `import { borderOf, headerToneOf, toneOf } from './toolbarCatalog'` ;
- ajouter `import { tableLayout } from './tableUnits'` et `import { useUnitColors } from './useUnitColors'`.

Dans `TableEditor`, après `const cells = block.cellules`, ajouter :

```tsx
  const colorEnabled = useUnitColors(state => state.enabled)
  const hues = useContext(UnitHuesContext)
  // Réglage coupé : pas d'analyse du tout, le tableau est celui d'avant.
  const layout = colorEnabled ? tableLayout(cells) : null
  /**
   * Le fond d'une cellule : la teinte de l'unité de sa colonne (ou de sa ligne), un cran plus soutenue
   * sur la cellule d'en-tête. Rien quand l'en-tête n'est pas une unité, que l'exercice n'a pas de
   * teinte pour elle, ou pour le coin.
   */
  const fillOf = (row: number, column: number): string | undefined => {
    if (layout === null) return undefined
    const unit = layout.axis === 'columns' ? layout.units[column] : layout.units[row]
    const hue = unit === null || unit === undefined ? undefined : hues.get(unit)
    if (hue === undefined) return undefined
    const isHeader = layout.axis === 'columns' ? row === 0 : column === 0
    return isHeader ? headerToneOf(hue) : toneOf(hue)
  }
```

et le style de l'`<input>` de cellule devient :

```tsx
              style={{ border: '1px solid var(--border)', background: fillOf(r, c) }}
```

(`background: undefined` est omis par React : la classe `bg-background` s'applique comme avant.)

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

Run : `bun run --filter zachart-maths test -- BlockStack` puis `bun run --filter zachart-maths test`
Attendu : les 8 nouveaux tests passent et toute la suite aussi (les tests de tableau existants de `BlockStack` et d'`ExerciseWorkspace` ne doivent pas casser : sans contexte de teintes ni en-tête d'unité, aucune cellule n'est colorée). Si jsdom renvoie `''` pour le `style.background` d'un `color-mix(...)`, le dire : le test sur les unités de texte (`HighlightedTextarea`) montre que ce n'est pas le cas ici.

- [ ] **Étape 5 : types, puis commit**

```bash
bunx tsc --noEmit -p apps/zachart-maths
git add apps/zachart-maths/src/exercises/toolbarCatalog.ts apps/zachart-maths/src/exercises/BlockStack.tsx apps/zachart-maths/src/exercises/BlockStack.test.tsx
git commit -m "feat(zachart-maths): un tableau dont l'en-tête est une unité colore sa colonne ou sa ligne"
```

---

### Tâche 5 : documentation et vérification d'ensemble

**Fichiers :**
- Modifier : `CLAUDE.md` (section « Zach'Math » : le point « Coloration des unités » cite `exerciseTexts`, supprimée ; ajouter un point « Tableaux »)
- Modifier : `docs/superpowers/specs/2026-10-04-tableaux-unites-design.md` (section 2 : `assignExerciseHues`)

- [ ] **Étape 1 : mettre `CLAUDE.md` à jour**

Dans le point **Coloration des unités**, remplacer la mention de `assignHues(exerciseTexts(exercise))` par `assignExerciseHues(exercise)` (qui parcourt les blocs dans l'ordre de lecture, textes ET en-têtes de tableau). Puis, juste après le point **Termes semblables**, ajouter :

```markdown
- **Tableaux** (`tableUnits.ts`, `parseUnit` de `quantities.ts`, `TableEditor` dans `BlockStack.tsx`) : `headerUnit(cell)`
  lit l'unité d'une cellule d'en-tête (toute la cellule est une unité, ou finit par `(km)` / `[€]`, ou par « en km/h » ;
  `16 km` n'en est pas un ; `t` seul refusé, `t (s)` donne `s`) ; `tableLayout(cells)` cherche d'abord sur la première
  ligne (coin exclu), à défaut sur la première colonne, la première ligne l'emporte. `TableEditor` pose un fond inline
  (`toneOf`, `headerToneOf` pour l'en-tête) sur les `<input>` de la colonne ou ligne concernée, avec la teinte de
  `UnitHuesContext` ; `assignExerciseHues` donne une teinte aux unités d'en-tête (même d'une lettre). Même bouton que les
  unités et les termes ; rien dans `packages/shared`, `TableGrid` ne change.
```

Dans le spec, section 2, remplacer la mention de l'attribution sur les textes par `assignExerciseHues(exercise)`, qui remplace `assignHues(exerciseTexts(…))` pour l'exercice entier.

- [ ] **Étape 2 : vérification d'ensemble**

```bash
bun run --filter zachart-maths test
bun run --filter @suite/shared test
bunx tsc --noEmit -p apps/zachart-maths
bunx tsc --noEmit -p packages/shared
```

Attendu : tout passe, aucune erreur de type. `Grep` de `exerciseTexts` dans `apps/` et `packages/` : aucun résultat. Ne pas lancer la suite de `zachart-mentale` (aucun de ses fichiers n'est touché ; elle dépasse son délai de 5 s sous charge).

- [ ] **Étape 3 : commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-04-tableaux-unites-design.md
git commit -m "docs: la coloration des tableaux par unité d'en-tête, pour les prochains agents"
```

**Contrôle visuel (humain, hors plan d'agent) :** `bun run --filter zachart-maths tauri dev`, un exercice dont l'énoncé dit « 16 km en 2 h », un bloc Tableau avec `Distance (km)` et `Temps (h)` en première ligne, puis vérifier en thème clair et sombre : les deux colonnes colorées de deux couleurs, les mêmes que `16 km` et `2 h` dans l'énoncé, l'en-tête plus soutenu, le texte lisible, les bordures et le focus d'une cellule normaux, les « + » et la corbeille de `TableGrid` visibles sur une colonne colorée ; refaire avec les unités dans la première colonne ; couper le bouton : les fonds disparaissent.

---

## Auto-relecture

**Couverture du spec.** Reconnaître une unité entière (tâche 1), en-têtes `km` / `(km)` / `[€]` / `en km/h`, coin ignoré, ligne contre colonne (tâche 2), teintes d'en-tête dans l'ordre de lecture, unité d'une lettre, tableaux mal formés (tâche 3), fond inline et réglage coupé (tâche 4), documentation et vérification (tâche 5). Les trois choix confirmés (seules les colonnes à unité ; données ignorées ; Mentale et cours non touchés) sont dans les Contraintes globales. Les « Suites possibles » du spec restent hors plan.

**Types cohérents.** `parseUnit(text): string | null` (tâche 1) est consommé par `headerUnit` (tâche 2) ; `tableLayout(cells): TableLayout | null` et `TableLayout { axis, units }` (tâche 2) par `assignExerciseHues` (tâche 3) et `TableEditor` (tâche 4) ; `assignExerciseHues(exercise): Map<string, number>` (tâche 3) par `ExerciseWorkspace` ; `UnitHuesContext` (`ReadonlyMap<string, number>`) et `useUnitColors` (existants) par `TableEditor` ; `headerToneOf` / `toneOf` (tâche 4).

**Points à surveiller à l'exécution.** `exerciseTexts` est supprimée : la tâche 3 doit vérifier par `Grep` qu'il ne reste aucun appelant. Le `<input>` de cellule garde ses classes ; seule la propriété `background` inline est ajoutée. Le contrôle visuel est le seul garde-fou de la lisibilité des fonds sur les cellules (clair et sombre).
