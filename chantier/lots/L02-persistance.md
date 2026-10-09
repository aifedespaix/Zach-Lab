# L2 — Persistance : préférences et configuration

**Taille** : M · **Dépend de** : L0 (L1 conseillé) · **Fonctionnalités** : F10, F11, F12 · **Décisions** : aucune (clés conservées)

## Objectif
Un seul chemin pour lire/écrire une préférence, **sans changer une seule clé stockée**, et un seul utilitaire pour les
fichiers de config JSON de `appConfigDir`.

## À lire
- Maths : `exercises/{useZoom,useCompact,useUnitColors,useCorrectionView,useSheetSort,useToolbarFamilies,recentFiles}.ts`, `cours/useCoursesStore.ts`
- Mentale : `persistence/{booleanFlag,bandTab,bandFamilies,descriptionNarrow,sidebarWidth,cardDetailWidth,showUnreadableFiles,sessionState,workspaceConfig,quizSettings,appearanceSettings,syncSettings}.ts`
- Shared : `shell/{panelWidth,usePanelCollapsed,usePanelResize}.ts`, `theme/useThemeStore.ts`, `commands/shortcutSettingsPersistence.ts`
- `chantier/06-transversal.md` §2

## Chantier 2 — extraction (`@suite/shared/storage`, nouveau)
- `defineAppStorage(appId)` → `{ key(name) }` (`zachart-maths:zoom`). Pour ne pas changer les clés historiques, l'`appId` de Maths est
  `zachart-maths` et celui de Mentale `zachart-mentale` (les clés existantes suivent déjà `<id>:<nom>`).
- `createPersisted<T>({ key, fallback, parse, serialize?, version?, migrate? })` → store zustand : lit au premier accès, **ne lève jamais**, écrit
  à chaque `set`, se dégrade en mémoire. Raccourcis : `persistedFlag`, `persistedNumber(min,max,step)`, `persistedEnum`, `persistedSet`.
- `readJsonConfig(name, { fallback, parse, version })` / `writeJsonConfig(name, value)` : `appConfigDir`, création du dossier, atomicité simple
  (écrit puis renomme) si Tauri le permet, valeur par défaut si absent ou illisible, ne perd jamais un fichier illisible (le renomme en `.bak`).
- `readVersioned(raw, steps)` : application ordonnée de migrations (v1→v2…), utilisable par Maths (fiches) et Mentale (`.json`→`.zmap`).
- Tests : lecture d'une clé historique, stockage refusé (`localStorage` qui lève), valeur corrompue, migration, `readJsonConfig` sur fichier absent / illisible.

## Chantier 3 — migration
**Maths** — réécrire chaque store sur `createPersisted*` : `useZoom` (plus tard déplacé au L5), `useCompact`, `useUnitColors`,
`useCorrectionView` (2 clés), `useSheetSort`, `useToolbarFamilies` (`zachart-maths:toolbar-hidden`), `useCoursesStore` (3 clés), `recentFiles`
(`zachart-maths:session`, format conservé). Les `try/catch` maison disparaissent.
**Mentale** — `persistence/booleanFlag.ts` (devient un alias de `persistedFlag` puis disparaît), `bandTab`, `bandFamilies`, `descriptionNarrow`,
`sidebarWidth`, `cardDetailWidth` (ces deux largeurs passeront à `createPanelWidthStorage` au L7), `showUnreadableFiles`, `sessionState`.
`workspaceConfig.ts`, `quizSettings.ts`, `appearanceSettings.ts`, `syncSettings.ts`, `shortcutSettingsPersistence.ts` → `readJsonConfig`/`writeJsonConfig`
(noms de fichier **inchangés**).
**Shared** — `panelWidth.ts`, `usePanelCollapsed.ts`, `usePanelResize.ts`, `useThemeStore.ts` utilisent `createPersisted`.

## Tests
- Chaque ancien test de persistance (Mentale : `persistence/*.test.ts`) reste, assertions intactes ; il teste maintenant l'adaptateur mince.
- Test de non-régression des clés : tableau `[clé, valeur d'exemple, attendu]` pour les 17 clés connues.
- `boundary.test.ts` (shared + apps) : **plus aucun `localStorage` hors `shared/storage`**.

## Pièges
- Les valeurs historiques ont des formats différents (`'true'/'false'`, nombres, JSON) : chaque `parse` reproduit le format existant.
- `try/catch` autour de `localStorage` dans les **tests** (jsdom) : garder l'équivalent dans le faux stockage.
- Ne pas migrer `pocketbaseClient.ts` (jeton d'authentification, sécurité propre à Mentale) : à relire, pas à réécrire.

## Critères d'achèvement
- [ ] Zéro `localStorage` hors `shared/storage` (test)
- [ ] 17 clés relues à l'identique (test)
- [ ] CLAUDE.md : section « Persistance »
- [ ] Suites vertes, `suivi.md` à jour
