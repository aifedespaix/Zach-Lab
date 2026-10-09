# 03 — Barre de gauche

Ce que la demande veut : « la barre de gauche **complètement** commune — création de dossiers et
sous-dossiers, recherche, repli — avec la possibilité de distinguer les cas particuliers ».

## État actuel

| | Maths | Mentale |
|---|---|---|
| Coque (largeur, repli, rail, pied) | `CollapsiblePanel` partagé | `FileSidebar.tsx` : coque refaite (32 px replié, bouton seul, pied à la main, `PanelResizeHandle` direct) |
| Arbre | `ExerciseTree.tsx` (375 l.) : chapitres (1 niveau) → fiches | `FileSidebar.tsx` (764 l.) + `FileTreeRow.tsx` (918 l.) : dossiers N niveaux, plusieurs racines, 2 sortes de fichier (carte, dossier) |
| Source des données | `library.ts` via le port `ExerciseFs`, ordre dans `_ordre.json` | `persistence/fileTree.ts`, `useWorkspaceStore` (racines dans `workspace.json`) |
| Recherche | `PanelSearch` + `treeSearch.ts` (Orama, noms de chapitres et titres de fiches) + bouton « recherche avancée » | `PanelSearch` + filtre texte maison + `select` de type |
| Pied d'actions | `tree.newChapter`, `sheet.new`, `tree.toggleAll`, `tree.onlyToCorrect`, **repli en dernier** | `file.addRootFolder`, `file.refresh`, `view.collapseFolders`, afficher les illisibles, sync (+ pastille), **repli en dernier** |
| Rail replié | libellé vertical (`TreeRailLabel`, 40 px) | bouton seul (32 px) |
| Glisser-déposer | moteur partagé `beginTreeDrag` | moteur partagé via des façades (`sidebar/treeDrag.ts`, `state/useTreeDragStore.ts`, `sidebar/TreeDragGhost.tsx`) |
| Renommer | menu contextuel → champ en ligne | double-clic ou menu → champ en ligne |
| Dupliquer | immédiat, nom « … (copie) » | dialogue (nom pré-rempli « … (copie) ») |
| Déplacer | glisser ou sous-menu « Déplacer vers » | glisser seulement |
| Supprimer | `ConfirmDialog` + nombre d'éléments | `DeletePlanSummary` (ce qui sera effacé, y compris côté serveur) |
| Ordre | manuel (Monter/Descendre, `_ordre.json`) | alphabétique, dossiers d'abord (`sortTree`) |
| Erreurs | alerte locale en haut de l'arbre | bandeau global |
| En-tête | marges `8px 12px`, titre « Mes exercices » | marges 8, titre « Cartes mentales » |

## Constat

Les deux arbres sont **le même composant avec deux modèles de données** :
- Maths : un arbre à 2 niveaux où le « fichier » contient plusieurs exercices (plan sous l'arbre).
- Mentale : un arbre N niveaux de fichiers de cartes.

Ce qui est vraiment spécifique : le **modèle de données** (comment on liste, crée, renomme, déplace,
supprime, ordonne) et les **ornements** (pastilles, entrées de menu supplémentaires). Tout le reste
(rendu des lignes, indentation, repli/dépli, recherche, saisie en ligne, glisser-déposer, menu standard,
pied, états vide/chargement/erreur, accessibilité clavier) est commun.

## Cible

Un composant `FileTree` unique, piloté par un **adaptateur** (port) et une **config** :

```
<FileTree adapter={…} config={…} slots={{ badges, rowMenu, filters, footerActions, emptyState, … }} />
```

- `TreeAdapter` (port) : `list()`, `create(kind, parent, name)`, `rename`, `move`, `duplicate`, `remove`,
  `reorder?` (capacité facultative → Monter/Descendre + ordre manuel), `canDrop`, `kindOf(node)`.
  L'adaptateur de Maths enveloppe `library.ts` (port `ExerciseFs` conservé) ; celui de Mentale enveloppe
  `fileOps.ts` / `fileTree.ts` / `useWorkspaceStore`.
- `config` : `maxFolderDepth` (Maths = 1 → aucun changement de modèle de données ; Mentale = illimité),
  `roots: 'single' | 'multiple'`, `order: 'manual' | 'name'`, libellés (« chapitre/dossier »,
  « fiche/carte »), clés de stockage.
- Commandes standard enregistrées par le composant : `tree.newFolder`, `tree.newFile`, `tree.collapseAll`,
  `tree.refresh`, `tree.focusSearch` (le pied les expose en boutons, dans cet ordre : *créer* → *affichage*
  → *app* → repli).
- Le **pied** est celui de `CollapsiblePanel` (`footer`), le bouton de repli reste **dernier**.
- Le **rail** replié affiche un libellé vertical (`railContent`) : « Cartes mentales · 12 » côté Mentale.
- Sous-dossiers dans Maths : *capacité* livrée mais **désactivée** (`maxFolderDepth: 1`). L'activer est
  une décision produit à part, car `library.ts` et `_ordre.json` devront suivre.

## Décisions UX (détail dans 07)

D04 (coque : `CollapsiblePanel` partout) · D05 (profondeur) · D06 (renommer : double-clic + `F2` + menu) ·
D07 (dupliquer : immédiat puis renommage en ligne) · D08 (supprimer : `ConfirmDialog` + slot de résumé) ·
D11 (erreurs : bandeau global pour l'app, alerte locale pour ce qui concerne l'arbre) · D15 (en-tête unifié).

## Fichiers (lots L7 et L8)

À lire / extraire : voir `lots/L07-panneaux.md` et `lots/L08-arbre.md`.

## Risques

- **Tests de Mentale** (`FileTreeRow.test.tsx` 1 424 l., `FileTreeRow.drag.test.tsx` 212 l.,
  `FileSidebar.test.tsx` 959 l.) : c'est le filet. Ils passent à `packages/shared` *avec* le composant,
  assertions intactes ; seul leur harnais change (adaptateur factice).
- **Synchronisation** : la pastille de sync et les actions `sync.*` restent à Mentale via `footerActions`
  et `badges`. Le composant commun ne connaît ni PocketBase ni « type de carte ».
- **Performance** : l'arbre de Mentale peut compter des milliers de lignes ; ne pas perdre la mémoïsation
  de `FileTreeRow` pendant l'extraction.
