# Chantier « Synchro » — une synchronisation commune à toute la suite

> Objectif : une seule synchronisation, écrite une fois dans `packages/shared`, que chaque app
> (Mentale, Maths, base, les suivantes) branche en déclarant son format de fichier. Plus simple que
> l'existante (`apps/zachart-mentale/src/sync/`, ~6 500 lignes propres à Mentale), avec un modèle de
> conflit unique : **le doublon marqué**.

Ce dossier est le **chantier d'analyse** : il ne modifie aucun code. Il est la source de vérité des lots
d'implémentation (`06-lots.md`, `suivi.md`). Il vient APRÈS le chantier « Harmonie » (`../README.md`) :
il s'appuie sur `@suite/shared/storage`, `app` et `commands`.

## Lire dans cet ordre

| Fichier | Contenu |
|---|---|
| [01-principes-et-modele.md](01-principes-et-modele.md) | Les décisions actées, le modèle de données (fichier, révision, copie, corbeille) |
| [02-conflits.md](02-conflits.md) | La table de TOUS les cas de conflit et la réponse à chacun ; le doublon ; l'écran de résolution |
| [03-prof-et-eleves.md](03-prof-et-eleves.md) | Comptes, destinataires, copies par élève, droits, suppression asymétrique, vue du prof |
| [04-creation-par-ia.md](04-creation-par-ia.md) | La modale « fichier vierge / générer par IA », le pré-prompt, le validateur |
| [05-architecture.md](05-architecture.md) | `@suite/shared/sync` : moteur pur, ports, adaptateur PocketBase, UI ; schéma serveur ; ce qui disparaît de Mentale |
| [06-lots.md](06-lots.md) | Le découpage en lots (S0…S8), dépendances, critères d'achèvement |
| [suivi.md](suivi.md) | Tableau d'avancement (à mettre à jour lot par lot) |

## Décisions déjà prises avec l'utilisateur (ne pas les rouvrir)

1. **Un seul serveur PocketBase** pour toutes les apps (une collection de fichiers avec un champ `app`).
2. **Synchro par fichier entier** (pas de fusion carte par carte / exercice par exercice).
3. **Conflit = doublon marqué**, fusion manuelle par l'utilisateur à partir du doublon ; le doublon
   renommé cesse d'être un doublon. Jamais de suppression automatique.
4. **Chaque app a son dossier de synchro.** Le prof peut y déposer des fichiers à la main : ils partent
   à l'ouverture de l'app ou au clic sur « Synchroniser ».
5. **Création par IA depuis l'app** (prof authentifié) : modale vierge / IA, pré-prompt copiable,
   zone de collage, validateur (voir 04).
6. **Le prof choisit les élèves cibles** de chaque fichier ; chaque élève reçoit **sa propre copie**.
   Le prof voit toutes les copies et filtre par élève.
7. **Élève et prof ont la main complète** sur leurs fichiers. Seule asymétrie : le prof peut annuler la
   suppression d'un fichier par un élève, l'inverse n'existe pas.
8. Le prof s'inscrit sur le site, y crée ses élèves (identifiants), et les donne aux élèves — ou
   configure lui-même leurs machines.

## Ce qui existe déjà et qu'on réutilise

- `file_id` stable par fichier, `author`, `hash`, `path` (schéma `cartes_mentales`).
- Le concept de copie liée (`copyLink`, « Créer une copie ») et `sync_conflicts` : ils deviennent le
  doublon marqué de ce chantier (voir 02, « migration de l'existant »).
- `permissions.ts` (`canReorder`, `canClassify`, `canEditContent`) : l'idée « auteur ou prof » reste.
- `pocketbase-schema.mjs` : le schéma serveur reste de la donnée, on l'étend.
