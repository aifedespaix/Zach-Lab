# 01 — État des lieux

Relevé fait le 2026-10-09 sur la branche `ccr-3316f6b7-vnps7a` (base : `49138f2`). Chiffres mesurés
sur les fichiers `.ts`/`.tsx` hors tests.

## Les chiffres

| | Lignes | Fichiers de test (total dépôt : 261) |
|---|---:|---|
| `apps/zachart-mentale/src` | ~30 500 | le plus gros filet (ex. `FileTreeRow.test.tsx` 1 424 l., `FileSidebar.test.tsx` 959 l.) |
| `apps/zachart-maths/src` | ~7 400 | |
| `packages/shared/src` | ~7 200 | |
| `apps/base/src` | 184 | |

`App.tsx` : base 135 l., Maths 299 l., Mentale 617 l. Le *câblage* (thème, raccourcis, palette,
paramètres, mises à jour, écran de chargement) est le même trois fois ; c'est là que se joue la cible
des 95 %.

## Ce qui est déjà partagé (`@suite/shared/…`)

| Entrée | Contenu | Remarque |
|---|---|---|
| `ui` | button, dialog, confirm-dialog, context-menu, dropdown-menu, tooltip, `Hint`, slider, switch | |
| `theme` | store thème, `useResolvedTheme`, transition circulaire, contraste, `theme.css` | |
| `commands` | catalogue (`defineCommandCatalog`), `useCommand`, `CommandButton`, `CommandMenuItem`, palette, raccourcis globaux, réglages de raccourcis | ids = `string` (Mentale remet le typage par des façades) |
| `settings` | `SettingsDialog` (onglets, aperçu en direct, enregistrer/annuler), `ShortcutSettingsPanel` | chaque app recopie les panneaux « Raccourcis » et « Mises à jour » |
| `shell` | `AppShell`, `ResizablePanel`, `CollapsiblePanel`, `CollapsedRail`, `PanelFooter`, `PanelSearch`, `OverflowToolbar`, `BootScreen`, `RecentFilesList`, `usePanelCollapsed`, `usePanelResize`, `panelWidth` | **Mentale n'utilise pas `CollapsiblePanel`** |
| `tree` | moteur de glisser-déposer (pointer events), `TreeDragGhost`, store | l'arbre lui-même n'est PAS partagé |
| `update` | `useAppUpdater`, bannière, section de réglages | |
| `search` | Orama (`createSearchIndex`, `loadSearchIndex`) | |
| `math` / `equation` | KaTeX, logique d'équations, `MathFieldEditor`, `EquationStepsField`, `LinesBlockField`, `TableGrid` | |
| Rust `suite-tauri` | `builder()` (plugins, instance unique), `file_arg`, `size_main_window_to_screen` | les `capabilities/default.json` divergent |

## Les doublons relevés (preuves)

| # | Doublon | Où |
|---|---|---|
| 1 | Câblage d'app (thème, palette, réglages, MàJ, `useShortcutSettingsStore.init`) | `App.tsx` ×3 |
| 2 | Panneaux de réglages « Raccourcis » + « Mises à jour » + leurs `sources` (même JSON de comparaison) | `App.tsx` base/Maths, `settings/SettingsDialog.tsx` Mentale |
| 3 | Bascule de thème (`startCircularThemeTransition`) | base, Maths (origine = haut-centre), Mentale `AppToolbar` (origine = clic) |
| 4 | Logo animé (4 points + tracés) + CSS | `apps/zachart-maths/src/AnimatedLogo.tsx` + `index.css`, `apps/zachart-mentale/src/components/AnimatedLogo.tsx` — seule la forme (M / Z) et les couleurs changent |
| 5 | Écran de chargement avec plancher | Maths 1 300 ms, Mentale 1 500 ms |
| 6 | Fichiers récents | `shared/shell/RecentFilesList` (43 l.), `maths/exercises/recentFiles.ts`, `mentale/components/RecentFilesList.tsx` (198 l.), `mentale/persistence/sessionState.ts` |
| 7 | Autosave avec anti-rebond + `flush` | `maths/exercises/useOpenExercise.ts` (600 ms), `mentale/persistence/useAutosave.ts` (500 ms) |
| 8 | Historique annuler/rétablir | `maths/useOpenExercise` (clichés de la fiche, regroupement 700 ms, 200 pas), `mentale/state/history.ts` (past/present/future, sans plafond) |
| 9 | Lecture/écriture `localStorage` avec `try/catch` écrits à la main | 8 modules Maths (`useZoom`, `useCompact`, `useUnitColors`, `useCoursesStore` (3 clés), `useCorrectionView`, `useSheetSort`, `useToolbarFamilies`, `recentFiles`), 7 modules Mentale (`persistence/booleanFlag`, `bandTab`, `bandFamilies`, `descriptionNarrow`, `sidebarWidth`, `cardDetailWidth`, `sessionState`) |
| 10 | Panneau gauche repliable | `shared/CollapsiblePanel` (Maths) vs `FileSidebar.tsx` (Mentale : largeur 32 px, bouton, pied et largeur refaits à la main) |
| 11 | Panneau droit | `shared/CollapsiblePanel` + `PanelToggles` (Maths) vs `CardDetailPanel.tsx` (Mentale : `CollapsedRail` seul, largeur dans `cardDetailWidth.ts`) |
| 12 | Façades de typage des commandes | `mentale/hooks/useCommand.ts`, `components/commands/CommandButton.tsx`, `CommandMenuItem.tsx` |
| 13 | Arbre de fichiers | `maths/exercises/ExerciseTree.tsx` (375 l.) vs `mentale/components/sidebar/FileSidebar.tsx` (764 l.) + `FileTreeRow.tsx` (918 l.) |
| 14 | Dialogue « nom » / « nouveau fichier » | `maths/NewSheetDialog.tsx`, `mentale/sidebar/NameDialog.tsx` + `NewMindMapDialog.tsx` |
| 15 | Barre d'outils | `maths` : `OverflowToolbar` adaptative ; `mentale` : `AppToolbar.tsx` (520 l.) fixe |
| 16 | Dialogue d'échec de sauvegarde / fichier illisible / bandeaux | Mentale seulement, mais le besoin est le même partout |

