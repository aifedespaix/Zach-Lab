# Suivi des lots

Fichier lu **et mis à jour** par les prompts `prompts/chantier-2-extraction.md` et `prompts/chantier-3-migration.md`.
Un lot passe de `à faire` → `extrait` (chantier 2 fini) → `migré Maths` → `migré Mentale` → `terminé`.
Ne jamais sauter un état. Le « prochain lot » = le premier de la liste, dans l'ordre ci-dessous, qui n'est pas `terminé`
et dont les dépendances le sont.

## État de référence

Voir `09-non-regression.md` §1 : 3 547 tests (shared 554, base 10, Maths 647, Mentale 2 336) + admin 179 + scripts 89.
Mesure de mutualisation de `base` au départ (L0, `bun run measure:sharing`) : **95,9 %** — mais la mesure compte tout fichier atteint en entier (barrels compris) : elle est déjà ≥ 95 % car `base` est vide. Le critère qui reste discriminant est « `base` ≤ 150 lignes, `App.tsx` sans logique » (README).

## Lots

| Lot | Titre | Taille | Dépend de | Fichier | État | Tests (après) | Mutualisation `base` | Notes / décisions par défaut |
|---|---|---|---|---|---|---|---|---|
| L0 | Socle et filet | M | — | [lots/L00-socle-et-filet.md](lots/L00-socle-et-filet.md) | extrait | voir journal | base 95,9 % (lignes de `shared` atteintes depuis `main.tsx`, 4 002 / 4 175) ; Maths 49,5 % | Contrat branché sur les 3 apps (5 vérifs actives + 10 `todo` par lot). Mentale : `app.toggleTheme` s'appelle `view.toggleTheme` (alias via `commandIds`, L1). Rien à migrer côté apps : L0 est terminé côté chantier 3. S1 : voie A (CSS) pour D09. S2 : livré. |
| L1 | Commandes | M | L0 | [lots/L01-commandes.md](lots/L01-commandes.md) | extrait | voir journal | base 100 % des commandes via `shared` | `standardCommands`, `aliases`, `createTypedCommands` livrés et branchés dans `base` ; contrat `adoptedLots: ['L1']` (actif sur base, `skip` L1 sur Maths/Mentale). D01, D16 (`Mod+Shift+T`) pris par défaut. `app.shortcuts` non retenu dans `base` (pas de gestionnaire avant L3). Reste au chantier 3 : renommages + 3 façades de Mentale. |
| L2 | Persistance | M | L0 | [lots/L02-persistance.md](lots/L02-persistance.md) | extrait | voir journal | inchangée | `@suite/shared/storage` livré ; `shared` ne touche plus `localStorage` ailleurs (test). `fs:allow-rename` ajouté à la capacité de `base` : à ajouter à Maths et Mentale au chantier 3. `version` de `createPersisted` remplacé par `migrate` (chaîne) + `readVersioned` pour les fichiers. |
| L3 | Cadre et démarrage | L | L1, L2 | [lots/L03-cadre-et-demarrage.md](lots/L03-cadre-et-demarrage.md) | extrait | voir journal | `base` : `App.tsx` 12 lignes (voir journal pour la mesure) | `@suite/shared/app` (`defineApp`, `SuiteApp`, `useAppStatus`), `AnimatedMark`/`AppBoot`/`StatusBanner`, `useToggleTheme`/`ThemeToggle`, `standardSettings`/`mergeSettings`. Contrat `adoptedLots: ['L1','L3']` sur base (3 vérifs L3 actives). D10, D11 par défaut. `app.shortcuts` ajouté au catalogue de base. Reste au chantier 3 : `App.tsx` de Maths/Mentale, suppression des deux `AnimatedLogo` (+CSS), `BOOT_FLOOR_MS`, `SettingsDialog` de Mentale, `.status-banner` de `MindMapCanvas`/`FileSidebar` → `StatusBanner`, hook `onReady` pour l'ordre d'init des stores de Mentale. |
| L4 | Barre du haut | L | L1, L3 | [lots/L04-barre-du-haut.md](lots/L04-barre-du-haut.md) | extrait | shared 687 (+ base 25) | base 98,9 % (62 l. hors tests) | `AppToolbar`/`defineToolbar`/`FileMenu`/`FileTitle` dans `@suite/shared/shell` ; `SuiteApp` : `toolbar`/`systemButtons` remplacés par `app.toolbar` (+ `hide`) et `file`. Contrat `adoptedLots: ['L1','L3','L4']` sur base (ordre des zones, Fermer avant Annuler, `app.shortcuts` → Raccourcis). D02, D03 par défaut. Reste au chantier 3 : `AppToolbar.tsx` de Mentale (items `app` : carte flottante, exporter, révéler, quiz, cadenas, mise à jour, synchro), `toolbarItems` de Maths ; suppression du menu « Paramètres et raccourcis » ; ids `file.newFolder` etc. de Mentale → standard. Le critère « ne déborde jamais (600/900/1 400 px) » reste `todo` : jsdom ne mesure pas. |
| L5 | Vue : zoom, densité, police | M | L2, L3, L4, S1 | [lots/L05-vue-zoom-densite.md](lots/L05-vue-zoom-densite.md) | extrait | shared 713 (+ base 27) | base 98,9 % (62 l. hors tests) | `@suite/shared/view` (voie A, S1) : `useUiZoom`/`useDensity`/`useFontFamily`/`spacing`, `ZoomControls`/`DensityToggle`, panneau « Apparence » (`standardSettings({ appearance })`), règle CSS des popovers dans `theme.css`. `defineApp({ view })` désactive chaque préférence (repli S1 pour le canvas de Mentale). Contrat `adoptedLots` de base : +L5. Vérif. visuelle de `base` à 50/100/150 % faite (infobulle, dialogue, pas de défilement) ; **canvas de Mentale non vérifié** (pas migré). Reste au chantier 3 : Maths (supprimer `useZoom`/`useCompact`, effet de `App.tsx`, CSS popover de `index.css`, item zoom de la barre ; clés inchangées), Mentale (activer `view.zoom` après essai manuel du canvas à 50/150 % ; `useAppliedFontFamily` → `useFontFamily`, `AppearanceSettingsPanel` + sections communes), aucune capacité Tauri à ajouter (voie A). |
| L6 | Fichiers, historique, accueil | L | L1–L4 | [lots/L06-fichiers-historique-accueil.md](lots/L06-fichiers-historique-accueil.md) | extraction partielle (passe 1) | shared +24 (history 6, session 7, useFileSession 11) ; base 29 + contrat L6 | base : `App.tsx` 41 l., `textFiles.ts` 22 l., `TextDocument.tsx` 14 l. | **Fait** : `@suite/shared/history` (`createHistoryStore`, `useHistoryCommands`), `@suite/shared/files` (`DocumentPort`, `useFileSession`, `useAutosave`, `createSessionStore` lisant les formats Maths et Mentale, `useWindowTitle`, `HomeScreen`, `SaveFailedDialog`, `UnreadableFileDialog`) ; `base` ouvre/crée/ferme/annule un `.txt` (capacité `$DOCUMENT/Base` + dépendance `@tauri-apps/plugin-fs` ajoutées) ; contrat L6 actif sur base (créer → Fermer/Annuler grisé → fermer). **Reste à extraire (passe 2)** : `useUnsavedChangesGuard` (fermeture de fenêtre + crochet `beforeClose`), `useLaunchFile`, `useFileDropZone` + `DropOverlay`, `NewFileDialog`, réparation (`repair`) branchée dans `UnreadableFileDialog`, `ReadOnlyMapDialog`. `NewFileDialog` absent : `file.new` de `base` crée `Sans titre.txt` sans formulaire. Le lot reste `extraction partielle` tant que la passe 2 n'est pas faite. |
| L7 | Panneaux latéraux | L | L1, L2, L4 | [lots/L07-panneaux.md](lots/L07-panneaux.md) | à faire | | | |
| L8 | Arbre de fichiers | XL (3 passes) | L1, L2, L6, L7 | [lots/L08-arbre.md](lots/L08-arbre.md) | à faire | | | |
| L9 | Contenu éditable | M | L6 | [lots/L09-contenu-editable.md](lots/L09-contenu-editable.md) | à faire | | | |
| L10 | Plateforme Rust / scripts | M | L3, L5 | [lots/L10-plateforme-rust-scripts.md](lots/L10-plateforme-rust-scripts.md) | à faire | | | |
| L11 | Clôture | S | tous | [lots/L11-cloture.md](lots/L11-cloture.md) | à faire | | | |

