# L0 — Socle et filet de sécurité

**Taille** : M · **Dépend de** : rien · **Fonctionnalités** : F124, F125 (+ décisions de technique S1, S2)
**Décisions** : aucune obligatoire (S1 éclaire D09).

## Objectif
Poser ce qui rend tous les lots suivants sûrs et mesurables, **sans changer un pixel de l'app** :
l'état de référence, le test de conformité (vide au départ, rempli lot après lot), la mesure des 95 %,
et deux spikes qui lèvent les deux plus gros risques techniques.

## À lire
- `chantier/09-non-regression.md` (état de référence déjà relevé)
- `packages/shared/src/boundary.test.ts`, `apps/*/src/boundary.test.ts`
- `apps/base/src/App.test.tsx`, `apps/base/vitest.config.ts`
- `apps/zachart-maths/src/exercises/memoryFs.ts`, `fsPort.ts`
- `apps/zachart-maths/src/exercises/useZoom.ts` + effet de zoom dans `apps/zachart-maths/src/App.tsx` + règle `[data-radix-popper-content-wrapper]` de `apps/zachart-maths/src/index.css`

## Chantier 2 — créer
1. **`packages/shared/src/testing/`** (nouvelle entrée publique `@suite/shared/testing`, jamais importée par du code de production) :
   - `describeAppContract(renderApp, options)` : une suite **déclarative** de vérifications ; chaque lot ajoute les siennes.
     Au départ : (a) l'app se monte sans erreur, (b) elle expose `app.palette`, `app.settings`, `app.toggleTheme`
     (via alias possible) dans le catalogue, (c) la palette s'ouvre au raccourci. Les vérifications des lots
     suivants sont ajoutées *désactivées* (`skip`) avec le numéro du lot, et activées par le lot concerné.
   - `memoryFs` généralisé (copie de `maths/exercises/memoryFs.ts` derrière l'interface `Fs` du plan, voir 08).
2. **`scripts/measure-sharing.mjs`** (+ `measure-sharing.test.mjs`) : part des lignes **exécutées par `base`** qui viennent de
   `packages/shared`. Méthode simple et reproductible : partir de `apps/base/src/main.tsx`, suivre les imports
   (résolution des alias `@suite/shared/*` vers les entrées publiques), additionner les lignes non vides hors tests des
   fichiers atteints, répartir `shared` / `base`. Sortie : tableau + pourcentage. Commande `bun run measure:sharing`.
3. **Spike S1 — zoom** (`chantier/spikes/S1-zoom.md`, 1 page) : prototype jetable (hors `src/` des apps, ex. `scripts/spikes/`) qui
   compare `style.zoom` et `getCurrentWebview().setZoom` sur : une infobulle, un menu Radix, un dialogue, un `ContextMenu` et
   une page React Flow. Conclusion écrite : quelle voie, quelles permissions (`core:webview:allow-set-webview-zoom`), quel repli.
   **Si le zoom natif n'est pas fiable dans WebView2, la voie A (CSS) est retenue et ses rustines passent dans `shared`.**
4. **Spike S2 — captures de référence** (`chantier/spikes/S2-captures.md`) : peut-on lancer Vite + Chromium préinstallé avec
   `@tauri-apps/api/mocks` et photographier 6 écrans par app (accueil, fichier ouvert, panneau replié, menu contextuel,
   réglages, thème sombre) ? Estimer le coût ; si faisable en ≤ ½ journée, livrer `scripts/baseline-shots.mjs`, sinon
   renoncer et le noter.

## Chantier 3 — migrer
Rien côté apps, sauf : brancher `describeAppContract` dans `apps/base`, `apps/zachart-maths`, `apps/zachart-mentale` (un fichier
`src/app.contract.test.tsx` chacun).

## Tests
`bun run test:all`, `bun run test:scripts`, `cargo test --workspace` identiques à l'état de référence, plus les nouveaux tests.

## Critères d'achèvement
- [ ] `@suite/shared/testing` publié, boundary vert (le code de production n'importe pas `testing`)
- [ ] `bun run measure:sharing` donne un chiffre pour `base` (valeur de départ consignée dans `suivi.md`)
- [ ] Rapport S1 écrit, avec la recommandation finale pour D09
- [ ] Rapport S2 écrit (et captures de référence versionnées hors dépôt si le script existe)
- [ ] Suites vertes
