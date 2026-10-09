# 06 — Transversal : commandes, persistance, réglages, démarrage, Rust, scripts, tests

## 1. Commandes

### Ce qui existe
- Catalogue déclaré par app (`defineCommandCatalog({ categories, commands })`), lu par la barre, la
  palette et le panneau de raccourcis. Ids = `string` dans `shared`.
- Mentale remet un type `CommandId` par trois façades (`hooks/useCommand.ts`, `components/commands/CommandButton.tsx`,
  `CommandMenuItem.tsx`). Maths utilise directement les chaînes.
- Les **raccourcis personnalisés** sont stockés par id (`shortcuts.json` dans `appConfigDir`), et
  `sanitizeShortcutSettings` écarte les ids inconnus.

### Cible
1. **Ids standard** par espace de noms. Une app peut en ajouter, pas redéfinir le sens d'un standard.

   | Espace | Standard | Remplace (Maths) | Remplace (Mentale) |
   |---|---|---|---|
   | `app` | `app.palette` `app.settings` `app.shortcuts` `app.toggleTheme` | `app.toggleTheme` | `view.toggleTheme` |
   | `file` | `file.new` `file.close` `file.open` `file.save` `file.rename` `file.duplicate` `file.delete` `file.reveal` | `sheet.new` `sheet.close` | (inchangés) |
   | `edit` | `edit.undo` `edit.redo` | (inchangés) | (inchangés) |
   | `view` | `view.toggleLeftPanel` `view.toggleRightPanel` `view.zoomIn/Out/Reset` (interface) `view.toggleDensity` | `view.toggleTree` `view.toggleCourses` `view.toggleCompact` | `view.toggleSidebar` `view.toggleDetailPanel` |
   | `tree` | `tree.newFolder` `tree.newFile` `tree.collapseAll` `tree.refresh` `tree.focusSearch` | `tree.newChapter` `tree.toggleAll` | `file.newFolder` `view.collapseFolders` `file.refresh` `view.findInTree` |
   | `panel` | `panel.<id>.toggle` (un par section de panneau) | `cours.toggle` `notes.toggle` `calculatrice.toggle` (gardés comme alias) | — |
   | `canvas` (Mentale) | `canvas.zoomIn/Out/Reset/fit` | — | `view.zoomIn/Out/Reset` `view.fitView` (renommés) |

2. **Alias** : `defineCommandCatalog({ …, aliases: { 'sheet.new': 'file.new', … } })`. Les alias servent
   (a) à lire les anciens `shortcuts.json` (l'ancien id est remplacé par le nouveau **avant**
   `sanitizeShortcutSettings`), (b) aux tests et aux appels `runCommand` d'anciens modules. Un test
   garantit que chaque ancien id a un alias tant qu’aucune décision explicite ne retire la
   rétro-compatibilité.
3. **Typage** : `createTypedCommands<typeof COMMANDS>()` retourne `{ useCommand, CommandButton,
   CommandDropdownItem, runCommand }` typés par l'app. Les trois façades de Mentale disparaissent.
