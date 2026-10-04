# Coloration des quantités et des unités (Zach'Math)

Statut : à relire. Aucun code écrit pour cette fonctionnalité.

## But

Dans un exercice, repérer d'un coup d'œil les grandeurs et leurs unités. Dans
« Je vais à 3 km/h, en combien de temps je fais 16 km ? », « 16 km » reçoit un
fond coloré ; chaque autre « km » de l'exercice (« 4 km ») reçoit le même ; « km/h »
reçoit une autre couleur, qu'on le lise dans « 3 km/h », dans « x km/h » ou seul.

Un bouton dans la barre du haut (celle de Palette / Cours / Notes / Thème /
Paramètres) active ou coupe la coloration.

## Ce qui est décidé, ce qui est supposé

Décidé avec l'utilisateur : la coloration se pilote par un toggle de la barre du
haut ; une couleur par unité, partagée par tout l'exercice ; le cas « x km/h » et
« km/h » seul est traité ; la couleur est visible pendant la saisie (calque miroir).

Supposé, à corriger à la relecture :
1. Le toggle est **activé par défaut** et son état est mémorisé (`localStorage`).
2. Champs couverts : l'énoncé, les blocs texte (zones A et B), la réponse.
3. **Hors périmètre de cette première version** : les formules MathLive (bloc
   calcul, bloc équation), les cours Markdown, l'export. Voir « Suites ».

## Conception

### 1. Détection : `quantities.ts` (pur, sans React)

`findQuantities(text): Quantity[]` avec `Quantity = { start, end, unit, kind }` où
`unit` est l'unité canonique (`km`, `km/h`, `m²`…) et `kind` vaut `'valeur'`
(un nombre ou une variable suivi de l'unité) ou `'unite'` (l'unité seule).

- **Nombre** : `16`, `3,5`, `3.5`, `1 200` (espace, espace insécable), accolé ou
  séparé de l'unité par une espace (`16km`, `16 km`).
- **Variable** : une seule lettre parmi `x y z t v d n`, isolée (`x km/h`). Les
  autres lettres sont exclues pour ne pas colorer « a » ou « y » dans un mot.
- **Unités reconnues**, par liste blanche : longueur `km m dm cm mm`, masse `t kg g mg`,
  durée `h min s ms`, capacité `L dL cL mL`, argent `€`, angle `°`, `%`, et
  les composées `a/b` entre ces unités (`km/h`, `m/s`, `kg/m³`, `€/kg`), avec
  puissances `²` `³` (ou `^2`, `^3`).
- **Priorité** : l'unité composée la plus longue gagne (`km/h` avant `km`).
- **Unité seule** (`kind: 'unite'`) : uniquement si elle est composée ou de deux
  lettres ou plus (`km/h`, `min`, `cm`). Une unité d'une lettre (`m`, `h`, `g`, `s`)
  n'est colorée que précédée d'un nombre ou d'une variable : « 3 s » oui, la
  lettre « s » d'un mot non.
