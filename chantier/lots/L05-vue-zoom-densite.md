# L5 — Vue : zoom d'interface, correction des popovers, densité, police

**Taille** : M · **Dépend de** : L2, L3, L4, spike S1 · **Fonctionnalités** : F13–F16, F30 · **Décisions** : D09

## Objectif
Le zoom d'interface de Maths (avec sa correction des infobulles/menus) devient commun et disponible dans **toutes** les apps ; la densité et la
police rejoignent le panneau Apparence standard.

## À lire
- `apps/zachart-maths/src/exercises/{useZoom,useCompact}.ts` (+ tests `useZoom.test.ts`)
- `apps/zachart-maths/src/App.tsx` l. 82–98 (effet de zoom), l. 145–170 (item de barre zoom)
- `apps/zachart-maths/src/index.css` : règles `[data-radix-popper-content-wrapper]`
- `packages/shared/src/shell/AppShell.tsx` (hauteur `var(--app-height, 100vh)`)
- `apps/zachart-mentale/src/hooks/useAppliedFontFamily.ts`, `state/useAppearanceSettingsStore.ts`, `components/settings/AppearanceSettingsPanel.tsx`
- `apps/zachart-mentale/src/components/MindMapCanvas.tsx` (zoom du canvas, `useReactFlow`)
- **`chantier/spikes/S1-zoom.md`** (rapport du spike du L0 : voie A ou B)

## Chantier 2 — extraction (`@suite/shared/view`, nouveau)
- `useUiZoom()` : store persisté (clé `<id>:zoom`, 50–150, pas 10), `zoomIn/zoomOut/reset`, applique l'effet décidé par S1 :
  - voie B : `getCurrentWebview().setZoom(percent/100)` (port `ZoomDriver` pour les tests), repli CSS hors Tauri ;
  - voie A : `documentElement.style.zoom`, `--app-zoom`, `--app-height`, et le CSS popover **dans `theme.css`** (plus dans les apps).
- `ZoomControls` (− · « 100 % » cliquable · +) pour la barre (zone `view`) ; commandes `view.zoomIn/Out/Reset` enregistrées par `<SuiteApp>`.
- `useDensity()` + `spacing(compact)` généralisé (Maths : `spacing(compact)` donne paddings/gaps de la zone centrale) ; commande `view.toggleDensity`.
- Réglage de **police** : `useFontFamily` (extrait de `useAppliedFontFamily`) ; le panneau « Apparence » standard (`standardSettings({ appearance: { font, density, zoom } })`) expose thème, police, densité, zoom.
- Capacité Tauri `core:webview:allow-set-webview-zoom` ajoutée au **socle** de capacités (voir L10) si la voie B est retenue.

## Chantier 3 — migration
- **Maths** : supprimer `useZoom.ts`, l'effet de zoom de `App.tsx`, les règles CSS popover de `index.css`, l'item zoom de la barre ; `useCompact` → `useDensity` (clé `zachart-maths:compact` conservée) ; `spacing(compact)` importé du commun.
- **Mentale** : activer le zoom d'interface (nouvelle fonctionnalité) ; vérifier le canvas sous zoom (clics, sélection, glisser, `fitView`) ; les commandes de canvas sont déjà `canvas.*` (L1). Police : `useAppliedFontFamily` → `useFontFamily`, `AppearanceSettingsPanel` garde ses niveaux de cartes et reçoit les sections communes.
- **Base** : zoom + densité + police fonctionnent d'office.

## Tests
- `useUiZoom` (bornes, pas, persistance, `ZoomDriver` factice) — reprendre `useZoom.test.ts` de Maths tel quel.
- `describeAppContract` : activer « le zoom d'interface répond (`Mod+Plus`) », « la densité bascule ».
- **Vérification visuelle obligatoire** (captures S2 si dispo, sinon manuelle documentée dans `suivi.md`) : à 50 %, 100 %, 150 % — infobulle, menu contextuel, liste déroulante, dialogue, canvas Mentale.

## Pièges
- Mentale : React Flow lit `getBoundingClientRect` → sous voie A, les coordonnées seraient fausses. C'est la raison d'être de S1.
- `100vh` : `AppShell` utilise `--app-height` ; sous voie B il redevient `100vh`.
- Un élève qui avait un zoom Maths enregistré (`zachart-maths:zoom`) le retrouve (clé inchangée).

## Critères d'achèvement
- [ ] Zéro règle CSS de popover/zoom dans les apps
- [ ] Zoom et densité disponibles dans base et Mentale
- [ ] Rapport visuel 50/100/150 % consigné
- [ ] CLAUDE.md : « Affichage » mis à jour (la section Maths « Affichage » devient une référence au commun)
- [ ] Suites vertes
