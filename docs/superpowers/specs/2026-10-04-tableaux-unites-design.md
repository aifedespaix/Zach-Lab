# Coloration des tableaux par unité d'en-tête (Zach'Math)

Statut : à relire. Aucun code écrit pour cette fonctionnalité. Troisième aide de la même
famille que la coloration des unités (`2026-10-04-coloration-unites-design.md`) et celle des
termes semblables (`2026-10-04-termes-semblables-design.md`) : même bouton, même teinte par unité.

## But

Dans un bloc Tableau, quand l'en-tête d'une colonne (ou d'une ligne) est une unité, colorer toute
la colonne (ou toute la ligne) de la couleur de cette unité. Un tableau de proportionnalité
« Distance (km) / Temps (h) » a deux colonnes de deux couleurs, et ce sont les mêmes que celles de
`16 km` et de `3 h` dans l'énoncé.

## Décidé avec l'utilisateur

- On regarde la **première ligne** pour trouver des unités ; à défaut, la **première colonne**.
  Quand les deux en ont, **la première ligne l'emporte**.
- La couleur est celle de l'unité dans le reste de l'exercice (énoncé, textes, réponse).
- Même bouton de la barre du haut (`view.toggleUnitColors`), rien de plus à régler.

## Ce qui est supposé, à corriger à la relecture

1. La cellule du **coin** (ligne 0, colonne 0) ne décide pas de l'axe : un coin qui est une unité
   seule ne fait pas choisir colonnes ou lignes. Mais une fois l'axe retenu, le coin en fait partie et
   reçoit son unité s'il en a une (sinon `null`). C'est souvent un titre sans unité (« Grandeur »,
   « Quantité »), mais peut aussi être « Distance (km) » ou « Temps (h) » dans un tableau de
   proportionnalité.
2. Une cellule d'en-tête est une unité si, une fois nettoyée, c'est **exactement** une unité reconnue
   (`km`, `h`, `km/h`, `m²`, `€`), ou si elle **finit** par une unité entre parenthèses ou crochets
   (`Distance (km)`, `Prix [€]`), ou par « en » suivi d'une unité (`Vitesse en km/h`). Une cellule de
   données comme `16 km` n'est pas un en-tête.
3. Dans un en-tête, une unité d'**une lettre** (`h`, `s`, `m`, `g`) est acceptée : le contexte lève
   l'ambiguïté que le texte libre ne lève pas. La lettre `t` seule reste refusée (tonne ou temps ?
   `t (s)` donne `s`).
4. Seules les colonnes (ou lignes) dont l'en-tête est une unité sont colorées ; les autres restent
   telles quelles.
5. **Hors périmètre de cette version** : le tableau de Zachar't Mentale, les tableaux des cours
   Markdown, les unités écrites dans les cellules de données.

## Conception

### 1. Lecture d'un tableau : `tableUnits.ts` (pur, sans React)

- `headerUnit(cell: string): string | null` : l'unité canonique d'une cellule d'en-tête (règles 2 et 3
  ci-dessus), ou `null`. S'appuie sur `quantities.ts`, qui exporte une petite fonction `parseUnit`
  pour reconnaître un texte qui est tout entier une unité.
- `tableLayout(cells: readonly (readonly string[])[]): TableLayout | null` avec
  `TableLayout = { axis: 'columns' | 'rows'; units: (string | null)[] }` : cherche d'abord dans la
  ligne 0 (coin exclu) ; s'il y a au moins une unité, `axis: 'columns'` ; sinon dans la colonne 0
  (coin exclu), s'il y a au moins une unité, `axis: 'rows'` ; sinon `null`. Une fois l'axe retenu,
  `units[0]` = unité du coin (ou `null`), et les autres positions ont celles du reste de la ligne
  ou colonne. Un tableau 1×1, vide, ou sans unité hors du coin donne `null`.

### 2. Teintes : unités d'en-tête dans l'attribution de l'exercice