4. **Catégories standard** : `app`, `file`, `edit`, `view`, `tree`, `panel` ; l'app en ajoute.
5. **Conflit de raccourcis** à traiter dans L1 : `Mod+Plus/Minus/0` (zoom de l'interface vs zoom du canvas).

## 2. Persistance

### Ce qui existe
- Au moins 17 clés `localStorage`, avec des `try/catch` et des « lecteurs » écrits un par un (une dizaine de
  variantes de `readX()` dans `useCoursesStore.ts`, `useZoom.ts`, `useCompact.ts`, `booleanFlag.ts`,
  `bandTab.ts`…). Préfixe : `zachart-maths:` / `zachart-mentale:`.
- Fichiers JSON dans `appConfigDir` : `shortcuts.json`, `workspace.json` (Mentale), réglages de quiz / apparence /
  synchronisation (Mentale).
- Formats de fichier versionnés à la main : fiche v1 → v2 (Maths), `.json` → `.zmap` (Mentale).

### Cible (`@suite/shared/storage`)
- `defineApp({ id })` fixe le préfixe ; `createPersisted<T>({ key, fallback, parse, version, migrate })` et ses
  cas courants (`persistedFlag`, `persistedNumber`, `persistedEnum`) renvoient un store zustand
  qui lit sans jamais lever, écrit sans jamais lever, et se dégrade en mémoire si le stockage est refusé.
- **Les clés existantes sont conservées à l'identique** (`zachart-maths:zoom` …) : la migration ne casse
  aucune préférence d'élève. Un test vérifie que chaque ancienne clé est relue.
- `readJsonConfig(name, schema)` / `writeJsonConfig` pour `appConfigDir` : création du dossier, JSON
  versionné, valeur par défaut si fichier absent ou illisible.
- Test de frontière : plus aucun `localStorage` hors de `shared/storage` (après L2).

## 3. Réglages

- Le dialogue (`SettingsDialog`) est déjà commun. Chaque app y recopie : le panneau Raccourcis, le panneau
  Mises à jour, et un bloc `sources` (instantané / restauration / enregistrement / détection de changement)
  qui sérialise en JSON pour comparer.
- Cible : `standardSettings({ shortcuts: true, updates: true, appearance: { font: true, density: true,
  zoom: true } })` renvoie `{ panels, sources }` à fusionner avec ceux de l'app. Le panneau **Apparence**
  commun contient thème, police, densité et zoom ; Mentale y ajoute ses niveaux de cartes (existant :
  `AppearanceSettingsPanel`), Maths sa barre d'outils de symboles.

## 4. Démarrage et cadre

Une fonction `defineApp(config)` + un composant `<SuiteApp>` remplacent les 100–200 premières lignes
de chaque `App.tsx` :

- initialisation (thème DOM, raccourcis globaux, store de raccourcis, mises à jour) ;
- écran de chargement avec plancher (`bootFloorMs`, défaut 1300) et marque animée configurable ;
- palette, réglages, bannière de MàJ, `TooltipProvider`, pile de `StatusBanner` ;
- zones de la barre, panneaux, zone de travail, overlays de l'app.

Détail dans `08-architecture-cible.md`.

## 5. Côté Rust et scripts

- `crates/suite-tauri` : `builder`, `file_arg`, `size_main_window_to_screen` existent. À ajouter : mémoire
  de la position/taille de la fenêtre (F121), et un **test de socle de capacités** : un script lit
  `apps/*/src-tauri/capabilities/default.json` et vérifie que chaque app contient le socle commun
  (`core:default`, `opener:default`, `dialog:default`, `updater:default`, les `fs:allow-*` de base) ; les
  **scopes** `fs` restent propres à l'app (Maths : `$DOCUMENT/Zach'Math/**` ; Mentale : `$HOME/**`).
- `scripts/new-app.mjs` remplace aujourd'hui des chaînes précises dans `apps/base/src/App.tsx`
  (`'base:left-width'`, `'base:right-width'`). Avec `defineApp({ id: 'base' })`, il n'y a plus qu'**une**
  chaîne à remplacer, dans `apps/base/src/app.config.ts` ; `new-app.test.mjs` suit.
- `docs/RELEASE.md` et les scripts de version ne changent pas.

## 6. Tests

- Chaque app a son `src/test/setup.ts` ; `packages/shared/src/test/setup.ts` existe. À ajouter dans
  `@suite/shared/testing` (non importé par le code de production) : `renderApp`, `memoryFs`
  (généralisé à partir de `maths/exercises/memoryFs.ts`), un faux `TreeAdapter`, et
  **`describeAppContract(App, options)`** : vérifie, pour toute app, que (a) les commandes standard sont
  enregistrées, (b) *Fermer* est dans la zone *fichier* de la barre, (c) les panneaux se replient au
  raccourci et au bouton, (d) le zoom d'interface répond, (e) un fichier se crée, s'autosauvegarde,
  s'annule/rétablit et se ferme, (f) l'ordre des boutons du pied est *créer → affichage → app → repli*.
- Le contrat est lancé sur `base`, Maths et Mentale ; une future app l'hérite en copiant `base`.
- **Captures de référence (optionnel, spike S2)** : Chromium et Playwright sont préinstallés ; avec
  `@tauri-apps/api/mocks` on peut lancer Vite et photographier les écrans clés avant/après chaque lot. À
  décider au lot L0 selon le coût réel.
