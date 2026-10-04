# Coloration des termes semblables dans les équations (Zach'Math)

Statut : à relire. Aucun code écrit pour cette fonctionnalité. Fait suite à la
coloration des unités (`2026-10-04-coloration-unites-design.md`), dont elle reprend le bouton.

## But

Aider l'élève à regrouper : dans `3x + 2y + 1 = 5x + 3y − 4`, tous les termes en `x`
reçoivent une couleur, tous ceux en `y` une autre, et les constantes (« rien ») une
troisième, des deux côtés du « = ».

## Décidé avec l'utilisateur

- L'aide s'affiche dans une **ligne de rendu en lecture seule** sous l'étape, pas dans
  le champ MathLive.
- Le **même bouton** de la barre du haut (`view.toggleUnitColors`) pilote les deux aides.
- Les termes avec **parenthèses ou fractions** ne sont pas colorés : les regrouper
  demanderait de développer.

## Pourquoi pas dans le champ

Les équations sont des champs MathLive. On ne peut pas poser de calque dessous, et
écrire `\colorbox` dans la valeur LaTeX polluerait ce qui est enregistré et ce que
l'élève retape. Le champ reste donc intact ; une copie colorée est rendue à côté.

## Conception

### 1. Analyse : `likeTerms.ts` (pur, sans React)

