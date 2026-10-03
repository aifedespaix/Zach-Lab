# Sidebars rangeables et clic droit — Zach'Math et Zachar't Mentale

Cycle 2 sur 3. Le cycle 1 (zone de travail de Maths) est livré ; le cycle 3 (arbre de fichiers
commun) est hors périmètre, voir la fin.

## Intention

Que les panneaux gauche et droit se rangent de la même façon dans les deux apps, avec le même
code, les mêmes raccourcis et les mêmes icônes, et que les sidebars de Zach'Math aient les
clics droits de Mentale.

## Décisions prises

- Rangement **comme Mentale** : une bande de 32 px avec un bouton « déplier » ; `Mod+B` pour
  l'arbre de gauche, `Mod+Shift+B` pour le panneau de droite.
- Le rangement est un composant partagé dans `@suite/shared/shell`, utilisé des deux côtés.
- `FileSidebar` et `CardDetailPanel` de Mentale **ne sont pas migrés** : leur logique (fiche qui
  s'ouvre seule, éditeur de fiche) est trop spécifique. Seules leurs deux bandes copiées sont
  remplacées par le composant partagé.
- Clic droit de Maths : pas de « Dupliquer un chapitre » ni de « Copier le chemin » (peu utiles).

## Rangement partagé (`@suite/shared/shell`)

- `usePanelCollapsed(key)` : état rangé ou déplié, mémorisé entre deux lancements comme la
  largeur (`createPanelWidthStorage`). Par défaut déplié ; un stockage illisible est ignoré.
- `CollapsedRail` : la bande de 32 px, bouton `PanelLeftOpen` ou `PanelRightOpen` selon le côté,
  bouton de type `CommandButton` (infobulle avec le raccourci, réglable dans les paramètres).
- `CollapsiblePanel` : `ResizablePanel` plus le rangement. Rangé, il montre `CollapsedRail` et
  plus son contenu (jamais monté en largeur 0) ; déplié, il retrouve la largeur d'avant, avec
  l'animation de largeur de `ResizablePanel`, coupée sous `prefers-reduced-motion`. Il prend
  `toggleCommand`, l'id de commande de l'app.
- **Maths** : les deux panneaux de `App.tsx` passent à `CollapsiblePanel` ; commandes
  `view.toggleTree` (`Mod+B`) et `view.toggleCourses` (`Mod+Shift+B`) ; un bouton de rangement
  en en-tête de chaque panneau.
- **Mentale** : ses deux bandes copiées deviennent `CollapsedRail`. Rien ne change à l'écran ;
  son état rangé est désormais mémorisé.

## Clic droit — sidebars de Maths

Existant, conservé : menu d'un chapitre (nouvel exercice, renommer, monter, descendre,
supprimer) et d'un fichier (renommer, monter, descendre, déplacer vers, supprimer).

Côté gauche, à ajouter :
- **Vide de l'arbre** : « Nouveau chapitre », « Tout replier / Tout déplier ».
- **Chapitre** : « Replier / Déplier ».
- **Fichier** : « Dupliquer ».
- **Ligne de la fiche ouverte** (`SheetOutline`) : « Aller à cet exercice », « Monter »,
  « Descendre », « Nouvel exercice avant / après », « Supprimer » (avec la confirmation existante).
- **Vide de la sidebar gauche** : « Ranger le panneau ».

Côté droit, à ajouter :
- **Vide du panneau** : « Chercher un cours », « Afficher / Masquer les notes », « Ranger le panneau ».
- **Cours suggéré ou ouvert** : « Ouvrir », « Copier le titre ».
- **Notes** : le menu de champ (couper, copier, coller) et « Masquer les notes ».

Un menu de ligne arrête l'évènement : celui du vide ne s'ouvre pas par-dessus.

Nouvelle logique nécessaire (pure, contre le port `ExerciseFs`, jamais `@tauri-apps/plugin-fs`) :
dupliquer un fichier (`library.ts` : nom unique, nouveaux ids d'exercices), déplacer un
exercice dans une fiche (`moveExercise` dans `sheet.ts`), insérer un exercice avant ou après
un autre (`insertExerciseAt`).

## Tests

- Logique pure, en TDD : `usePanelCollapsed` (mémorisé, relu, défaut déplié, stockage illisible) ;
  dupliquer un fichier contre `memoryFs` ; `moveExercise` (d'un cran, sans effet aux bords,
  id inconnu) ; `insertExerciseAt`.
- Composants : `CollapsiblePanel` (bande à la place du contenu, largeur restaurée, bouton qui
  déclenche la commande, pas d'animation sous `prefers-reduced-motion`) ; chaque menu (entrées
  présentes, bonne action appelée, « Monter / Descendre » grisés aux bords, un menu de ligne
  n'ouvre pas celui du vide).
- Frontières : `boundary.test.ts` de `shared` et de Maths verts ; les tests de Mentale sur ses
  deux panneaux restent verts.
- Final : `bun run test:all`, `tsc` (Maths, `shared`, Mentale), passage dans l'app réelle.

## Ordre de réalisation (une tâche, un commit)

1. `usePanelCollapsed`, `CollapsedRail`, `CollapsiblePanel` dans `@suite/shared/shell`.
2. Mentale remplace ses deux bandes copiées par `CollapsedRail`.
3. Maths : panneaux rangeables, commandes, boutons d'en-tête.
4. Logique : dupliquer un fichier, `moveExercise`, `insertExerciseAt`.
5. Menus de l'arbre et de la fiche ouverte.
6. Menus du panneau droit.
7. Documentation, revue de toute la branche, vérification dans l'app.

## Hors périmètre — cycle 3

L'arbre de fichiers commun (lignes, glisser-déposer, renommage, filtre) entre `FileSidebar` /
`FileTreeRow` de Mentale (801 et 918 lignes, liés aux cartes mentales) et `ExerciseTree` de
Maths (fiches d'exercices) : les données diffèrent, c'est une vraie extraction à brainstormer
séparément.
