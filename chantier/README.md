# Chantier « Harmonie » — mettre la suite en commun

> Objectif : que `apps/base` ne contienne plus que **sa configuration et une zone de texte**, et que
> tout le reste (≥ 95 % de ce qu'elle exécute) vienne de `packages/shared`. Zach'Math et Zachar't
> Mentale migrent ensuite sur ce commun, sans régression et, quand deux versions divergent, en gardant
> la meilleure des deux (UX d'abord).

Ce dossier est le **chantier 1 : l'analyse**. Il est la seule source de vérité des chantiers 2 et 3.
Il ne modifie aucun code de l'application.

## Les trois chantiers

| # | Chantier | Produit | Où |
|---|---|---|---|
| 1 | **Analyse** (ce dossier) | inventaire, matrice, décisions UX, architecture cible, lots, filet de non-régression, prompts | `chantier/` |
| 2 | **Extraction** | les composants/hooks communs dans `packages/shared`, branchés dans `apps/base` | `prompts/chantier-2-extraction.md` |
| 3 | **Migration** | Zach'Math puis Zachar't Mentale n'utilisent plus que le commun | `prompts/chantier-3-migration.md` |

Les chantiers 2 et 3 se font **lot par lot** (voir « Pourquoi des lots »). Pour chaque lot : on
exécute le prompt 2 (extraction), puis le prompt 3 (migration). Les deux lisent `suivi.md` pour savoir
quel est le prochain lot, et le mettent à jour.

## Lire dans cet ordre

| Fichier | Contenu |
|---|---|
| [01-etat-des-lieux.md](01-etat-des-lieux.md) | Les chiffres, ce qui est déjà partagé, les doublons trouvés |
| [02-matrice-fonctionnalites.md](02-matrice-fonctionnalites.md) | **La** liste : chaque fonctionnalité × base / Maths / Mentale × verdict × lot |
| [03-zone-gauche.md](03-zone-gauche.md) | Barre de gauche : arbre, recherche, repli, pied d'actions |
| [04-zone-centrale.md](04-zone-centrale.md) | Barre du haut, zoom, annuler/rétablir, cycle de vie d'un fichier |
| [05-zone-droite.md](05-zone-droite.md) | Panneau de droite : onglets, pastilles, repli |
| [06-transversal.md](06-transversal.md) | Commandes, persistance, réglages, démarrage, Rust, scripts, tests |
| [07-decisions-ux.md](07-decisions-ux.md) | Les arbitrages (une recommandation chacun) — **à valider** |
| [08-architecture-cible.md](08-architecture-cible.md) | Les modules de `shared`, leurs API (config / slots / ports), `base` cible |
| [09-non-regression.md](09-non-regression.md) | État initial des tests, checklist par écran, règles de migration |
| [suivi.md](suivi.md) | Tableau d'avancement des lots (lu et mis à jour par les prompts) |
| [lots/](lots/) | Un fichier par lot : objectif, fichiers à lire, à créer, à modifier, critères d'achèvement |
| [prompts/](prompts/) | Les deux prompts génériques (extraction, migration) |

## Pourquoi des lots (et pas « tout extraire, puis tout migrer »)

Extraire dans `base` sans consommateur réel, c'est écrire une API dans le vide : on découvre à la fin
qu'elle ne convient pas à Mentale (30 000 lignes). Chaque lot extrait **et** migre : le commun est donc
toujours éprouvé par au moins deux vraies apps avant d'être figé, et chaque lot laisse le dépôt
vert et livrable. L'ordre des lots suit les dépendances (`lots/` + `suivi.md`).

## Règles du chantier (à respecter par chaque lot)

1. **Règle de deux** : on ne met en commun que ce qui a deux usages réels (ou que l'utilisateur a
   explicitement demandé, voir `07-decisions-ux.md`). Pas de généralisation spéculative.
2. **Config / slots / ports** : une différence entre apps s'exprime par une *donnée* (libellés, clés,
   bornes, activations), un *slot* (rendu) ou un *port* (entrées/sorties : disque, réseau). Jamais par un
   `if (app === …)` dans `shared`. Un composant partagé dépassant ~15 props est le signe qu'il faut
   le découper (hook headless + composants composés).
3. **`shared` n'importe jamais une app** (`packages/shared/src/boundary.test.ts`) ; entrées publiques
   uniquement ; imports relatifs dans `shared` ; `@source` Tailwind dans chaque CSS d'app.
4. **Non-régression d'abord** : la suite de tests de chaque app reste verte à chaque commit. Les tests
   d'un composant qui part dans `shared` partent **avec lui**, assertions intactes (voir
   `09-non-regression.md`).
5. **Pas de renommage silencieux d'identifiant persistant** : un id de commande renommé garde un
   *alias* (les raccourcis personnalisés des élèves sont stockés par id et seraient perdus, voir
   `06-transversal.md` §Commandes). Idem pour les clés `localStorage` et les formats de fichiers.
6. **Les façades temporaires meurent dans le lot qui les crée** (ou au plus tard au lot L11). Pas
   d'`export … from` de transition qui survit.
7. **Documentation** : chaque lot met à jour `CLAUDE.md` (section concernée), `suivi.md`, et ajoute une
   ligne au journal de `07-decisions-ux.md` s'il tranche quelque chose.
8. **Git** : travail sur la branche désignée de la session, un commit par étape logique, jamais de
   `git add -A`, pas de PR sans demande. Le dossier `.cours/` et `.cartes-mentales/` ne se touche pas.

## Définition mesurable des « 95 % »

`base` est réussie quand :
- `apps/base/src` (hors tests) ≤ **150 lignes** : config d'app + la zone de texte ;
- `apps/base/src/App.tsx` ne contient **aucune logique** (ni `useState`, ni `useEffect`, ni store) ;
- toutes les fonctionnalités de la matrice au verdict « commun » sont utilisables dans `base` ;
- `describeAppContract(App)` (le test de conformité commun, lot L0) passe sur `base`, Maths et Mentale ;
- `scripts/measure-sharing.mjs` (lot L0) donne ≥ 95 % : part des lignes *exécutées* par `base` qui
  viennent de `packages/shared`.

## Commandes utiles

```
bun run test            # toutes les apps (état de référence : voir 09-non-regression.md)
bun run test:admin      # l'admin web de Mentale
bun run test:scripts    # scripts du dépôt
cargo test --workspace  # côté Rust
bunx tsc --noEmit -p apps/<app>   # types
```