`colorTerms(latex: string): TermSegment[]` découpe un membre en segments :
`{ text: string; group: string | null }[]`, dont la concaténation redonne exactement
`latex` (rien n'est perdu ni réécrit).

- Un **terme** va d'un `+` ou `−` de premier niveau (hors `{}`, `()`, `[]`) au suivant. Le signe
  appartient au terme (`+3y`, `-4`) ; le premier terme sans signe est positif.
- **Partie littérale** = les lettres et exposants, dans l'ordre alphabétique, sans le
  coefficient : `3x` et `5x` → `x` ; `2xy` et `yx` → `xy` ; `x^2` ≠ `x` ; `4` → `""`
  (constante, groupe « rien »). Un `\cdot`, `\times` ou une multiplication implicite
  entre coefficient et lettres est lu comme tel (`3\cdot x` = `3x`).
- Un terme est **non coloré** (`group: null`) s'il contient `(`, `)`, `\left`, `\frac`,
  `\sqrt`, `\div`, `/` ou une commande inconnue. Les opérateurs et le « = » restent hors de tout segment.
- Un membre vide, ou un LaTeX qu'on ne sait pas découper, rend un unique segment non coloré.

### 2. Couleurs : `termColors.ts`

Une teinte par groupe, attribuée dans l'ordre d'apparition **sur tout le bloc** (étape par
étape, membre gauche puis droit), donc `x` a la même couleur des deux côtés ET d'une étape à
l'autre : l'élève voit les mêmes termes se regrouper. Les constantes sont un vrai gris
neutre (saturation 0) pour qu'elles se distinguent de toutes les lettres (ΔE76 >= 22, mesuré dans les tests). Palette de 6 teintes, qui recommence au-delà.

Chaque couleur est donnée en **hexadécimal**, calculé pour le thème clair ou sombre courant
(`useResolvedTheme`) : `\colorbox` de KaTeX n'accepte pas `var(--…)`. Les fonds sont
des teintes pâles en clair et profondes en sombre, avec un texte lisible dessus.

### 3. Rendu : `ColoredStep.tsx`

Construit le LaTeX de chaque membre en enveloppant les segments colorés :
`\colorbox{#hex}{$3x$}`, puis l'affiche avec `renderMathToHtml` (déjà borné, `trust: false`,
`\colorbox` n'a pas besoin de `trust`). Le signe est dans la boîte (`\colorbox{…}{$-4$}`) :
l'espacement diffère un peu du « − » binaire, accepté, car le signe doit rester avec son terme.
Le « = » et l'opération de l'étape ne sont pas recopiés : la ligne montre `membre gauche = membre droit`.

### 4. Branchement et affichage

`EquationEditor.tsx` (l'adaptateur de Maths) enveloppe `EquationStepsField`, qui reste
inchangé : **rien dans `packages/shared`**, Mentale n'est pas touchée. L'adaptateur :

- suit si le focus est dans le bloc (`onFocusCapture` / `onBlurCapture` sur un `<div>`
  englobant, sans perdre le focus à la sortie vers un bouton interne) ;
- sous le champ, **tant que le bloc a le focus et que le réglage est actif**, affiche une
  ligne par étape qui a au moins deux termes colorés, en lecture seule (`aria-hidden` :
  l'aide est visuelle, une étiquette ne servirait à rien) ; chaque étape a une case de hauteur
  fixe (28 px), toujours présente et vide quand l'étape n'a pas deux termes colorés : les blocs suivants
  ne sautent pas à chaque frappe et les cases restent alignées une à une sur les étapes ;
- n'affiche une ligne que s'il y a au moins **deux** termes colorés dans l'étape (sinon
  la ligne ne dit rien de plus que le champ).

### 5. Réglage

On réutilise `useUnitColors` et la commande `view.toggleUnitColors`. Le libellé passe de
« Colorer les unités » à « Colorer unités et termes » (commande, bouton, description,
test de `App`). Une seule clé `localStorage`, `zachart-maths:unit-colors`, déjà en place.

### 6. Découpage

| Unité | Rôle | Dépend de |
|---|---|---|
| `likeTerms.ts` | découper un membre en termes et groupes | rien |
| `termColors.ts` | teinte hexadécimale par groupe, selon le thème | `likeTerms.ts` |
| `ColoredStep.tsx` | LaTeX coloré et rendu KaTeX | `termColors.ts`, `renderMathToHtml` |
| `EquationEditor.tsx` | focus du bloc et affichage de la ligne d'aide | `ColoredStep.tsx`, `useUnitColors` |

Tout sous `apps/zachart-maths/src/exercises/`.

## Tests

- `likeTerms.test.ts` : `3x+2y+1`, `-4`, `x^2` ≠ `x`, `2xy` = `yx`, `3\cdot x`, premier terme sans signe,
  `2(x+1)` non coloré, `\frac{1}{2}x` non coloré, accolades (`x^{2}`), membre vide,
  LaTeX tronqué (`3x+`), la concaténation des segments redonne l'entrée.
- `termColors.test.ts` : même teinte des deux côtés, constantes distinctes, ordre stable, retour au début au-delà de 6, hexadécimal valide en clair et en sombre.
- `ColoredStep.test.tsx` : le LaTeX produit contient un `\colorbox` par terme coloré, rien pour un terme non coloré, aucune exception sur une entrée absurde.
- `EquationEditor` : la ligne n'apparaît qu'avec le focus dans le bloc et le réglage actif, jamais avec moins de deux termes colorés ; le champ MathLive n'est pas modifié (sa valeur reste celle de l'élève).
- Contrôle visuel à la main (clair et sombre) : lisibilité du texte sur fond, espacement des signes, hauteur de la ligne.

## Risques

- **Découpage de LaTeX à la main** : un analyseur maison peut se tromper sur des cas rares. Garde-fou : tout ce
  qu'on ne reconnaît pas est non coloré, et la concaténation des segments redonne l'entrée ; l'erreur
  possible est « pas de couleur », jamais « une valeur changée ».
- **Perte de focus** : `onBlurCapture` se déclenche en passant d'un champ du bloc à un autre ; il faut regarder
  `relatedTarget` pour ne pas masquer puis réafficher la ligne à chaque Tab.
- **Hauteur** : la ligne ajoute du contenu sous le bloc quand il a le focus ; elle ne doit pas faire sauter les blocs suivants à chaque frappe (hauteur réservée dès qu'elle est visible).

## Suites possibles

1. Colorer dans le champ lui-même, si MathLive le permettait sans toucher à la valeur.
2. Afficher la ligne pour la seule étape active (demande un indice d'étape côté `@suite/shared/equation`).
3. Colorer les termes avec parenthèses après développement.
4. Signaler les termes qu'on peut réduire (même groupe, des deux côtés).

## Décisions confirmées (2026-10-04)

- Un groupe à un seul terme (un seul `y`) est coloré aussi : tout terme analysable est coloré.
- La ligne d'aide montre toutes les étapes du bloc qui a le focus, pas seulement l'étape active.
