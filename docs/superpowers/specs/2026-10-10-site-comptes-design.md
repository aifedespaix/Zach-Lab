# Site de la suite : comptes, gestion, tableau de bord et vitrine

Date : 2026-10-10. Statut : design validé en conversation, spec à relire avant le plan.

## Objectif

Un seul site, servi par le PocketBase de la suite, qui porte :

- la **vitrine** `/` (statique, design à venir par une autre personne) ;
- la **connexion** et l'**inscription par code** des professeurs ;
- l'**administration** `/gestion` (CRUD complet profs, élèves, rattachements, codes) ;
- l'espace du **professeur** : `/dashboard`, `/eleves`, `/compte`, `/bibliotheque`.

Seul l'admin peut faire naître un compte prof, par un code d'inscription. Le prof crée ensuite ses
élèves lui-même. Les élèves n'utilisent pas le site : ils se connectent dans l'application de bureau.

Ce travail livre une partie du lot S7 du chantier Synchro (site : inscription prof, gestion des
élèves). Il ne touche ni au moteur de synchronisation ni au schéma `files`.

## Décisions prises avec l'utilisateur

1. Un code d'inscription crée **uniquement un compte prof**. Pas de code pour les élèves.
2. L'admin web actuel (Fichiers, Nouvelle, Conflits, Doublons, Journal) devient la section
   `/bibliotheque` du nouveau site, code inchangé.
3. L'admin se connecte avec le **superutilisateur PocketBase** (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`,
   déjà dans `infra/.env`). Aucune variable nouvelle, aucune route serveur de gestion.
4. Un code est **à usage unique** ou **à durée** (date d'expiration, plusieurs inscriptions possibles),
   au choix à la création. Révocation manuelle possible.
5. Un seul projet **Astro global** (`apps/site/`), pas dans Mentale : le site et la synchro servent
   toute la suite. Astro pour tout ; les pages connectées sont rendues côté client, le SSG n'y compte pas.
6. `infra/` passe **à la racine** dans ce travail (la partie « déplacer » du lot S1), en commit isolé.

## Hypothèses à corriger si fausses

- Un élève qui ouvre `/login` voit un message qui le renvoie vers l'application de bureau.
- Supprimer un prof qui a encore des élèves est refusé : l'admin les rattache d'abord ailleurs ou les supprime.

## 1. Structure et build

```
apps/site/
  astro.config.mjs        sortie statique, React, Tailwind 4, proxy dev /api et /_ vers PB_URL
  CLAUDE.md               périmètre du designer de la vitrine (voir §5)
  src/pages/
    index.astro           vitrine (statique, zéro JS par défaut)
    login.astro  inscription.astro  gestion.astro  dashboard.astro
    eleves.astro  compte.astro  bibliotheque.astro     chacune monte un îlot React client:only
  src/site/               composants Astro de la vitrine
  src/app/                code React des pages connectées
    bibliotheque/         l'admin actuel, déplacé avec git mv
```

- Workspace Bun, port de dev **1460** (HMR 1461).
- La vitrine n'importe rien de `src/app/`.
- `/bibliotheque` conserve l'alias `@app` vers `apps/zachart-mentale/src` pour le code pur des cartes
  (`validateCards`, `repairCards`, sérialisation). C'est une dette de transition, documentée, levée au
  lot S9 (migration de Mentale vers un format de fichier générique). Le test de frontière de
  `apps/site` interdit tout autre import d'une app et tout `@tauri-apps/*`.
- Le Dockerfile (dans `infra/` à la racine) construit `apps/site`, copie `dist/` dans `/pb_public` et
  copie `infra/pb_hooks/` dans l'image.
- **Risque à lever en premier** : comment PocketBase sert `/login` quand le fichier est
  `login/index.html` (le repli `indexFallback` renvoie sinon la vitrine). Première étape du plan, testée
  sur une vraie image avant d'écrire le reste.
- **Vérifié (PocketBase 0.40.3, image réelle)** : `/login/` sert `login/index.html` (200) et `/login` sans barre répond 301 vers `/login/` ; le repli vitrine n'intervient pas, aucun hook de redirection n'est nécessaire.

## 2. Comptes et accès

| Compte | Nature | Pouvoirs |
|---|---|---|
| Admin | superutilisateur PocketBase | tout, via son jeton |
| Prof | `users`, `role = prof` | CRUD de **ses** élèves ; sa bibliothèque |
| Élève | `users`, `role = eleve`, `teacher` = son prof | aucun accès au site |

- `users` gagne `teacher` (relation vers `users`, vide pour un prof) et `invite_code` (relation vers
  `invite_codes`, renseignée pour un prof inscrit par code).
- **Une page de connexion.** Un identifiant contenant `@` tente le login superutilisateur, sinon le
  login `users`. L'admin arrive sur `/gestion`, le prof sur `/dashboard`.
- **Gardes côté client** : sans session, redirection vers `/login` ; mauvais rôle, vers `/dashboard`.
  Simple confort : la sécurité vient des règles de collection.
- **Règles de collection `users`** : seul le superutilisateur crée un prof. Un prof crée, lit, modifie
  et supprime uniquement les `users` de rôle `eleve` dont `teacher` est lui-même, et ne peut modifier ni
  son `role` ni un `teacher`. Un prof ne voit jamais les élèves d'un autre prof (décision 1 élève = 1 prof
  du chantier Synchro). Les règles sont écrites dans `pocketbase-schema.mjs` et testées avec ses tests.
