# L6 — Cycle de vie d'un fichier : session, autosave, historique, accueil

> **Ajouts 2026-10-10 (obligatoires)** : voir `../ajustements/ajouts-aux-lots.md` § L6.

**Taille** : L (le plus délicat côté données) · **Dépend de** : L1, L2, L3, L4 · **Fonctionnalités** : F11, F24, F28, F40–F44, F48–F54, F100–F102 · **Décisions** : D07 (en partie), D12, D13, D18, D19

## Objectif
Un seul moteur pour : ouvrir (gardé), charger → valider → armer l'autosave, enregistrer, annuler/rétablir, fermer, récents, session,
titre de fenêtre, ouvrir-avec, dépôt de fichier, accueil sans fichier, dialogues d'échec. `base` le démontre avec une zone de texte.

## À lire
- Maths : `exercises/{useOpenExercise,useExerciseStore,library,recentFiles,NewSheetDialog,fsPort,tauriFs,memoryFs}.ts(x)`, `App.tsx` (l. 62–80, 99–103)
- Mentale : `App.tsx` (l. 88–135, 155–245, 291–406), `persistence/{useAutosave,sessionState,fileStore,fileOps}.ts`, `state/{history,useCardsStore,useWorkspaceStore}.ts`,
  `hooks/{useUnsavedChangesGuard,useWindowTitle,useLaunchFile,useFileDropZone}.ts`, `components/{SaveFailedDialog,CorruptedMapDialog,ReadOnlyMapDialog,RecentFilesList,NewMindMapDialog,ClosingSyncScreen}.tsx`
- Shared : `shell/RecentFilesList.tsx`, `lib/relativeTime.ts`, `crates/suite-tauri/src/lib.rs` (`file_arg`)
- `chantier/04-zone-centrale.md` §3–4

## Chantier 2 — extraction
### `@suite/shared/history`
- `createHistoryStore<T>({ limit = 200, groupMs = 700 })` : `commit(next, groupKey?)`, `undo()`, `redo()`, `reset(initial)`, `canUndo/canRedo`, `depth`. Reprend la logique de `useOpenExercise` (cliché entier, groupe = même clé à moins de `groupMs`, nouvelle modification vide le rétablissement).
- Commandes `edit.undo` / `edit.redo` enregistrées via `useHistoryCommands(store)` (`allowInEditable: true`).
### `@suite/shared/files`
- `DocumentPort<T>` (voir 08). `useFileSession<T>(port, options)` : états `idle | opening | ready | saving | error`, `open(path)` garde → `flush` → charge → valide → arme l'autosave ; échec = retour au fichier précédent ; `close()`, `create()`, `flush()`. Reprend la séquence de `App.tsx` de Mentale (chargement/validation/revert) en la rendant générique.
- `useAutosave<T>(save, value, { delay = 600, enabled, onError })` : fusion de `useOpenExercise` (écriture) et `persistence/useAutosave` (dirty/flush).
- `useUnsavedChangesGuard`, `useWindowTitle(file, appName)`, `useLaunchFile(openFile, event)`, `useFileDropZone(ref, onOpen, accept)` — extraits de Mentale, paramétrés par la config (extensions, événement Tauri).
- `createSessionStore` (dernier fichier, dépliages, récents ≤ 10) ; clé `<id>:session` ; **format lu des deux côtés** (Maths : `recentFiles`; Mentale : `{currentFilePath, expandedPaths, recentFiles}`), écriture au format commun superset.
- Composants : `HomeScreen` (marque pulsante + consigne + `RecentFilesList` + `slot`), `DropOverlay`, `SaveFailedDialog`, `UnreadableFileDialog` (cadre de `CorruptedMapDialog`, réparation = `port.repair`), `NewFileDialog` (champs en slot).
- `TextDocument` dans `apps/base` : `<textarea>` liée à `useFileSession` (`.txt` dans `Documents/Base/`), branchée sur l'historique. Zone centrale de la démo.

## Chantier 3 — migration
- **Maths** : `useOpenExercise` garde ce qui est propre à la fiche (exercice courant, navigation, regroupement par champ) et délègue autosave/historique au commun ; `useExerciseStore` expose le `DocumentPort<Sheet>` ; `recentFiles.ts` supprimé (→ session commune) ; `NewSheetDialog` → `NewFileDialog` + slot chapitre/titre ; garde de fermeture de fenêtre **ajoutée** (D12) ; titre de fenêtre ajouté.
- **Mentale** : `App.tsx` perd ~250 lignes (l. 155–406) au profit de `useFileSession` ; `state/history.ts` → `createHistoryStore` (les actions sont discrètes : pas de `groupKey`, mais plafond 200 ajouté ; vérifier l'effet sur `useCardsStore`/`cardsReducer`) ; `persistence/useAutosave.ts` supprimé ; hooks `useUnsavedChangesGuard`, `useWindowTitle`, `useLaunchFile`, `useFileDropZone` → imports du commun ; `components/RecentFilesList.tsx` (198 l.) → composant commun + slots `adornment`/`wrap` ; la logique de **synchronisation de fermeture** (`ClosingSyncScreen`, `CLOSE_SYNC_TIMEOUT_MS`) reste à l'app, branchée sur le crochet `beforeClose(flush)` du guard.
- **Rust** : l'événement d'ouverture et les extensions restent en config (`SuiteConfig`) ; Maths peut déclarer `open_extensions` si une extension lui est donnée plus tard (non requis).

## Tests
- Déplacer avec le code : `persistence/useAutosave.test.ts`, `hooks/useUnsavedChangesGuard.test.ts`, `useWindowTitle.test.ts`, `useLaunchFile.test.ts`, `useFileDropZone.test.ts`, `state/history.test.ts` (Mentale) ; `useOpenExercise.test.ts` (parties autosave/historique, Maths) ; `RecentFilesList.test.tsx` ; `recentFiles.test.ts`.
- `describeAppContract` : activer (e) « un fichier se crée, s'autosauvegarde, s'annule/rétablit, se ferme » avec un `DocumentPort` en mémoire, sur les 3 apps.
- Tests de session : lire un `zachart-maths:session` ancien et un `zachart-mentale:session` ancien.

## Pièges (les plus coûteux du chantier)
1. **Ne jamais écraser un fichier** : l'ordre `flush → changement de chemin → armement` de Mentale est volontaire (voir le commentaire de `App.tsx` l. 139–154) ; le test de non-régression doit couvrir « un renommage par la synchro pendant l'édition ».
2. L'autosave de Mentale s'arme seulement quand `loadedPath === currentFilePath` ; conserver cette condition dans `useFileSession`.
3. Maths : le regroupement d'historique est **par exercice et par champ** (`groupKey`) ; ne pas l'aplatir.
4. `descriptionHistory.ts` (Mentale) est un troisième moteur : traité au L9, pas ici.
5. Données utilisateur : aucune migration de fichier dans ce lot ; seuls les formats de **session** sont unifiés (lecture rétro-compatible).

## Critères d'achèvement
- [ ] Un seul moteur d'historique et un seul autosave dans le dépôt (hors `descriptionHistory`, L9)
- [ ] `base` ouvre/crée/ferme/annule un `.txt` ; le contrat passe sur les 3 apps
- [ ] Garde de fermeture et titre de fenêtre dans Maths
- [ ] `App.tsx` de Mentale < 350 lignes
- [ ] CLAUDE.md : « Fichiers et historique », sections Maths « Annuler / rétablir » et « exercises » ajustées
- [ ] Suites vertes
