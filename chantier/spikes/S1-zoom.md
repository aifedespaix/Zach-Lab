# S1 — Zoom : `style.zoom` (CSS) ou `getCurrentWebview().setZoom` (natif) ?

**Date** : 2026-10-09 · **Conclusion** : **voie A (CSS) retenue** ; ses rustines passent dans `shared` (lot L5).

## Ce qui a été vérifié, et ce qui ne l'a pas été

Le conteneur du chantier n'a ni Windows ni WebView2 : seul Chromium est disponible. Le zoom natif de Tauri
(`setZoom`) n'a donc **pas pu être mesuré** sur la cible réelle, et un test dans Chromium ne dirait rien de
WebView2. Le prototype comparatif demandé n'a pas été écrit pour cette raison : il aurait mesuré le mauvais moteur.

Ce qui est établi :

- **Voie A, en production.** Zach'Math zoome avec `documentElement.style.zoom` (50–150 %, pas de 10) depuis des
  versions publiées ; les rustines nécessaires sont connues et couvertes par des tests :
  - `[data-radix-popper-content-wrapper] { zoom: calc(1 / var(--app-zoom)) }` et son enfant `zoom: var(--app-zoom)` :
    Radix place ses popovers (infobulle, menu, menu contextuel) avec des coordonnées d'écran que `zoom` multiplierait
    une seconde fois (`apps/zachart-maths/src/index.css`) ;
  - `--app-height: calc(100vh / zoom)` : `vh` n'est pas mis à l'échelle par `zoom` ;
  - le dialogue est positionné par le CSS (`fixed` + `translate`), il suit le zoom sans rustine.
- **Voie B (native), non éprouvée** : elle supprimerait les deux rustines (le moteur zoome tout, `vh` compris, et
  Radix lit des coordonnées déjà zoomées), mais demande `core:webview:allow-set-webview-zoom` dans chaque
  `capabilities/*.json`, ne se prévisualise pas dans un navigateur (ni dans les tests jsdom, ni dans les captures S2),
  et son comportement dans WebView2 (interaction avec la mise à l'échelle Windows, restauration au lancement avant le
  premier rendu) n'est pas vérifié.
- **React Flow (Mentale)** : il convertit les coordonnées souris avec `getBoundingClientRect`, que `zoom` CSS fausse
  selon la version de Chromium ; c'est le seul risque propre à la voie A. À tester à la main dans Mentale au lot L5
  (déplacer un nœud, relier deux cartes à 50 % et 150 %) avant de lui donner le zoom.

## Recommandation pour D09

Retenir **la voie A** : un hook `useZoom` et une règle CSS dans `@suite/shared/theme.css`, déjà éprouvés et testables
sans Tauri. Garder la voie B comme **expérience ultérieure** : si une session sous Windows montre qu'elle est fiable,
on remplace l'implémentation derrière la même API (`useZoom`), sans toucher aux apps.

Repli : si le zoom CSS posait un problème dans React Flow, Mentale garde `zoom` désactivé (option de configuration du
hook) jusqu'à ce que la voie B soit validée.
