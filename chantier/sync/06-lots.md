# 06 — Lots

Même discipline que « Harmonie » : chaque lot extrait **et** branche, laisse le dépôt vert (tests de
chaque app inchangés) et est testable seul. Règle de deux : le moteur n'est figé qu'après avoir servi
`base` ET une vraie app.

| Lot | Titre | Taille | Dépend de | Contenu | Critère d'achèvement |
|---|---|---|---|---|---|
| S0 | Décisions et cadrage | S | — | Valider ce dossier ; décisions ci-dessous (prises) ; relever les ~19 cas de la table contre `syncService.ts` actuel (lesquels sont déjà couverts) | Questions ouvertes closes, `suivi.md` à jour |
| S1 | Serveur unique | M | S0 | Schéma `files` (+ `teacher`, `rev`, `conflict_of`, `origin_id`, corbeille), hook `rev`, règles d'accès ; déplacer `apps/zachart-mentale/infra/` vers `infra/` à la racine (scripts, README, Dockerfile, CI, CLAUDE.md) **[déplacement d'`infra/` : fait]** ; script de migration `cartes_mentales → files` ; tests du schéma/diff | `infra:plan/apply/check` verts ; règles testées contre la table de droits |
| S2 | Moteur pur | L | S0 | `engine/`, `ports.ts`, transport mémoire ; un test par cas de la table (19) ; garde de masse ; faux `id` | `planSync` couvre toute la table, 0 dépendance réseau/Tauri |
| S3 | Droits | S | S2 | `can.ts` + test de table (03) ; façade `permissions.ts` de Mentale | Table de droits = tests ; interface et serveur lisent la même fonction |
| S4 | Adaptateur et exécution | L | S1, S2 | `pocketbase/`, `runSync`, reprise, `SyncStateStore`, 409 → doublon, assets par hash | Scénario bout en bout contre un PocketBase de test (ou fake serveur) ; interruption/reprise testées |
| S5 | Intégration dans `SuiteApp` + `base` | M | S4, Harmonie L3 | `defineSyncApp`, indicateur d'état, déclencheurs (ouverture, bouton, intervalle), réglages « Synchronisation » via `standardSettings` ; `base` synchronise des `.txt` | `apps/base` synchronise deux postes simulés ; contrat d'app étendu (`adoptedLots`) |
| S6 | Conflits (UI) | M | S5 | `ConflictBanner`, badge doublon dans l'arbre, `ConflictDialog` (3 actions + `renderPreview`), rappel doux des vieux doublons, renommage = fin du doublon | Parcours complet testé : conflit → doublon → résolution (3 voies) |
| S7 | Prof et élèves | L | S3, S5 | Site : inscription prof, gestion des élèves **[livré par le plan 2026-10-10-site-comptes ; distribution, copies, corbeille restent à faire]** ; distribution (`RecipientPicker`), copies par élève, mise à jour des copies, vue filtrée par élève, corbeille et restauration, revue des mots de passe stockés | Un prof, 3 élèves simulés : distribuer, modifier, mettre à jour, supprimer/restaurer |
| S8 | Création par IA | M | S5 | `AiCreateDialog`, pré-prompt unique par app, validateur (Mentale puis Maths), génération du pré-prompt depuis la skill + test de non-divergence | Modale complète testée ; sortie IA mal formée → erreurs claires, bien formée → fichier créé et synchronisé |
| S9 | Migration de Mentale | XL | S6, S7 | `FileFormat` Mentale ; remplacement de `sync/` ; `copyLink` → `conflict_of` ; suppression de `sync_conflicts`/`folders`/`cardMerge` ; **suite Mentale inchangée dans ses assertions utiles** | Suite Mentale verte ; code `sync/` propre à Mentale réduit au format |
| S10 | Migration de Maths | L | S6, S8 | `FileFormat` Maths (Sheet, extension `.zmath`, lecture des `.json` anciens, association de fichier Tauri) ; dossier `Documents/Zach'Math/` synchronisé ; `ExerciseFs` ↔ `SyncStore` | Suite Maths verte ; un prof distribue une fiche à un élève |
| S11 | Clôture | S | tous | CLAUDE.md (section Synchro, retirer « PocketBase belongs to Mentale only »), docs d'infra, scripts, `chantier/sync/suivi.md` | Docs à jour, `bun run test:all` vert |

L'ordre S6 / S7 / S8 peut être permuté. Ne jamais migrer une app (S9, S10) avant que S6 et S7 soient prêts.

## Décisions prises en S0

| # | Question | Décision |
|---|---|---|
| 1 | Dossier de synchro | **Un dossier par défaut par app** (Mentale : son dossier actuel ; Maths : `Documents/Zach'Math/`), **modifiable dans les réglages de toutes les apps** (panneau « Synchronisation » de `standardSettings`) |
| 2 | Format Maths | **`.zmath`** (JSON dedans, comme `.zmap`). Les `.json` existants restent lus (alias) et sont renommés en `.zmath` à leur première écriture. `_ordre.json` n'est pas une fiche : voir 05 |
| 3 | Emplacement de `infra/` | **À la racine** du dépôt (`infra/`), il sert toute la suite |
| 4 | Profs par élève | **1 élève = 1 prof** |
| 5 | Mise à jour des copies | **À la demande** (réglable par fichier plus tard) |
| 6 | Durée de la corbeille | 30 jours (défaut, non contesté) |

## Questions encore ouvertes (non bloquantes avant S2)

1. Mots de passe élèves : affichage unique à la création + « réinitialiser » (défaut proposé) ?
2. Hors ligne prolongé : plafond de la file de modifications (défaut : aucun en v1, avertissement au-delà de N fichiers) ?