- Suppression d'un prof ayant des élèves : refusée par la règle de suppression.

## 3. Codes d'inscription

Collection `invite_codes` :

| Champ | Détail |
|---|---|
| `code` | unique, 10 caractères d'un alphabet sans `0 O 1 I l` |
| `kind` | `unique` ou `duree` |
| `expires_at` | obligatoire pour `duree`, absent pour `unique` |
| `revoked` | booléen |
| `note` | libre (ex. « équipe de maths ») |

- Toutes les règles de collection à `null` : seul le superutilisateur y touche, aucun visiteur ne peut
  énumérer les codes.
- Un code est **utilisable** s'il n'est pas révoqué, pas expiré, et, pour `unique`, qu'aucun compte ne
  le porte déjà. États affichés : actif, utilisé, expiré, révoqué. Une **fonction pure unique**
  calcule l'état, partagée par l'interface et le hook, avec ses tests.
- « Inscrits avec ce code » = requête sur `users.invite_code`.
- **Inscription** : `/inscription` envoie code, identifiant, mot de passe à
  `POST /api/inscription`, hook `infra/pb_hooks/inscription.pb.js`. Dans une transaction : vérifier le
  code, créer le `users` (`role = prof`, `invite_code`), répondre. La transaction empêche que deux
  requêtes simultanées consomment le même code `unique`.
- Erreurs : un message unique « code invalide ou expiré » (aucun indice sur l'existence passée d'un
  code), plafond de tentatives par IP, mot de passe d'au moins 10 caractères, identifiant conforme au
  motif déjà imposé par le schéma (`^[a-zA-Z0-9_.-]+$`).
- Le code peut venir de l'URL (`/inscription?code=…`).
- Le schéma reste de la donnée : `invite_codes` et les champs de `users` s'ajoutent à
  `pocketbase-schema.mjs`, et `infra:plan/apply/check` les prennent en charge.

## 4. Pages

Toutes sont pensées pour l'ordinateur et se replient sur téléphone : barre latérale à gauche sur grand
écran, barre du bas sur petit écran, tableaux qui deviennent des listes de cartes.

| Route | Qui | Contenu |
|---|---|---|
| `/login` | tous | identifiant, mot de passe, lien « j'ai un code » |
| `/inscription` | visiteur | code, identifiant, mot de passe, confirmation |
| `/gestion` | admin | **Profs** : liste, ajout, modification, suppression, nombre d'élèves. **Élèves** : liste filtrable par prof, changement de prof, ajout, modification, réinitialisation du mot de passe, suppression. **Codes** : création (unique ou durée), état, révocation, suppression, inscrits |
| `/dashboard` | prof | nombre d'élèves, conflits ouverts, dernière synchro par élève ; liens `/eleves`, `/compte`, `/bibliotheque` ; l'admin y voit aussi `/gestion` |
| `/eleves` | prof | ses élèves : créer (identifiant + mot de passe affiché **une seule fois**), réinitialiser le mot de passe, supprimer |
| `/compte` | prof, admin | changer mot de passe et identifiant, se déconnecter |
| `/bibliotheque` | prof | l'admin actuel (Fichiers, Nouvelle, Conflits, Doublons, Journal), navigation `#/onglet` conservée |