`assignHues(exerciseTexts(…))` ne recevait que les textes de l'exercice. Une unité qui ne figure que dans
un en-tête (`h` tout seul n'est pas trouvée par `findQuantities`) n'aurait aucune teinte.
`assignExerciseHues(exercise)` le remplace pour l'exercice entier : il
parcourt les blocs dans l'ordre de lecture (énoncé → zone A → zone B → réponse) et, pour un bloc
Tableau, ajoute les unités de son `tableLayout` à leur place. Une unité garde ainsi la même teinte
partout, et celles de l'énoncé gardent leur numéro d'ordre (l'ordre ne change que si un tableau
apporte une unité nouvelle avant une autre).

### 3. Affichage : l'éditeur de tableau de Maths

`TableEditor` (dans `BlockStack.tsx`) rend déjà chaque cellule comme un `<input>` ; il lit
`UnitHuesContext` (déjà fourni par `ExerciseWorkspace`) et le réglage `useUnitColors`. Quand le
réglage est actif et que `tableLayout` donne une unité à une colonne (ou ligne), chaque `<input>` de
cette colonne reçoit `style.background = toneOf(teinte)` ; la cellule d'en-tête un cran plus
soutenue. Le fond d'une cellule est inline, donc il l'emporte sur `bg-background` ; bordure, focus
et texte ne changent pas. Réglage coupé ou aucune unité : le tableau est celui d'aujourd'hui.

Rien dans `packages/shared` : `TableGrid` ne reçoit aucune nouvelle propriété, la couleur est posée
par la cellule que l'app lui fournit. Mentale n'est pas touchée.

### 4. Découpage

| Unité | Rôle | Dépend de |
|---|---|---|
| `quantities.ts` (+ `parseUnit`) | reconnaître un texte qui est une unité | rien |
| `tableUnits.ts` | `headerUnit`, `tableLayout` | `quantities.ts` |
| `unitColors.ts` | teinte par unité, tableaux compris | `tableUnits.ts` |
| `BlockStack.tsx` (`TableEditor`) | fond des cellules | `tableUnits.ts`, `UnitHuesContext`, `useUnitColors` |

Tout sous `apps/zachart-maths/src/exercises/`.

## Tests

- `quantities.test.ts` : `parseUnit('km')`, `'h'`, `'km/h'`, `'m²'`, `'€'`, `' km '` (espaces),
  `'L'` ; refuse `'kilos'`, `'t'`, `'16 km'`, `''`.
- `tableUnits.test.ts` : `headerUnit` sur `km`, `Distance (km)`, `Prix [€]`, `Vitesse en km/h`,
  `Temps (h)`, `t (s)` → `s`, `16 km` → `null`, `Distance` → `null`, `''` → `null` ; `tableLayout` :
  première ligne avec unités (colonnes), première colonne seule (lignes), les deux (la ligne gagne),
  coin seul ne décide pas (mais participe une fois l'axe retenu), tableaux de proportionnalité
  (Distance/Temps en lignes ou colonnes), aucune unité, tableau 1×1, cellules vides ; une colonne
  sans unité reste `null`.
- `unitColors.test.ts` : une unité d'une lettre présente seulement dans un en-tête reçoit une teinte ;
  la même unité dans l'énoncé et dans un tableau a la même teinte ; l'ordre de lecture est respecté.
- `BlockStack.test.tsx` : avec `Distance (km)` / `Temps (h)` en première ligne, les cellules des deux
  colonnes ont deux fonds différents, l'en-tête plus soutenu que le corps ; une colonne sans unité
  n'a pas de fond ; réglage coupé : aucun fond ; première colonne seule : les lignes sont colorées ;
  les deux : seule la première ligne colore.
- Contrôle visuel à la main (clair et sombre) : lisibilité du texte sur fond, bordures et focus d'une
  cellule, le « + » et la corbeille de `TableGrid` sur une colonne colorée.

## Risques

- **Faux en-têtes** : une première ligne « 3 | 5 » n'est pas un en-tête, mais « h | m » ou « g | s »
  en est un. Garde-fou : on exige que la cellule soit **tout entière** une unité (ou finisse par une
  unité entre parenthèses ou après « en »), jamais un nombre avec unité ; une lettre `t` seule est refusée.
- **Ordre d'attribution** : un tableau qui apporte une unité nouvelle peut décaler la teinte d'une unité
  qui apparaît après lui dans la lecture. Accepté, comme pour les textes.
- **Fond inline sur `<input>`** : à vérifier visuellement avec le thème sombre, où `toneOf` se mélange à
  `var(--background)`.

## Suites possibles

1. Colorer les cellules de données qui contiennent une unité (`16 km`) dans leur colonne.
2. Un en-tête sur deux lignes (grandeur au-dessus, unité en dessous).
3. Colorer le tableau de Mentale.
4. Un bouton pour forcer l'orientation (colonnes ou lignes) d'un tableau ambigu.