## Divergences fonctionnelles « gratuites » (mêmes noms, sens différents)

- **`view.zoomIn/zoomOut/zoomReset`** : Maths = zoom de **toute l'interface** (`documentElement.style.zoom`,
  50–150 %). Mentale = zoom du **canvas** React Flow. Mêmes ids, mêmes raccourcis par défaut
  (`Mod+Plus/Minus/0`), deux sens. À séparer avant de partager (D09).
- **`sheet.new`/`sheet.close`** (Maths) vs **`file.new`/`file.close`** (Mentale, `Mod+N`/`Mod+W`).
- **`view.toggleTree`** (Maths, `Mod+B`) vs **`view.toggleSidebar`** (Mentale, `Mod+B`) ; **`view.toggleCourses`**
  vs **`view.toggleDetailPanel`** (`Mod+Shift+B` des deux côtés).
- **`app.toggleTheme`** (Maths, sans raccourci) vs **`view.toggleTheme`** (Mentale, `Mod+Shift+T`).
- **Capacités Tauri** : Maths limite `fs` à `$DOCUMENT/Zach'Math/**` ; Mentale ouvre `$HOME/**` (nécessaire
  : l'utilisateur choisit ses dossiers). Maths n'a pas `opener`, `dialog`, `fs:allow-stat`, etc.

## Risques structurels repérés

1. **Les raccourcis personnalisés sont stockés par id de commande** (`shortcuts.json` dans le dossier
   de config, `sanitizeShortcutSettings` écarte tout id inconnu). Renommer un id sans alias efface en
   silence la personnalisation des élèves. → mécanisme d'alias au lot L1.
2. **Le zoom CSS (`zoom` sur `<html>`) est fragile** : il a fallu une règle CSS pour les popovers Radix
   (`[data-radix-popper-content-wrapper]`) puis un correctif d'infobulle (`e019bf4`, 2026-10-09), et il
   faut tenir `--app-height` à la main. Dans Mentale, React Flow calcule ses coordonnées avec
   `getBoundingClientRect` : le combiner à un zoom CSS est un risque réel. → spike S1 (lot L0).
3. **Deux mécanismes de persistance** coexistent : `localStorage` (préférences d'interface) et fichiers
   JSON dans `appConfigDir` (raccourcis, dossiers de travail Mentale). → un seul point d'entrée par
   mécanisme, au lot L2.
4. **Mentale pèse 4× Maths** : c'est elle qui coûtera le plus à migrer, et son filet de tests est
   précieux. On migre Maths d'abord à chaque lot, Mentale ensuite.
5. **Maths peut perdre ≤ 600 ms d'édition** si la fenêtre est fermée juste après une frappe : le
   `flush` n'est appelé qu'au changement de fiche (`useOpenExercise.ts`), pas à la fermeture de la
   fenêtre (à confirmer au lot L6 ; Mentale a `useUnsavedChangesGuard`).
