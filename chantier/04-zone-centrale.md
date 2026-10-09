# 04 — Zone centrale (barre du haut, vue, cycle de vie d'un fichier)

Ce que la demande veut : le zoom (avec la correction de position des infobulles), annuler/rétablir,
créer un fichier / fermer le fichier, « et si tu vois d'autres points… ». Plus : **sauvegarder
l'organisation** (zones) pour que, par exemple, *Fermer* soit toujours au même endroit.

## 1. La barre du haut

| | Maths | Mentale |
|---|---|---|
| Composant | `OverflowToolbar` (items `{id, node, menu, priority}`), construit dans `App.tsx` | `AppToolbar.tsx` (520 l.), flex fixe, pas de repli adaptatif |
| Ordre, de gauche à droite | Fermer **ou** Nouveau · Annuler · Rétablir · Palette · « Suivant à corriger » · Revue · pastilles de panneaux · couleurs · condensé · zoom · thème · réglages | menu « Fichier » · Fermer · Nouveau · Annuler · Rétablir · carte flottante · exporter · révéler · quiz · cadenas · palette · … · thème · réglages (menu) ; puis le nom du fichier |
| Réglages | bouton direct | menu déroulant (réglages, raccourcis, bascules de panneaux, thème) |
| Thème | origine de la transition = haut-centre | origine = coordonnées du clic |

### Conclusion
Maths a le **bon mécanisme** (la barre ne déborde jamais, avec priorités) ; Mentale a la **bonne
idée d'organisation** (un menu « Fichier » avec libellés et raccourcis pour les actions occasionnelles,
le nom du fichier toujours visible). On garde les deux.

### Cible : `ToolbarZones`
Une barre à zones nommées, dans un ordre **imposé par le commun** ; une app ne fait que *poser* ses
items dans une zone avec une priorité :

```
[ fichier ]  [ édition ]  [ titre (flexible) ]  [ app ]  [ panneaux ]  [ vue ]  [ système ]
  Nouveau/    Annuler/     nom du fichier +      items     pastilles     zoom,     palette,
  Fermer/     Rétablir     état d'enregistr.     propres   des panneaux  densité   thème,
  menu Fichier                                   à l'app   (cf. droite)  …         réglages
```

- La zone *fichier* et la zone *système* ont les priorités les plus hautes : elles sont les dernières à
  passer dans le menu « … ». Fermer / Nouveau est donc toujours au même endroit, dans toutes les apps.
- *Nouveau* et *Fermer* : un seul emplacement. Fichier ouvert → *Fermer* ; sinon → *Nouveau* (comportement
  Maths) ; le menu « Fichier » (Mentale) liste tout (Nouveau, Dossier, Dupliquer, Renommer, Exporter, Fermer,
  Supprimer…) avec raccourcis. Une app sans menu fichier n'a que les deux boutons.
- Le titre (zone flexible) absorbe le rétrécissement avant tout item (`minWidth: 0` + ellipse), comme
  dans Mentale.
- Mentale perd son menu déroulant de réglages (la bascule des panneaux passe dans la zone *panneaux*) :
  `app.shortcuts` reste une commande (palette + raccourci) qui ouvre le dialogue sur l'onglet Raccourcis.

## 2. Zoom d'interface (et correction des infobulles)

État : `apps/zachart-maths/src/exercises/useZoom.ts` (store, 50–150 %, pas 10, clé `zachart-maths:zoom`),
l'effet dans `App.tsx` (`style.zoom`, `--app-zoom`, `--app-height`), et la règle CSS
`[data-radix-popper-content-wrapper]` dans `index.css` (annule puis rétablit le zoom pour que Radix
pose les popovers au bon endroit), plus le correctif `display: flex` de l'enveloppe (`e019bf4`).

Pourquoi c'est fragile : `zoom` est une propriété CSS non standard dans son comportement de mise en
page ; chaque nouvelle surface flottante (menu, popover, tooltip, toast, dialogue) doit la respecter,
et tout code qui lit `getBoundingClientRect` (React Flow !) doit être testé sous zoom.

**Spike S1 (lot L0)** — comparer deux implémentations avant de figer l'API :

