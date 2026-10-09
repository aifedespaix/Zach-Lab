# 09 — Non-régression

## 1. État de référence (relevé le 2026-10-09, avant tout changement, sur `49138f2`)

| Vérification | Commande | Résultat |
|---|---|---|
| Tests `@suite/shared` | `bun run test` | 46 fichiers, **554** tests ✅ |
| Tests `base` | idem | 1 fichier, **10** tests ✅ |
| Tests `zachart-maths` | idem | 56 fichiers, **647** tests ✅ |
| Tests `zachart-mentale` | idem | 151 fichiers, **2 336** tests ✅ |
| Tests admin web | `bun run test:admin` | 9 fichiers, **179** tests ✅ |
| Tests scripts | `bun run test:scripts` | **89** tests ✅ |
| Types | `bunx tsc --noEmit -p packages/shared \| apps/base \| apps/zachart-maths \| apps/zachart-mentale` | 0 erreur ✅ |
| Rust | `cargo test --workspace` | **non exécutable dans l'environnement du chantier 1** (la compilation de `gdk-sys` demande les bibliothèques GTK, absentes du conteneur). Il est exécuté par la CI (`.github/workflows/build.yml`, 3 systèmes). Les lots qui touchent Rust (L6 pour l'événement d'ouverture, L10) s'appuient sur la CI et sur une vérification manuelle Windows. |

Total : **3 547** tests dans les workspaces (shared 554 + base 10 + Maths 647 + Mentale 2 336), **3 815** avec l'admin (179) et les scripts (89).
Règle : **le nombre de tests ne baisse jamais** sans que le lot l'explique (test déplacé vers `shared` = comptabilisé ailleurs).
`suivi.md` consigne le décompte après chaque lot.

> Rappel d'installation : `bun install --frozen-lockfile` (≈ 4 s) puis `bun run test`. Le projet n'avait pas de
> `node_modules` dans l'environnement ; il faut les installer au début de chaque session.

## 2. Règles de migration d'un composant

1. **Déplacer, ne pas réécrire** : le fichier de test d'un composant qui part dans `shared` part avec lui
   (`git mv`), assertions intactes. On adapte le *harnais* (adaptateur factice, config) mais pas ce qui est
   vérifié. Une assertion supprimée ou assouplie est notée dans `suivi.md` avec la raison.
2. **Un test rouge n'est jamais « corrigé » en baissant l'attente** avant d'avoir compris si c'est une régression.
3. Ne jamais skipper/désactiver/mettre en quarantaine un test pour passer au vert (règle du dépôt).
4. **Strangler** : ancien et nouveau chemin coexistent le temps d'un commit au plus ; l'ancien est supprimé dans
   le même lot.
5. Un commit = une étape verte (`bun run test` du workspace touché + `tsc --noEmit` + boundary).
6. Les tests de la ligne « Pièges » de chaque lot (renommages pendant l'édition, ordre d'init, etc.) sont écrits
   **avant** de toucher au code concerné.
7. **Compatibilité des données** : aucune clé `localStorage`, aucun fichier de config, aucun format de fichier
   utilisateur ne change de nom ou de forme sans lecture rétro-compatible testée (voir README règle 5).

## 3. Filet par zone (ce qui doit rester vrai)

### Barre de gauche
- Recherche : filtre par nom, Échap efface et rend le clavier ; chapitres/dossiers correspondants forcés ouverts sans toucher à l'état replié réel (Maths) ; filtre par type (Mentale).
- Créer un dossier / un fichier ; renommer (menu, double-clic) ; dupliquer ; déplacer (glisser, « Déplacer vers ») ; supprimer avec confirmation ; replier tout.
- Glisser-déposer : seuil 5 px, dépli au survol 600 ms, Échap/blur annule, le clic après un vrai glisser est avalé une fois.
- Replier le panneau : raccourci `Mod+B` replie **et** déplie ; le focus revient au champ de recherche après un dépli demandé au clavier ; état mémorisé ; largeur mémorisée.
- Rail : libellé vertical lisible, bouton « déplier » en bas.

### Barre du haut / zone centrale
- *Fermer* / *Nouveau* et *Annuler* / *Rétablir* présents, au même endroit, activés selon l'état.
- La barre ne déborde jamais : 600 px, 900 px, 1 400 px de large ; rien ne se chevauche, tout reste accessible via « … ».
- Zoom 50→150 % par pas de 10 ; « % » cliquable remet 100 ; infobulles, menus et dialogues restent collés à leur déclencheur à tous les zooms.
- Autosave : une frappe est sur disque ≤ 600 ms plus tard ; changer de fichier / fermer le fichier / fermer la fenêtre enregistre d'abord.
- Annuler/rétablir : regroupement des frappes (700 ms), plafond 200, une nouvelle modification vide le rétablissement.
- Écran sans fichier : logo, consigne, récents (10 max, temps relatif, fichiers disparus masqués).

### Barre de droite
- Pastilles allumées/éteintes ; allumer déplie le panneau ; tout éteindre le replie ; l'onglet actif de la moitié basse est mémorisé.
- Mentale : les fiches s'ouvrent à côté de la carte, le panneau est masqué pendant un quiz et retrouve son état ensuite.

### Transversal
- Tous les raccourcis par défaut existants se comportent comme avant ; un `shortcuts.json` d'avant le chantier est relu (aliases).
- Thème : bascule avec la transition circulaire, mémorisé.
- Palette `Mod+K` : les mêmes commandes qu'avant, avec leurs libellés.
- Mises à jour : bannière, section de réglages.
- Réglages : aperçu en direct, Enregistrer / Annuler / rétablir (sources).

## 4. Parcours manuels (L11, et après chaque lot qui touche l'UI)

À dérouler par l'utilisateur (ou en captures si le spike S2 le permet) dans **base, Zach'Math, Zachar't Mentale**, à 100 % puis 130 % :
1. Lancer ; l'écran de chargement apparaît puis disparaît.
2. Créer un fichier ; écrire ; l'état « Enregistré » apparaît ; fermer ; le rouvrir depuis les récents.
3. Créer un dossier, un sous-dossier (apps qui le permettent) ; renommer ; déplacer par glisser-déposer ; supprimer.
4. Annuler ×5, rétablir ×5.
5. Replier la barre gauche au raccourci, puis la droite ; relancer l'app : l'état est retrouvé.
6. Réduire la fenêtre à 700 px de large : la barre se range dans « … ».
7. Basculer le thème ; changer la police ; zoomer à 50 % et à 150 % ; ouvrir un menu contextuel et une infobulle.
8. Ouvrir les réglages, changer un raccourci, relancer : le raccourci est gardé.
9. Maths : exercice → corrigé → « à revoir » → fiche suivante ; Mentale : créer une carte, ouvrir sa fiche, lancer un quiz, le terminer.

## 5. Captures (optionnel, spike S2)

Si le spike S2 conclut que c'est faisable : `scripts/baseline-shots.mjs` photographie 6 écrans par app avant le chantier
(état de référence versionné **hors dépôt**, ex. `chantier/captures/` ignoré) puis après chaque lot ; la comparaison est visuelle,
pas pixel-parfaite (les polices et l'anti-crénelage varient).
