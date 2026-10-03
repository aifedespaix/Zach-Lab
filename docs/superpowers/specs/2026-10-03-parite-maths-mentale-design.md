# Parité Zach'Math / Zachar't Mentale (lots A + B)

Date : 2026-10-03

## Intention

Zach'Math doit rattraper les confort de Zachar't Mentale, en **partageant les
mêmes composants** (`@suite/shared`) plutôt qu'en copiant. Résultat attendu :
un élève retrouve les mêmes gestes dans les deux apps, et Mentale perd du code
dupliqué au passage.

Hors périmètre : repères visuels au survol (lot C) et maquettes UX (lot D),
qui auront chacun leur spec.

## 1. Panneaux

### Composants partagés (`@suite/shared/shell`)

- `PanelSearch` : champ de recherche pleine largeur (loupe, bouton d'effacement
  quand non vide, Échap vide et rend le clavier). Contrôlé par l'app
  (`value`, `onChange`, `placeholder`, `ariaLabel`), possibilité de focus
  par requête.
- `PanelFooter` : barre d'actions en bas d'un panneau, groupes séparés par un
  filet. L'app fournit ses groupes ; `CollapsiblePanel` ajoute le dernier
  groupe, le bouton de repli (`toggleCommand`, `foldLabel`).
- `CollapsiblePanel` affiche le pied lui-même ; le bouton de repli n'est plus
  dans l'en-tête du panneau.

### Zach'Math

- **Gauche** : titre + `PanelSearch` en haut ; arbre + plan de la feuille au
  milieu ; `PanelFooter` en bas (actions de l'arborescence : nouveau fichier,
  nouveau dossier, tout replier ; puis repli).
- **Droite** : `PanelSearch` pleine largeur en haut ; cours au milieu ; pied
  réduit au bouton de repli.
- **Recherche de fichiers** : vue sur l'arbre, jamais une mutation (comme
  Mentale). Nom + contenu via Orama (`@suite/shared/search`), index reconstruit
  quand la bibliothèque change (petit volume).

### Zachar't Mentale

`FileSidebar` et `CardDetailPanel` migrent vers `PanelSearch` / `PanelFooter`.
Aucun autre changement de comportement.

## 2. Tableau partagé

`TableGrid` dans `@suite/shared/equation`, purement présentationnel, tiré de
`TableField` / `TableHandle` de Mentale :

- grille CSS (pas de `<table>`) ; « + » sur chaque frontière de colonne et de
  ligne ; corbeille sur la ligne/colonne survolée ;
- survol et focus suivis séparément (un seul état se faisait vider par le
  `blur` provoqué par le clic sur la corbeille) ;
- props : `rowCount`, `columnCount`, `renderCell(r, c)`, `onAddRow(after)`,
  `onAddColumn(after)`, `onRemoveRow(i)`, `onRemoveColumn(i)`.

Les opérations de données restent dans chaque app (`TableCell` côté Mentale,
`string[][]` côté Maths). Mentale supprime sa grille dupliquée ; Maths supprime
ses quatre boutons Ligne/Colonne.

## 3. Focus après Entrée dans un calcul

`LinesBlockField` pose déjà un focus différé (`pending` puis `focusStart`),
mais la nouvelle ligne ne le reçoit pas. Hypothèse : le champ MathLive n'est
pas monté / son handle pas enregistré quand l'effet s'exécute. Procédure :
test en échec d'abord (Entrée → la nouvelle ligne a le focus), cause confirmée
par le test, puis correctif dans `shared` (l'équation en profite).

## 4. Toolbar compacte

Largeur 104 px → ~68 px : boutons ~26 px, écart 2 px, padding des familles
réduit. Deux colonnes et couleurs par famille conservées. Vérifiée en lançant
l'app, pas seulement par les tests.

## Ordre (un commit par étape)

1. `PanelSearch` / `PanelFooter` + migration de Mentale.
2. Panneaux et recherche de Maths.
3. `TableGrid` + migration de Mentale et de Maths.
4. Focus des lignes de calcul.
5. Toolbar.

## Tests et garde-fous

Tests Vitest nouveaux pour chaque composant partagé ; suites existantes des
deux apps vertes (`bun run test`, `bunx tsc --noEmit`). `shared` n'importe rien
d'une app (`boundary.test.ts`). Aucun import Tauri sous `admin/`.
