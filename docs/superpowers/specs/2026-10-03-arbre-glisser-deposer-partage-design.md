# Glisser-déposer d'arbre partagé — Zach'Math et Zachar't Mentale

Cycle 3 sur 3. Les cycles 1 (zone de travail de Maths) et 2 (panneaux rangeables, clic droit)
sont livrés.

## Intention

Que le glisser-déposer de l'arbre de fichiers soit le même code dans les deux apps, et qu'il
fonctionne dans la webview Tauri de Zach'Math.

Aujourd'hui Mentale a un moteur à évènements pointeur (avec fantôme sous le curseur et dépliage
au survol), écrit ainsi parce que le glisser-déposer HTML5 n'est pas fiable dans la webview
Tauri. Maths, lui, utilise `draggable` et `onDrop` HTML5 : probablement un bug latent dans
l'app réelle.

## Décisions prises

- **Briques partagées**, pas un composant d'arbre complet : `FileSidebar` (801 lignes) et
  `FileTreeRow` (918) de Mentale portent trop de logique propre (types de carte, verrous,
  synchronisation, publication, export) pour être réécrits sans risque de régression.
- Partagés : le moteur de glisser-déposer, son store, le fantôme et son CSS.
- **Non partagés, volontairement** : le champ de nom en ligne (celui de Mentale est lié à son
  double-clic et à son focus) et le filtre de recherche (propre aux types de carte).

## Nouveau point d'entrée `@suite/shared/tree`

- `useTreeDragStore` : le store de Mentale tel quel (ligne en vol, position du pointeur, cible).
  `TreeDragSource` = `{ path, name, kind }`, avec `kind` devenu une chaîne libre (`'folder'`,
  `'mindmap'`, `'file'`…).
- `beginTreeDrag(event, source, handlers)` : la mécanique actuelle (seuil de 5 px, évènements
  pointeur sur `window`, annulation à Échap, au `blur` et à `pointercancel`, dépliage au survol
  après 600 ms). Handlers fournis par l'app :
  - `canDrop(source, targetPath): boolean`
  - `isExpanded(targetPath): boolean` et `expand(targetPath): void`
  - `onDrop(source, targetPath): void`
- `consumeSwallowedClick()` et `dropTargetAt(x, y)` : inchangés. `dropTargetAt` lit déjà des
  attributs génériques (`data-tree-row`, `data-tree-kind`, `data-drop-folder`).
- `TreeDragGhost` : le fantôme, avec `describeTarget(path)` pour sa 2ᵉ ligne et `icon(kind)`.
  Son CSS (`.tree-drag-ghost`, aujourd'hui dans `index.css` de Mentale) passe dans `theme.css`
  de `shared`.

La frontière de `shared` est respectée : le moteur n'importe aucune app ; tout ce qui est propre
à une app arrive par les handlers.

## Mentale

`treeDrag.ts` ne garde que sa logique de chemins (`isValidDropTarget` avec `isSameFilePath`,
`isInsideFolder`, `parentDirOf`) et appelle le moteur partagé avec ses handlers (`moveNode`,
`expandedPaths`). Le store et le fantôme locaux sont supprimés. `FileTreeRow` ne change que ses
imports. Les tests existants (`treeDrag.test.ts`, `FileTreeRow.drag.test.tsx`, le fantôme)
restent verts sans modification : ils sont la preuve de non-régression.

## Maths

`ExerciseTree` remplace `draggable` / `onDragOver` / `onDrop` par `beginTreeDrag` sur
`onPointerDown`. Les chapitres sont les cibles (`data-tree-row` et `data-tree-kind="folder"`),
les fichiers les sources. `canDrop` refuse le chapitre d'origine ; `onDrop` appelle
`moveExercise(path, chapitre)` du store ; un chapitre replié s'ouvre au survol. L'attribut
`draggable` est retiré des boutons de fichier : sinon le navigateur et le moteur se disputent
le geste. Le comportement visible reste « déplacer un fichier vers un autre chapitre ».

## Tests

- Moteur (TDD, dans `shared`) : un mouvement sous 5 px ne démarre aucun drag et le clic suivant
  n'est pas avalé ; au-delà, le drag démarre ; la cible n'est retenue que si `canDrop` l'accepte ;
  un dépôt valide appelle `onDrop` une seule fois, sans cible il n'appelle rien ; Échap, `blur` et
  `pointercancel` annulent sans rien déposer ; le clic qui suit un vrai drag est avalé une fois ;
  le survol d'un dossier fermé le déplie après 600 ms (pas un dossier déjà ouvert, pas un dossier
  quitté entre-temps) ; tous les écouteurs `window` sont retirés à la fin.
- Fantôme : invisible hors drag ; 2ᵉ ligne = `describeTarget(cible)` ou le refus ; icône par `kind`.
- Mentale : tests existants verts, sans modification.
- Maths : glisser un fichier sur un autre chapitre le déplace ; sur son propre chapitre, rien ;
  un chapitre replié s'ouvre au survol ; Échap annule ; un simple clic sur un fichier le
  sélectionne toujours.
- Frontières : `boundary.test.ts` de `shared`, de Maths et de l'admin verts ; l'admin
  n'importe pas `@suite/shared/tree`.
- Final : `bun run test:all`, `tsc` (Maths, `shared`, Mentale), passage dans l'app réelle.

## Ordre de réalisation (une tâche, un commit)

1. `@suite/shared/tree` : store, moteur, `consumeSwallowedClick`, `dropTargetAt`, tests, export
   déclaré dans le `package.json` de `shared`.
2. `TreeDragGhost` partagé, CSS déplacé vers `theme.css`.
3. Mentale branchée sur le moteur partagé ; suppression du store et du fantôme locaux.
4. Maths : `ExerciseTree` en glisser-déposer pointeur, avec fantôme.
5. Documentation (`CLAUDE.md`), vérification complète, app réelle, push.

## Risques

- **Mentale :** le moindre changement de comportement du glisser-déposer. D'où l'ordre : moteur
  partagé d'abord, branchement de Mentale ensuite, tests inchangés.
- **Maths :** `draggable` et le moteur pointeur se disputent le geste tant que `draggable` reste.
- **Vérification visuelle :** jsdom ne simule ni la webview Tauri ni `elementFromPoint` réel ; le
  glisser dans les deux apps se juge dans l'app réelle.

## Hors périmètre

Le champ de nom en ligne, le filtre de recherche, et un composant d'arbre complet partagé
(`FileSidebar` / `FileTreeRow`) : risque élevé pour peu d'écran en plus.