Le CRUD de l'admin passe par son jeton de superutilisateur et l'API de collections, sans route serveur
supplémentaire. Cela répond à la question ouverte n° 1 du chantier Synchro (mot de passe affiché une fois
à la création, puis réinitialisation).

## 5. Documentation, tests, ordre

**Variables d'environnement** (`infra/.env.example`, documenté ligne à ligne) :
`PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`. Les deux dernières sont aussi l'identifiant de
`/gestion`. Le README d'infra dit où les mettre et rappelle de ne jamais les committer.

**Pour le designer de la vitrine** : `apps/site/CLAUDE.md` limite son périmètre à
`src/pages/index.astro` et `src/site/`, pose les règles Astro (zéro JavaScript côté client par défaut,
images optimisées, îlot seulement si nécessaire, aucun import de `src/app/`), et pointe vers une skill
Astro. On cherche d'abord une skill existante et fiable avant d'en écrire une.

**Tests** :

- Vitest sur les fonctions pures : état d'un code, gardes de rôle, filtrage par prof.
- Règles de collection dans les tests du schéma (`setup-pocketbase.test.mjs` et voisins), y compris le
  cloisonnement entre profs.
- Hook d'inscription contre un vrai PocketBase local : code valide, expiré, révoqué, déjà consommé, deux
  requêtes simultanées sur un code `unique`.
- Frontière : `apps/site` n'importe aucune app hors l'alias `@app` de la bibliothèque.

**Docs à mettre à jour** : ce `CLAUDE.md` (sections admin web et infra ; la phrase « PocketBase belongs
to Zachar't Mentale only » ne vaut plus pour les comptes), `docs/`, `chantier/sync/suivi.md` (S7
partiellement livré, déplacement d'`infra/` de S1 fait).

**Ordre de mise en œuvre** (chaque étape laisse le dépôt vert) :

1. Déplacer `infra/` à la racine (commit isolé : scripts, Dockerfile, CI, docs, CLAUDE.md).
2. Squelette Astro + vérification que PocketBase sert `/login` en `login/index.html`.
3. Schéma (`invite_codes`, champs de `users`, règles) et hook d'inscription.
4. Connexion, session et gardes.
5. `/gestion`.
6. `/dashboard`, `/eleves`, `/compte`.
7. Migration de la bibliothèque vers `/bibliotheque`.
8. Vitrine, `CLAUDE.md` du designer, skill Astro, documentation.

## Hors périmètre

Inscription des élèves par code, envoi de courriels, réinitialisation de mot de passe par courriel,
design de la vitrine, moteur de synchronisation, schéma `files`, migration de Mentale ou de Maths.

## Écarts assumés à l'exécution

- `invite_code` (sur `users`) est un champ **texte** et non une relation vers `invite_codes` : une relation exigerait l'id généré de la collection, que le schéma-comme-donnée ne connaît pas.
- La fonction d'état d'un code existe en **deux implémentations** (le JS du hook, le TS du site), faute de pouvoir importer un module CommonJS dans le bundle ; toutes deux rejouent la même table de cas, `infra/fixtures/invite-code-states.json`.
- Le `/compte/` de l'administrateur est en **lecture seule** : son mot de passe serait réécrit par `infra/.env` à chaque démarrage.
- La limitation de débit de l'inscription est une **règle de PocketBase** (5 requêtes / 60 s sur `POST /api/inscription`), avec sa propre politique d'activation ; `--no-rate-limits` permet de jouer les scénarios d'intégration S1–S9 avant de l'appliquer.
- Dans `/bibliotheque`, les listes internes défilent **avec la page** : `AppShell` n'a pas de hauteur fixe.
