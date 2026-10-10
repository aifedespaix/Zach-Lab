# L8 — L'arbre de fichiers commun

> **Ajouts 2026-10-10 (obligatoires)** : voir `../ajustements/ajouts-aux-lots.md` § L8 (arbre vide, renommage par menu, FolderPicker, recherche avancée, pied commun).

**Taille** : XL (le plus gros lot, à découper en 3 sessions) · **Dépend de** : L1, L2, L6, L7 · **Fonctionnalités** : F45–F47, F65–F78, F80 · **Décisions** : D05, D06, D07, D08, D11, D15, D19

## Objectif
Un composant `FileTree` unique — dossiers et sous-dossiers, recherche, repli, création, renommage en ligne, déplacement, glisser-déposer, menu
contextuel, états vide/chargement/erreur — piloté par un `TreeAdapter` et une config. Maths et Mentale ne gardent que leur adaptateur et leurs ornements.

## Découpage conseillé (3 passes, chacune verte)
- **L8a — extraction depuis Mentale** (version la plus complète) : `FileTree` + `FileTreeRow` génériques + adaptateur factice de test ; Mentale migre.
- **L8b — Maths** : adaptateur `ExerciseTree` (`maxFolderDepth: 1`, `order: 'manual'`, `reorder`), entrées de menu Monter/Descendre/Déplacer vers, filtre « à corriger », recherche avancée.
- **L8c — finitions** : D06/D07/D08 uniformisés, `F2`, duplication → renommage, résumé de suppression en slot, marqueur d'illisible (D19).

## À lire
- Mentale : `components/sidebar/{FileSidebar,FileTreeRow,NameDialog,PropertiesDialog,ExportDialog,useFolderCreation,DeletePlanSummary,MapTypeBadge,CopyLinkBadge,treeFilter,treeDrag,TreeDragGhost}.ts(x)`, `persistence/{fileTree,fileOps,paths,mindMapFormatCache,mindMapMetaCache}.ts`, `state/{useWorkspaceStore,useTreeDragStore}.ts`, `hooks/{useDeleteMindMap,useMindMapTypeIndex,useMindMapAuthor}.ts`
- Maths : `exercises/{ExerciseTree,SheetOutline,TreeRailLabel,ChapterField,NewSheetDialog,ToCorrectBadge,treeSearch,librarySearch,AdvancedSearchDialog,library,sheet,useExerciseStore,names}.ts(x)`
- Shared : `tree/*`, `shell/PanelSearch.tsx`, `ui/{context-menu,confirm-dialog}.tsx`
- `chantier/03-zone-gauche.md`

## Chantier 2 — extraction (`@suite/shared/tree`)
- `TreeAdapter`, `TreeNode` (08), `FileTreeConfig` (`maxFolderDepth`, `roots`, `order`, `labels`, `storageKey`), `FileTreeSlots` (`badges`, `rowMenu`, `filters`, `footerActions`, `emptyState`, `rowTooltip`).
- Hook headless `useFileTree(adapter, config)` (état : nœuds, dépliés, sélection, mode renommage, recherche, filtre) + `<FileTree>` + `<FileTreeRow>` + `<TreeSearchHeader>` (titre + `PanelSearch` + `trailing`).
- Menu de ligne standard : Ouvrir, Nouveau (fichier/dossier), Renommer, Dupliquer, Déplacer vers…, Monter/Descendre (si `reorder`), Afficher dans l'explorateur, Copier le chemin, Supprimer ; `rowMenu` ajoute/retire des entrées (Mentale : Propriétés, Exporter, Publier, Classer ; Maths : « Nouvelle fiche dans ce chapitre »).
- Commandes `tree.newFolder`, `tree.newFile`, `tree.collapseAll`, `tree.refresh`, `tree.focusSearch` ; pied : `<TreeFooter>` composable (créer → affichage → app).
- Glisser-déposer : le moteur partagé existant (`beginTreeDrag`) ; `canDrop` vient de l'adaptateur ; les façades `sidebar/treeDrag.ts`, `state/useTreeDragStore.ts`, `sidebar/TreeDragGhost.tsx` disparaissent.
- `NameDialog` commun (`@suite/shared/ui`), `DeletePlanSummary` → slot `deleteSummary`.
- Recherche : index Orama fourni par l'app (`search.index`) ; texte et accents tolérés.
- États : chargement, vide, aucun résultat, erreur locale, illisible (D19), textes en config.
- `apps/base` : `FileTree` avec un adaptateur fichiers `.txt` (via `Fs`).

## Chantier 3 — migration
- **Mentale (L8a)** : `FileSidebar.tsx` → `<FileTree adapter={mindMapTree} config={…} slots={…}/>` (≈ 150 l. d'adaptateur + slots) ; `FileTreeRow.tsx` → commun + `rowMenu`/`badges` ; `fileOps.ts`/`fileTree.ts`/`useWorkspaceStore` restent derrière l'adaptateur ; les actions `sync.*` en `footerActions` ; type filter en `filters`.
- **Maths (L8b)** : `ExerciseTree.tsx` (375 l.) → adaptateur `library.ts` + slots (`ToCorrectBadge`, filtre « à corriger », « recherche avancée » dans `trailing`) ; `SheetOutline` reste, monté sous l'arbre comme section du panneau (L7) ; `treeSearch.ts` → fourniture de l'index ; `ChapterField` inchangé.
- **Maths — sous-dossiers** : *non activé* (D05) ; le champ `maxFolderDepth: 1` est la seule limite.

## Tests
- **Déplacer avec le code** (assertions intactes) : `FileTreeRow.test.tsx` (1 424 l.), `FileTreeRow.drag.test.tsx`, `FileSidebar.test.tsx` (959 l.), `NameDialog.test.tsx`, `ExerciseTree.test.tsx`, `ExerciseTree.drag.test.tsx`, `ExerciseTree.menus.test.tsx`. Leur harnais passe par un adaptateur factice (`@suite/shared/testing`), les cas métier restent dans l'app (adaptateur de Mentale : opérations de fichiers).
- Nouveaux : contrat d'adaptateur (`describeTreeAdapterContract(adapter)` — créer/renommer/déplacer/dupliquer/supprimer/réordonner), profondeur max, ordre manuel vs nom, saisie en ligne, clavier (flèches, `F2`, Entrée, Suppr, Échap).
- `describeAppContract` : arbre présent, création d'un dossier et d'un fichier, recherche, repli de tout.

## Pièges
- **Performance** (milliers de lignes dans Mentale) : mémoïser `FileTreeRow`, virtualiser seulement si mesuré nécessaire (ne pas ajouter de lib préventivement).
- Renommer un dossier ouvert / déplacer le fichier courant → l'adaptateur renvoie le nouveau chemin et la session de fichier (L6) suit.
- Les noms de fichier illégaux, les doublons, la casse (Windows) : la validation vit dans l'adaptateur (règle propre au disque), le message dans la config.
- Mentale multi-racines : racine non supprimable depuis le disque (« retirer » seulement).

## Critères d'achèvement
- [ ] `FileSidebar.tsx` < 200 lignes, `FileTreeRow.tsx` supprimé de l'app ; `ExerciseTree.tsx` < 120 lignes
- [ ] Un seul arbre dans le dépôt ; `base` en montre un
- [ ] Les trois fichiers de test cités passent sans changement d'assertions
- [ ] CLAUDE.md : « Arbre de fichiers » (nouvelle section), sections Maths « exercises » et « Tree drag-and-drop » ajustées
- [ ] Suites vertes
