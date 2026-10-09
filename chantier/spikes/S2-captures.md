# S2 — Captures de référence sans Tauri

**Date** : 2026-10-09 · **Conclusion** : **faisable, livré** — `scripts/baseline-shots.mjs`.

## Méthode
Vite (`bunx vite`, port de l'app) + le Chromium préinstallé (`/opt/pw-browsers`) piloté par Playwright
(`/opt/node-tools`, pas une dépendance du dépôt). Avant le chargement de la page, un faux
`window.__TAURI_INTERNALS__` répond « rien » à tout `invoke` (disque vide, pas de mise à jour) et
`__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener` existe : les trois apps démarrent à vide, comme à un premier lancement.
Coût réel : ≈ 40 minutes, ≈ 20 s par app.

## Usage
`node scripts/baseline-shots.mjs <base|zachart-maths|zachart-mentale>` → 6 PNG dans `chantier/captures/<app>/`
(dossier ignoré par git) : accueil, palette, réglages, panneau replié, menu contextuel, thème sombre.

## Limites
- Écran **sans fichier ouvert** seulement : pas de « fichier ouvert » (il faudrait un faux disque peuplé via `invoke`).
- Chromium, pas WebView2 : polices et anti-crénelage varient ; la comparaison est visuelle.
- « Réglages » : le bouton de Mentale ouvre un menu et non le dialogue ; « menu contextuel » est un clic droit au centre
  (menu seulement s'il y a une zone qui en a un). Les captures documentent l'état, elles ne le garantissent pas.
- Le script fixe le port de dev de chaque app (1440, 1450, 1420) et échoue si il est pris.
