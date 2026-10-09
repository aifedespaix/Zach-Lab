# L3 — Cadre d'application et démarrage (`defineApp` + `<SuiteApp>`)

**Taille** : L · **Dépend de** : L1, L2 · **Fonctionnalités** : F01–F07 · **Décisions** : D10, D11, D16

## Objectif
Faire disparaître le câblage dupliqué de `App.tsx` : thème, raccourcis, mises à jour, écran de chargement, palette, réglages
standard, bandeaux. `apps/base/src/App.tsx` tombe à ~15 lignes.

## À lire
- `apps/base/src/App.tsx`, `apps/zachart-maths/src/App.tsx` (l. 56–115, 174–297), `apps/zachart-mentale/src/App.tsx` (l. 88–135, 244–250, 409–500)
- `apps/zachart-maths/src/AnimatedLogo.tsx` + CSS `.animated-logo-*` dans `apps/zachart-maths/src/index.css`
- `apps/zachart-mentale/src/components/AnimatedLogo.tsx` + son CSS (`index.css`), `ClosingSyncScreen.tsx` (reste à l'app)
- `apps/zachart-mentale/src/components/settings/SettingsDialog.tsx` (le modèle de fusion panneaux/sources)
- `packages/shared/src/shell/{AppShell,BootScreen}.tsx`, `settings/*`, `update/*`, `theme/*`
- `apps/zachart-mentale/src/index.css` (`.status-banner`)

## Chantier 2 — extraction
1. **`@suite/shared/app`** (nouveau) :
   - `defineApp(config)` → objet inerte (id, nom, marque, boot, catalogue, panneaux, barre, réglages, `storage`).
   - `<SuiteApp app left right toolbarItems overlays>` : `useThemeDomSync`, `useGlobalShortcuts` (avec options de l'app : `isSuspended`, `canvasSelector`),
     init du store de raccourcis, `useAppUpdater`, `TooltipProvider`, palette, `SettingsDialog`, `UpdateReadyBanner`, `AppBoot`, `StatusBannerStack`,
     commandes standard `app.palette`, `app.settings`, `app.shortcuts`, `app.toggleTheme`.
   - `useAppStatus()` : pile de bandeaux (`push({ id, kind: 'error'|'info', text, dismiss })`) ; la bannière de MàJ y est un cas.
2. **`@suite/shared/shell`** : `AppBoot` (BootScreen + marque + plancher `floorMs`), `AnimatedMark` (logo : 4 points + 3 tracés, **forme et couleurs en config** :
   `points`, `segments`, `colors`, `mode: 'draw-fade' | 'draw-pulse'`) avec son CSS dans `theme.css`, `StatusBanner`.
3. **`@suite/shared/theme`** : `ThemeToggle` (bouton) + `useToggleTheme()` (origine = événement souris si fourni, sinon haut-centre).
4. **`@suite/shared/settings`** : `standardSettings({ shortcuts, updates, appearance })` → `{ panels, sources }` ; `mergeSettings(standard, app)`.
   Le panneau « Raccourcis » et le panneau « Mises à jour » viennent de là ; **Apparence** commun est rempli aux lots L5.
5. **`apps/base`** : `app.config.ts` + `App.tsx` ≈ 15 l. + `TextDocument` provisoire (la `<textarea>` simple, branchée plus tard au L6).
6. `scripts/new-app.mjs` : n'a plus qu'une chaîne à renommer (`id: 'base'` dans `app.config.ts`) ; `new-app.test.mjs` suit.

## Chantier 3 — migration
- **Maths** : `App.tsx` ne garde que ses éléments propres (arbre, plan, zone de travail, cours, dialogues de correction). Supprimer `AnimatedLogo.tsx` et son CSS (→ `AnimatedMark` avec
  la marque M). `BOOT_FLOOR_MS` supprimé (config). Les `useCommand('app.settings'…)` et le bloc `SettingsDialog` partent.
- **Mentale** : idem pour `App.tsx` (l. 121–135 câblage, 244–250 plancher, 467–476 écran de chargement), `components/AnimatedLogo.tsx` (marque Z) ; `settings/SettingsDialog.tsx` utilise
  `standardSettings` + ses 3 panneaux propres. `.status-banner` → `StatusBanner`. `ClosingSyncScreen` reste à l'app (slot `overlays`).
- Les `readme`/commentaires qui décrivent `App.tsx` comme « point de départ de toute app » sont retirés.

## Tests
- `describeAppContract` : activer (a) l'écran de chargement disparaît après le plancher, (b) `app.toggleTheme` bascule le thème, (c) les panneaux Raccourcis et Mises à jour existent.
- Tests de `AnimatedMark` (rendu, modes), `StatusBanner` (ordre, fermeture), `standardSettings` (fusion).
- Les tests d'`App` existants des 3 apps restent verts (`App.test.tsx`).

## Pièges
- `useGlobalShortcuts` de Mentale reçoit des options (quiz suspendu, sélecteur du canvas) : elles passent par `app.shortcuts` (config).
- Garder l'ordre d'initialisation des stores de Mentale (`useQuizSettingsStore.init()`, `useAppearanceSettingsStore.init()`, `useSyncStore.init()`) : hook `app.onReady`.
- Le logo : vérifier visuellement (S2 si dispo) que les animations restent identiques ; les noms de classes CSS changent.

## Critères d'achèvement
- [ ] `apps/base/src/App.tsx` ≤ 20 lignes, sans `useState`/`useEffect`
- [ ] `AnimatedLogo` dupliqué supprimé dans les deux apps
- [ ] `new-app` régénéré et testé avec une seule chaîne
- [ ] CLAUDE.md : « Démarrage » + « `apps/base` »
- [ ] Suites vertes, mesure `measure:sharing` consignée
