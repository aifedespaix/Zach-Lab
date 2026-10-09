# 05 — Architecture cible

## Module `@suite/shared/sync`

Entrée publique unique, mêmes règles que le reste de `shared` : aucune importation d'une app, imports
relatifs en interne, sources consommées en TypeScript.

```
packages/shared/src/sync/
  engine/        moteur PUR (aucun réseau, aucun disque, aucun Tauri)
    state.ts       états d'un fichier, calcul depuis (disque, base, serveur)
    plan.ts        planSync(local[], remote[], base) → actions[]
    duplicate.ts   création du doublon (nom, métadonnées)
    guards.ts      garde « suppression de masse », faux id
  ports.ts       SyncTransport, SyncStore, SyncStateStore, Clock
  can.ts         can(action, actor, file) — LA table de droits (03)
  pocketbase/    adaptateur SyncTransport (seul endroit qui connaît PocketBase)
  run.ts         runSync(deps) : orchestre plan → exécution → reprise
  ui/            SyncStatus, ConflictBanner, ConflictDialog, TrashDialog, StudentFilter,
                 RecipientPicker, AiCreateDialog
  testing/       transport mémoire (in-memory), fabrique de scénarios
```

### Ports (comment une app se branche)

| Port | Rôle | Fourni par |
|---|---|---|
| `SyncStore` | lister / lire / écrire / renommer / supprimer les fichiers du dossier de synchro | l'app (Tauri `fs`), `createMemoryFs` en test |
| `SyncTransport` | `list(sinceRev)`, `get`, `put`, `delete`, `restore`, `listTrash`, `students()` | adaptateur PocketBase |
| `SyncStateStore` | lit/écrit `.sync-state.json` (via `readJsonConfig`/`writeJsonConfig` de `storage`) | `shared` |
| `FileFormat` | `kind`, `extension`, `readId(text)`, `withId(text, id)`, `validate(text)`, `renderPreview` | l'app |

`defineSyncApp({ id, folder, formats: FileFormat[], aiPrompts })` est un objet inerte, comme
`defineApp` ; `SuiteApp` y branche l'indicateur, la bannière de conflits et le déclenchement
(ouverture, bouton, intervalle).

### Pourquoi un moteur pur

Les cas de la table (02) sont ~19 : chacun devient un test `planSync` à trois entrées
(disque / base / serveur) sans réseau. C'est ce qui rend la logique fiable ET partageable.
`runSync` n'est qu'une boucle fine autour de `planSync` ; l'état n'est enregistré qu'après succès de
chaque fichier (reprise après interruption).

## Serveur (PocketBase, un seul)

Étendre `apps/zachart-mentale/infra/pocketbase-schema.mjs` (le schéma reste de la donnée, ce que le
script d'application lit). Le dossier `infra/` passe **à la racine** du dépôt (décision S0) : il sert maintenant toute la suite.

| Collection | Contenu |
|---|---|
| `users` (auth) | existante ; ajouter `teacher` (relation vers `users`) et `role` (`prof` / `eleve`) — `role` existe déjà |
| `files` | voir 01 ; remplace `cartes_mentales` (migration, voir lots) |
| `assets` | existante, adressage par hash |
| `sync_events` | journal existant, conservé |
| `sync_conflicts`, `folders` | à retirer après migration (le conflit est le doublon ; les dossiers sont des chemins) |

Règles de collection (écrites depuis `can.ts` quand c'est possible, sinon vérifiées par test de table) :

- lecture/écriture de ses fichiers : `owner = @request.auth.id` ;
- le prof lit/écrit les fichiers dont `owner.teacher = @request.auth.id` ;
- `restore` (effacer `deleted_at`) réservé au prof ;
- `rev` incrémenté par un hook serveur (JS PocketBase `onRecordBeforeUpdate`), jamais par le client ;
- un client ne peut pas écrire `rev`, `owner`, `deleted_*` directement.

L'incrément de `rev` côté serveur est ce qui permet de détecter le cas 4 sans comparer d'heures : le
client envoie `base_rev` avec sa modification ; si `base_rev ≠ rev` actuel, le serveur répond « conflit »
(HTTP 409) et le moteur crée le doublon.

## Ce qui disparaît ou change dans Mentale

| Élément | Sort |
|---|---|
| `sync/syncService.ts` (~1 700 lignes), `cardMerge.ts`, `copyLink.ts`, `syncReporting.ts` | remplacés par l'usage de `@suite/shared/sync` + un `FileFormat` Mentale |
| `typeReconciliation.ts`, `pathReconciliation.ts` | absorbés (type = `kind`, chemin = attribut) |
| `permissions.ts` | réduit à une façade sur `can` partagé |
| `contentHash.ts` | déplacé dans `shared/sync` |
| `useAutoSync`, `usePublishMindMap` | remplacés par le déclencheur de `SuiteApp` |
| `meta.copyLink` | lu et converti en `conflict_of` |

## Formats par app

| App | `kind` | extension | validateur existant à brancher |
|---|---|---|---|
| Mentale | `cours`, `exo`, `corrections`, `prise de notes` (déjà `MapType`) | `.zmap` | `validateCards`, `repairCards` |
| Maths | `fiche` (Sheet v2) | `.zmath` (les `.json` actuels restent lus, renommés à la première écriture) | lecture de `Sheet` (v1→v2), `parseBlocks` |
| base | `note` (fichier de démonstration) | `.txt` | trivial — sert de référence et de test |

## Cas particulier : `_ordre.json` (Maths)

L'ordre d'un dossier est un fichier de dossier, pas une fiche. Il se synchronise avec `kind: ordre` et
une règle propre déclarée par l'app (`FileFormat.merge`) : **fusion automatique par union** (garder
l'ordre du serveur, ajouter les fichiers inconnus à la fin) — jamais de doublon pour ce fichier. C'est la
seule exception à « pas de fusion », et l'ordre peut toujours être reconstruit depuis les fichiers.

## Dossier de synchro et réglages

Chaque app déclare son dossier **par défaut** dans `defineSyncApp({ folder })`. Le panneau
« Synchronisation » (fourni par `standardSettings`, donc présent dans toutes les apps) permet de le
changer, avec le même garde qu'au cas 17 : changer de dossier ne supprime rien sur le serveur et
déclenche un état « nouveau dossier » (comparaison par `id`, pas de suppression de masse).

## Sécurité et vie privée (à ne pas oublier)

- Identifiants des élèves : mots de passe jamais stockés en clair (aujourd'hui `password` l'est dans
  `sync-settings` à la demande de l'utilisateur : à REVOIR au lot S7, au moins ne plus le faire pour les
  comptes d'élèves — mineurs).
- Les données des élèves ne sortent que vers leur prof (règles de collection testées).
- Pré-prompt IA : aucune donnée d'élève en v1.
- Garde « suppression de masse » côté client ET plafond côté serveur.