L'ordre L5 / L6 / L7 peut être permuté (pas de dépendance entre eux) si l'utilisateur veut voir en premier la barre
de gauche ou la zone de droite ; L8 attend L6 et L7.

## Décisions UX

Voir `07-decisions-ux.md`. Décisions non validées au démarrage d'un lot : prises **par défaut (recommandation)** et listées ici.

| Décision | Statut | Lot où elle a été appliquée par défaut |
|---|---|---|
| D01 à D19 | à valider | |

## Journal

| Date | Lot | Événement |
|---|---|---|
| 2026-10-09 | L0 | Extrait : `@suite/shared/testing` (`describeAppContract`, `createMemoryFs`), `bun run measure:sharing`, spikes S1 (voie A) et S2 (`scripts/baseline-shots.mjs`). |
| 2026-10-09 | L1 | Extrait : alias d'ids, `standardCommands`, `createTypedCommands`, détection de conflit de raccourci standard (dev). |
| 2026-10-09 | L2 | Extrait : `@suite/shared/storage` (`createPersisted*`, `readJsonConfig`/`writeJsonConfig`, `readVersioned`), panneaux/thème/raccourcis de `shared` migrés dessus. |
| 2026-10-09 | L3 | Extrait : `@suite/shared/app`, `AnimatedMark`, `AppBoot`, `StatusBanner`, `useToggleTheme`, `standardSettings`/`mergeSettings` ; `base` ramenée à `app.config.ts` + `App.tsx` (12 l.) ; `new-app` ne renomme plus que `id`/`name` de `app.config.ts`. |
| 2026-10-09 | L4 | Extrait : `defineToolbar`, `arrangeToolbar`, `AppToolbar`, `FileMenu`, `FileTitle` ; `SuiteApp` pose la barre standard ; 3 vérifications de contrat L4 sur `base`. |
| 2026-10-09 | L5 | Extrait : `@suite/shared/view`, panneau « Apparence », commandes `view.*` dans `base`, contrat L5 actif sur `base`. |
| 2026-10-09 | L6 | Passe 1 : `history` + `files` (moteur de session, autosave, session, accueil, dialogues d'échec), `base` sur un `.txt`, contrat L6. Passe 2 à faire : garde de fermeture, ouvrir-avec, dépôt, `NewFileDialog`, réparation. |
| 2026-10-09 | — | Chantier 1 (analyse) terminé : `chantier/` créé, état de référence relevé. |