| | A. `zoom` CSS (existant) | B. Zoom natif de la webview (`getCurrentWebview().setZoom(f)`) |
|---|---|---|
| Popovers / canvas | nécessite des rustines | gérés par le navigateur, comme `Ctrl +/-` |
| Permission Tauri | aucune | `core:webview:allow-set-webview-zoom` à ajouter aux capacités |
| Tests jsdom | OK | à simuler (un port) |
| Mode navigateur (dev, tests) | OK | repli sur A |

Recommandation à valider par le spike : **B quand Tauri est présent, A en repli**, derrière une seule
API `useUiZoom()` ; ce qui supprime la règle CSS popover côté app. Quelle que soit l'issue, l'API publique
ne change pas : `useUiZoom()` + `ZoomControls` + commandes `view.zoomIn/Out/Reset`.

**Conflit de raccourcis** : `Mod+Plus/Minus/0` sont aujourd'hui, côté Mentale, le zoom du canvas. Voir D09 :
le zoom d'interface prend ces raccourcis (Maths, et c'est le comportement attendu d'un navigateur) ;
le zoom du canvas devient `canvas.zoomIn/Out/Reset/fit` avec `Mod+Alt+Plus/Minus/0` et la molette.

## 3. Cycle de vie d'un fichier (`@suite/shared/files`)

Aujourd'hui, la même mécanique est écrite deux fois :

| Brique | Maths | Mentale |
|---|---|---|
| Chargement + validation | `useExerciseStore` / `useOpenExercise` | `App.tsx` (effet de ~70 lignes : chargement → validation → armement de l'autosave, échec = retour au fichier précédent) |
| Autosave | `AUTOSAVE_DELAY_MS = 600`, `flush` avant changement de fiche | `useAutosave` (500 ms, `flush`, `dirtyRef`, `onError`) |
| Historique | clichés de la fiche, regroupement 700 ms, 200 pas | `past/present/future` (`state/history.ts`), pas de plafond |
| Garde de changement/fermeture | — (à confirmer) | `useUnsavedChangesGuard` (+ synchro de fermeture) |
| Titre de fenêtre | — | `useWindowTitle` |
| Ouvrir avec / dépôt | — | `useLaunchFile` (+ Rust), `useFileDropZone` |
| Récents + session | `recentFiles.ts` (`zachart-maths:session`) | `sessionState.ts` (`zachart-mentale:session`) |
| Écran sans fichier | logo + récents | logo + consigne + récents |
| Dialogues d'échec | — | `SaveFailedDialog`, `CorruptedMapDialog`, `ReadOnlyMapDialog` |

### Cible : une *session de fichier* générique
`useFileSession<T>(port, options)` orchestre : ouverture gardée, chargement → validation → armement de
l'autosave, échec = retour au fichier précédent, fermeture, récents, session, titre de fenêtre, états
`idle | loading | ready | saving | error`. L'app fournit un **port** :

```
DocumentPort<T> { read(path): Promise<T | null>; write(path, doc: T): Promise<void>;
                  validate?(raw): { ok: true; doc: T } | { ok: false; issues: unknown[] };
                  repair?(raw): T }
```

et un **moteur d'historique** `createHistoryStore<T>({ limit: 200, groupMs: 700 })` (version Maths) que
l'app alimente avec `commit(next, groupKey?)`. Les commandes `edit.undo/redo`, `file.new/close/save`
sont enregistrées une fois, dans le commun.

### Ce qui reste à l'app
Le format (`Sheet`, `Card[]`), la validation/réparation, ce qu'est « nouveau » (le formulaire du
dialogue), les droits d'édition, la synchronisation. Tout passe par le port et des slots.

## 4. Zone de travail de `base` : la zone de texte

`base` doit montrer le cycle complet avec presque rien : un `TextDocument` (une `<textarea>` sur un
fichier `.txt` du dossier `Documents/Base/`), branché sur `useFileSession`, l'historique, l'autosave,
le correcteur orthographique (lot L9). C'est aussi le **banc d'essai** du test de conformité.

## 5. Autres points repérés dans la zone centrale

- Bandeaux d'état (chargement raté, dépôt refusé, MàJ prête) : Mentale empile `loadError`, `dropError`,
  `UpdateReadyBanner` avec une exclusion mutuelle codée à la main → `StatusBanner` + une pile ordonnée.
- Écran « Ouverture de … » pendant le chargement : à garder (évite le flash d'écran vide).
- Surcouche « Déposez … ici » : composant commun, texte en config.
- Accessibilité : `role="status"`/`alert` cohérents, focus rendu au fichier après fermeture d'un dialogue.