- Une unité n'est reconnue que si elle n'est ni précédée ni suivie d'une lettre
  (« 16 kilos » n'est pas « 16 k »).

### 2. Couleurs : `unitColors.ts` (pur)

`assignHues(texts: string[]): Map<unité, teinte>` : on parcourt les textes dans
l'ordre de l'exercice (énoncé, zone A, zone B, réponse) ; chaque unité reçoit
la teinte suivante d'une palette de 8 teintes à sa première apparition. Au-delà
de 8, on recommence. Une unité garde donc la même couleur dans tout l'exercice,
et l'ordre rend l'attribution stable tant qu'on n'ajoute pas une unité avant elle.

Rendu : `toneOf(teinte)` en fond (déjà dans `toolbarCatalog.ts`, mélange avec
`var(--background)`, donc il s'adapte au thème clair et au thème sombre), avec un
`border-radius` de 3 px. Une valeur et son unité seule partagent la teinte de leur
unité.

### 3. Affichage : `HighlightedTextarea` (calque miroir)

Un `<textarea>` ne peut pas colorer une partie de son texte. Le composant place,
derrière le `<textarea>` rendu transparent, un `<div aria-hidden>` aux métriques
identiques (police, taille, interligne, padding, bordure, `white-space: pre-wrap`,
`overflow-wrap`) qui reproduit le texte avec des `<mark>` colorés ; le texte du
miroir est transparent, seuls les fonds se voient. Les champs concernés s'agrandissent
déjà à leur contenu (`rows` calculé), donc il n'y a pas de défilement à synchroniser.

- Un saut de ligne final est complété d'un caractère de largeur nulle pour que la
  dernière ligne ait la même hauteur dans le miroir.
- Les `<mark>` ne changent **aucune** métrique (pas de padding ni de bordure) : sinon
  le texte dérive par rapport au curseur.
- Toggle coupé : le composant rend le `<textarea>` seul, sans miroir.
- Le `<textarea>` garde ses `aria-label`, son menu contextuel et ses raccourcis.

### 4. Toggle et état

- `useUnitColors` (zustand, comme `useToolbarFamilies`) : `enabled`, `toggle()`,
  clé `localStorage` `zachart-maths:unit-colors`. Un réglage immédiat : il ne passe
  pas par « Enregistrer » de la fenêtre Paramètres.
- Commande `view.toggleUnitColors` dans `commands.ts` (catégorie `view`, sans
  raccourci par défaut) et bouton `CommandButton` dans la `toolbar` de `App.tsx`.
- Les textes de l'exercice courant arrivent aux champs par un contexte
  `UnitHuesContext`, calculé une fois par rendu dans `ExerciseWorkspace` : un champ
  consulte la teinte d'une unité, il ne parcourt pas l'exercice lui-même.

### 5. Découpage en unités

| Unité | Rôle | Dépend de |
|---|---|---|
| `quantities.ts` | trouver les grandeurs dans un texte | rien |
| `unitColors.ts` | attribuer une teinte par unité | `quantities.ts` |
| `useUnitColors.ts` | état du toggle | zustand |
| `HighlightedTextarea.tsx` | afficher le texte coloré sous la saisie | contexte, `quantities.ts` |
| `ExerciseWorkspace.tsx`, `BlockStack.tsx` | remplacent leurs `<textarea>` | `HighlightedTextarea` |

Tout vit dans `apps/zachart-maths/src/exercises/`. Rien dans `packages/shared` :
la règle « shared n'importe jamais d'une app » ne change pas, et Mentale n'est pas
touchée.

## Tests

- `quantities.test.ts` : « 16km », « 16 km », « 3,5 km/h », « x km/h », « km/h » seul,
  « 4 km » après « 16 km », « 1 200 m », « 25 % », « 16 kilos » (rien), un « s » dans
  un mot (rien), « m² » et « kg/m³ », « km/h » prioritaire sur « km ».
- `unitColors.test.ts` : une teinte par unité, stable d'un champ à l'autre, ordre
  énoncé → zones → réponse, retour au début au-delà de 8 unités.
- `HighlightedTextarea.test.tsx` : le texte du miroir est identique à celui du champ,
  les `<mark>` portent la bonne unité, toggle coupé = aucun `<mark>`, saut de ligne final.
- `useUnitColors.test.ts` : valeur initiale, bascule, persistance.
- Test d'`ExerciseWorkspace` : « 16 km » de l'énoncé et « 4 km » d'un bloc partagent la
  même teinte ; « km/h » en a une autre.
- Vérification visuelle à faire à la main (thèmes clair et sombre, retour à la ligne,
  texte long) : jsdom ne mesure pas la mise en page.

## Risques

- **Dérive du miroir** (le texte et le fond ne se superposent plus) : c'est le point
  fragile de cette approche. Garde-fous : mêmes classes de police et de boîte, aucun
  décalage ajouté par les `<mark>`, vérification visuelle avant de conclure.
- **Faux positifs** (« 3 s » dans « 3 solutions ») : réglés par la règle « ni précédée
  ni suivie d'une lettre » ; les cas limites vont dans les tests.
- **Composition de saisie (IME)** : le miroir se met à jour à chaque changement de
  valeur ; à tester sur un accent mort.

## Suites possibles (non retenues pour cette version)

1. Au survol d'une quantité, éclairer toutes celles de même unité.
2. Avertir doucement quand la réponse utilise une unité absente de l'énoncé.
3. Colorer aussi les unités écrites dans les formules (`\text{km}`, `\mathrm{km/h}`).
4. Rendre la liste des unités réglable dans les Paramètres.
5. Appliquer la coloration aux cours Markdown.

## Décisions confirmées (2026-10-04)

- Le toggle est activé par défaut.
- Les lettres de variable `x y z t v d n` conviennent. Une inconnue n'est colorée que
  suivie d'une unité (`x km/h`) ; un `x` seul ne l'est pas.
- Les unités de la réponse finale sont colorées, avec la même teinte que dans l'énoncé.
