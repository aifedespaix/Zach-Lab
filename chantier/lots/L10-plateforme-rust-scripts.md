# L10 — Plateforme : Rust, capacités, scripts

**Taille** : M · **Dépend de** : L3, L5 (permission de zoom) · **Fonctionnalités** : F120–F123 · **Décisions** : D18

## Objectif
La couche native et les scripts reflètent le commun : mémoire de la fenêtre, socle de capacités vérifié, `new-app` minimal.

## À lire
- `crates/suite-tauri/src/lib.rs`, `apps/*/src-tauri/{Cargo.toml,build.rs,tauri.conf.json,capabilities/default.json,src/lib.rs}`
- `scripts/new-app.mjs`, `new-app.test.mjs`, `docs/RELEASE.md`
- `CLAUDE.md` : paragraphe « A tauri app's `src-tauri/Cargo.toml` must declare directly… »

## Chantier 2 — extraction
- `suite-tauri` : mémoire de la taille/position (`window-state` ou implémentation simple : fichier JSON dans le dossier de config, restauration avant `show()`), conservant `size_main_window_to_screen` pour le premier lancement ; tests Rust des fonctions pures (bornes, écran absent).
- `capabilities/baseline.json` (ou constante) : liste des permissions du socle ; `scripts/check-capabilities.mjs` lit `apps/*/src-tauri/capabilities/default.json` et échoue si une app n'inclut pas tout le socle (`core:default`, `core:window:allow-destroy`, `opener:default`, `dialog:default`, `updater:default`, `fs:allow-*` de base, + `core:webview:allow-set-webview-zoom` si voie B) ; les **scopes `fs`** restent propres à chaque app. Commande `bun run check:capabilities`, appelée par `test:scripts`.
- `new-app.mjs` : une seule chaîne à renommer (`app.config.ts`) ; documenter l'alias `@dictionary-fr` et les `@source` Tailwind ; `new-app.test.mjs` mis à jour ; le test lance `bun run check:capabilities` sur l'app générée.
- Documentation : `docs/RELEASE.md` inchangé sauf mention de la mémoire de fenêtre.

## Chantier 3 — migration
- **Maths** : `capabilities/default.json` complété du socle (opener, dialog, stat, copy-file…) **en gardant** son scope `fs` étroit (`$DOCUMENT/Zach'Math/**` + `$APPCONFIG/**`) ; `Cargo.toml` : déclarer directement chaque plugin cité par la capacité.
- **Mentale** : socle déjà couvert ; vérifier qu'aucune permission n'est en trop (principe du moindre droit : ne pas élargir).
- **Base** : scope `fs` limité à `$DOCUMENT/Base/**` et `$APPCONFIG/**`.

## Tests
`cargo test --workspace`, `bun run test:scripts`, `bun run check:capabilities`. Lancement manuel d'une app (Windows) pour la mémoire de fenêtre : consigner dans `suivi.md`.

## Critères d'achèvement
- [ ] Les trois apps passent `check:capabilities`
- [ ] Taille/position de la fenêtre retrouvées (vérifiées à la main sur Windows)
- [ ] `new-app` testé de bout en bout
- [ ] CLAUDE.md : paragraphe Tauri + « Commandes » mis à jour
