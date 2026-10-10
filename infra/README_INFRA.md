# Déployer PocketBase pour la synchronisation

> **Où lancer ces commandes.** Ce dossier est `infra/`, à la racine du dépôt. Depuis la racine,
> `bun run infra:plan`, `infra:apply` et `infra:check` font la même chose ; les scripts
> retrouvent leur `.env` à côté d’eux, d’où qu’on les lance.

Une seule image, ARM64 compatible (Raspberry Pi), SQLite embarqué — pas de base
de données séparée. Toute la configuration des collections est **automatique** :
il n'y a plus rien à créer à la main dans le tableau de bord.

**Le même conteneur sert aussi le site de la suite** (`apps/site`, construit en
statique) à la racine du domaine. PocketBase publie de lui-même le contenu de
`--publicDir` (`/pb_public`) pour toute URL qui n'est ni `/api/…` ni `/_/…` : le
Dockerfile y dépose le site construit, et il n'y a donc **ni second conteneur,
ni second domaine, ni CORS à ouvrir**.

| URL | Servie par |
| --- | --- |
| `https://cartes.mon-domaine.fr/` | la vitrine du site (page statique, sans JavaScript) |
| `/login/` | le site : connexion (profs et élèves) |
| `/inscription/` | le site : inscription d'un professeur avec un code d'invitation |
| `/gestion/` | le site : espace de l'administrateur (codes d'invitation, professeurs, élèves) |
| `/dashboard/` | le site : récapitulatif du professeur (et de l'administrateur) |
| `/eleves/` | le site : le professeur crée et gère ses élèves |
| `/compte/` | le site : le compte de l'utilisateur connecté |
| `/bibliotheque/` | le site : la bibliothèque (ex-interface d'administration de Mentale) |
| `/api/…` | l'API PocketBase — inchangée pour l'application de bureau — plus `POST /api/inscription` (hook) |
| `/_/` | le tableau de bord PocketBase |

## Comptes

- **L'administrateur est le superutilisateur PocketBase** (`PB_ADMIN_EMAIL` /
  `PB_ADMIN_PASSWORD` de `infra/.env`). Ce sont aussi ses identifiants sur
  `/gestion/` : un identifiant qui contient `@` s'y connecte comme
  superutilisateur. Les changer dans `.env` change cette connexion. **Ne les
  changez pas depuis `/compte/`** (l'administrateur n'y a pas de champ mot de
  passe : il serait de toute façon réécrit au redémarrage par `infra/.env`).
- **Un professeur naît d'un code d'invitation**, créé par l'administrateur dans
  `/gestion/` → Codes, puis utilisé sur `/inscription/`. Un code « unique » ne sert
  qu'une fois ; supprimer un professeur **libère** le code à usage unique qu'il
  avait consommé (l'usage se calcule en comptant les comptes qui portent le
  code).
- **Un élève est créé par son professeur** dans `/eleves/`.

> **Au déploiement : les comptes d'élèves existants n'ont pas de professeur.**
> Leur champ `teacher` est vide, donc aucun professeur ne les voit tant que
> chacun n'a pas été rattaché : dans `/gestion/` → onglet Élèves → changement de
> prof.

## Hooks

Le dossier `infra/pb_hooks/` est copié dans `/pb_hooks` de l'image (l'image de
base lance PocketBase avec `--hooksDir=/pb_hooks`) :

- `inscription.pb.js` — `POST /api/inscription` : crée un professeur à partir d'un
  code valable, en une transaction. **Limitée à 5 requêtes / 60 s** par la
  limitation de débit de PocketBase (voir « Limitation de débit » plus bas).
- `users.pb.js` — refuse la suppression d'un professeur qui a encore des élèves
  (même par le superutilisateur).
- `lib/inviteCode.js` — l'état d'un code (valable, épuisé, expiré, révoqué).

## 1. Renseigner les identifiants d'administration

```bash
cp infra/.env.example infra/.env
```

Puis remplissez les trois valeurs (`PB_URL`, `PB_ADMIN_EMAIL`,
`PB_ADMIN_PASSWORD`). `infra/.env` est gitignoré : ces valeurs ne partent
jamais dans le dépôt, et **elles servent deux fois** — au conteneur, qui crée le
superutilisateur au démarrage, et au script de configuration, qui s'en sert pour
s'authentifier. C'est le seul fichier à écrire.

Les variables, une par une :

| Variable | Rôle |
| --- | --- |
| `PB_URL` | l'URL du serveur, pour le script de configuration (le conteneur n'en a pas besoin) |
| `PB_ADMIN_EMAIL` | l'email du superutilisateur : créé au démarrage du conteneur, utilisé par le script, **et identifiant de l'administrateur sur `/gestion/`** |
| `PB_ADMIN_PASSWORD` | son mot de passe : mêmes trois usages |

Aucune autre variable n'est nécessaire.

## 2. Déploiement (Dokploy)

Dans Dokploy, créez une application « Docker Compose » pointant sur
`infra/docker-compose.yml`, avec les variables `PB_ADMIN_EMAIL` /
`PB_ADMIN_PASSWORD` (l'interface de Dokploy, ou le `infra/.env` du dépôt).
Exposez le port `8090` derrière votre tunnel Cloudflare, sur le sous-domaine de
votre choix (ex. `cartes.mon-domaine.fr`).

> **Si votre déploiement existe déjà, il n'y a RIEN à reconfigurer côté
> Dokploy ni côté tunnel.** Le service, son nom, son port `8090` et son volume
> `pb_data` sont inchangés ; seule la façon de fabriquer l'image change. Le
> domaine que vous avez déjà servira le site en plus de l'API.
>
> Une seule chose est à vérifier dans Dokploy : que le service est bien
> **construit depuis le dépôt** et non tiré d'un registre. Le compose déclare
> désormais `build:` au lieu de `image:` — Dokploy le fait tout seul au premier
> redéploiement, mais s'il avait mis l'image en cache, un « Redeploy » (ou
> « Rebuild ») force la reconstruction.
>
> Le contexte de construction est la **racine du dépôt**, pas `infra/` : l'image
> a besoin de `apps/site` et de `apps/zachart-mentale/src`. C'est déjà ce que
> déclare le compose (`context: ..`) ; rien à saisir.

Le premier build est plus long que d'habitude (il installe les dépendances du
site et le compile, soit une poignée de secondes à quelques minutes selon la
machine). Les suivants réutilisent la couche des dépendances tant que les
`package.json` ne changent pas.

> **Derrière le tunnel Cloudflare, PocketBase doit lire la vraie adresse IP du
> visiteur.** Dans le tableau de bord PocketBase (`/_/` → Settings → Application →
> *Trusted proxy headers*), ajoutez `CF-Connecting-IP`. Sans cela, la limitation
> de débit de l'inscription (voir plus bas) se calcule sur l'adresse du tunnel :
> tous les visiteurs partageraient alors **un seul** quota de 5 requêtes par
> minute.

L'image crée le superutilisateur au premier démarrage (`superuser upsert`, donc
idempotent au redémarrage) : **plus besoin de passer par `/_/`** pour
l'administrateur, sauf si vous voulez y jeter un œil.

> **L'image est épinglée** (`ghcr.io/muchobien/pocketbase:0.40.3`) et non
> `:latest`. Le script parle l'API des collections de PocketBase ≥ 0.23, et le
> SDK JS embarqué dans l'application (v0.28) vise cette série précise. Pour
> monter de version : changez l'image, relancez le script (voir plus bas) ; s'il
> se plaint, lisez son message avant de déployer.

## 3. Configurer le serveur

### Automatiquement, à chaque déploiement (par défaut)

Le compose embarque un service `schema` : il attend que PocketBase se déclare
sain, applique `infra/setup-pocketbase.mjs`, puis s'arrête. **Vous n'avez rien à
lancer** — un `git push` suivi d'un déploiement Dokploy met la base au niveau du
code qui vient d'être déployé.

Ce n'est pas un service qui tourne : pas de port, pas de domaine, rien à router.
Il vit trois secondes et sort. Le script étant idempotent, un serveur déjà à
jour ne bouge pas (« Rien à faire »), et le rejouer à chaque déploiement ne
coûte rien.

```bash
docker compose -f infra/docker-compose.yml logs schema   # ce qu'il a fait
```

> Si le service `schema` échoue, le déploiement est signalé en échec. C'est
> voulu : une base en retard sur le code est exactement ce qu'on ne veut pas
> laisser passer sans le savoir. Ses messages d'erreur sont ceux du script
> (section 8).
>
> Pour reprendre la main, supprimez le bloc `schema` du compose : la commande
> ci-dessous fait exactement la même chose, quand vous le décidez.

### À la main, quand vous le voulez

Depuis votre machine, dans le dépôt :

```bash
# Configuration complète, en lisant infra/.env
bun run infra/setup-pocketbase.mjs

# Ou tout à la main, par exemple pour un serveur distant :
bun run infra/setup-pocketbase.mjs \
  --url https://cartes.mon-domaine.fr \
  --email admin@mon-domaine.fr \
  --password 'le-mot-de-passe-superutilisateur'
```

Tout passe par l'API REST du serveur, avec une session superutilisateur : la
commande fonctionne aussi bien sur `http://127.0.0.1:8090` (conteneur local
avec le port publié, ou un `pocketbase serve` lancé à côté) que sur l'URL
publique derrière le tunnel.

**Elle est idempotente** : elle compare ce que le serveur a déjà à ce qu'il
devrait avoir, et n'écrit que ce qui diffère. Relancée, elle répond
« déjà à jour » — c'est aussi le moyen de vérifier un serveur existant.
`--dry-run` affiche le plan sans rien écrire.

> **Un serveur configuré AVANT l'arrivée du partage d'agencement ou du champ
> `type` doit être réappliqué.** Deux évolutions du schéma se rattrapent en
> relançant le script : la règle `Update`/`Delete` de `cartes_mentales` a changé
> (`author || prof`), et la collection a gagné le champ `type`. Tant que le
> script n'a pas été relancé dessus, un prof reçoit un **403** quand il pousse le
> `path` d'une carte d'élève, et un prof qui classe la carte d'un élève écrit
> dans une colonne qui n'existe pas — le renommage comme le classement
> n'atteignent jamais le serveur, alors que tout le reste (contenu, tirage,
> tests, journal) reste vert. Les règles API, elles, sont **inchangées** : le
> champ `type` ne s'accompagne d'aucune règle nouvelle. Aucune autre étape n'est
> nécessaire :
>
> ```bash
> bun run infra/setup-pocketbase.mjs --dry-run   # ce qui serait changé
> bun run infra/setup-pocketbase.mjs             # applique
> bun run infra/setup-pocketbase.mjs --check     # 0 = conforme
> ```
>
> Idempotent des deux côtés : un serveur déjà à jour ne bouge pas.

> **Un serveur configuré AVANT l'espace professeur doit être réappliqué, lui
> aussi — par la même commande.** Trois collections s'ajoutent (`dossiers`,
> `sync_events`, `sync_conflicts`) ; aucune collection existante n'est modifiée,
> et aucune règle ne change. Tant que le script n'a pas été relancé, la
> synchronisation fonctionne **exactement comme avant** — c'est la
> bibliothèque web qui reste partiellement muette : les onglets « Conflits » et
> « Journal » affichent « collection absente du serveur », et un dossier vide
> créé depuis le téléphone ne s'enregistre pas. Rien n'est perdu, rien n'est à
> réparer : il suffit de lancer
>
> ```bash
> bun run infra/setup-pocketbase.mjs --dry-run   # les trois créations annoncées
> bun run infra/setup-pocketbase.mjs             # applique
> ```

> **Un serveur amorcé PAR CE SCRIPT avant cette version n'a ni `created` ni
> `updated` sur `cartes_mentales`, et doit être réappliqué.** PocketBase ≥ 0.23
> a cessé d'ajouter ces colonnes d'office : le tableau de bord les met encore
> sur toute collection qu'il crée, mais une collection créée par l'API reçoit
> exactement les champs demandés, et le script ne les demandait pas. Un serveur
> configuré à la main dans `/_/` n'est donc PAS concerné ; un serveur monté de
> zéro par le script l'est.
>
> L'effet est silencieux et sérieux : `updated` est ce que la synchronisation
> lit pour distinguer « le serveur a bougé » de « je l'ai déjà vu »
> (`isConflict`, et le contrôle de révision côté réception). Absent, l'API ne
> le renvoie pas, chaque comparaison porte sur `undefined`, et l'algorithme perd
> son seul repère. Le script ajoute les deux champs sans toucher aux données :
>
> ```bash
> bun run infra/setup-pocketbase.mjs --dry-run   # « champ « updated » ajouté (autodate) »
> bun run infra/setup-pocketbase.mjs             # applique
> ```

Ce qu'elle installe :

| Collection       | Champs                                                              | Règles API                                                                   |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cartes_mentales` | `file_id` (unique), `author`, `path`, `content`, `type`            | lecture publique ; création pour tout compte connecté ; modification et suppression par l'auteur, ou par un compte `prof` |
| `assets`         | `hash` (unique), `extension`, `file` (≤ 10 Mio)                    | lecture publique ; création pour tout compte connecté ; jamais modifié        |
| `users`          | ajoute `username` (unique, obligatoire), `role` (`eleve`/`prof`), `teacher` (le prof d'un élève) et `invite_code` | inscription publique fermée (l'inscription passe par le hook) ; connexion par pseudo |
| `invite_codes`   | `code`, `kind` (`unique`/`duree`), `expires_at`, `revoked`          | réservée à l'administrateur (superutilisateur) |
| `dossiers`       | `path` (unique), `created_by`                                       | lecture publique ; création, renommage et suppression réservés aux `prof` |
| `sync_events`    | `username`, `level`, `trigger`, `summary`, compteurs, `detail`      | lecture réservée aux `prof` ; écriture pour tout compte connecté ; jamais modifié |
| `sync_conflicts` | `file_id`, `path`, `username`, `local_content`, `status`            | lecture et arbitrage par le `prof` ou par le compte concerné                   |

Les trois collections `dossiers`, `sync_events` et `sync_conflicts` servent **la
bibliothèque du site** (`/bibliotheque/`), et elles sont **facultatives** : un serveur sur lequel le script n'a pas encore été relancé
synchronise exactement comme avant. Les clients ne font qu'y déposer leur compte
rendu, et l'échec de ce dépôt n'a jamais d'effet sur une synchronisation (voir
`src/sync/syncReporting.ts`). Ce qui manque dans ce cas, c'est seulement ce que
la bibliothèque affiche : le journal reste vide et les conflits
n'y remontent pas.

- **`dossiers`** ne contient que les dossiers **vides**. Un dossier peuplé est
  déjà impliqué par le `path` des cartes qu'il contient — c'est cette
  dérivation qui reste la source de vérité de l'arborescence.
- **`sync_conflicts`** porte `local_content` : la version locale **perdante**,
  celle que `sync()` refuse d'écraser. Sans elle, un conflit ne se tranche que
  devant la machine de l'élève, puisque c'est le seul endroit où cette version
  existe.

Les règles exactes de `cartes_mentales`, telles que le script les applique — **inchangées** (le champ `type` n'en ajoute ni n'en retire aucune) :

```
List/View : (vide)
Create    : @request.auth.id != ""
Update    : @request.auth.username = author || @request.auth.role = "prof"
Delete    : @request.auth.username = author || @request.auth.role = "prof"
```

> Une règle PocketBase est *par enregistrement*, pas par champ : `author || prof`
> autorise donc un client prof à écrire n'importe quel champ, `content` compris.
> La séparation « l'auteur pousse `content`, le prof pousse `path` » est une
> discipline du CLIENT, pas une garantie du serveur. C'est acceptable ici : un
> serveur appartient à un prof, qui en est l'administrateur, et la propriété qui
> protège réellement les gens — un élève ne peut pas toucher l'enregistrement
> d'un autre élève — reste intacte.

Deux points valent d'être connus, parce que PocketBase ne les fait pas deviner :

- **Le champ `username` n'existe plus par défaut** dans PocketBase ≥ 0.23 (la
  collection `users` fournie s'authentifie par email). L'application se
  connecte par pseudo : le script crée ce champ, son index unique, et bascule
  l'identité de connexion dessus. C'est ce que les anciennes instructions
  manuelles demandaient sans que le champ existe.
- **Un champ texte sans longueur maximale est plafonné à 5000 caractères** par
  PocketBase. Le `content` d'une carte mentale dépasse largement cette taille :
  le script lui donne 5 000 000 de caractères, sinon la synchronisation échoue
  au premier chapitre un peu fourni.

Options utiles (`--help` liste tout) :

| Option | Effet |
| --- | --- |
| `--dry-run` | Affiche ce qui serait changé, n'écrit rien. |
| `--check` | Lecture seule **et code de sortie** : `0` si le serveur est conforme, `1` s'il reste des changements, `2` s'il est injoignable. Fait pour un déploiement automatique. |
| `--export [chemin]` | Écrit l'état **réel** des trois collections en JSON trié (par défaut `infra/pocketbase-schema.applied.json`) : committable, et un diff ne montre alors qu'une vraie dérive de configuration. |
| `--add-user pseudo:role[:motdepasse]` | Crée (ou met à jour) un compte `eleve`/`prof`. Sans mot de passe, un mot de passe solide est généré **et affiché**. |
| `--verify pseudo:motdepasse` | Après configuration, se connecte avec ce compte et fait un aller-retour réel sur `cartes_mentales` (écriture d'un contenu long, relecture, suppression) : la preuve que les champs et les règles acceptent le trafic de l'application. |
| `--backup-cron <expr>` · `--backup-keep <n>` | Planification des sauvegardes automatiques (défaut `0 3 * * *`) et nombre conservé (défaut 7). |
| `--no-backups` | Ne touche pas aux sauvegardes automatiques du serveur. |
| `--no-rate-limits` | Ne touche pas à la limitation de débit de l'inscription (voir plus bas). Sert aux tests d'intégration. |
| `--insecure` | Accepte un certificat TLS auto-signé (serveur local). |

### Limitation de débit

Le script active la limitation de débit de PocketBase et y pose une règle :
**5 requêtes / 60 s sur `POST /api/inscription`**. Au-delà, le serveur répond
`429`. C'est une règle de PocketBase, avec sa propre politique d'activation
(`--check` la vérifie aussi). `--no-rate-limits` laisse ce réglage tel qu'il est :
les scénarios d'intégration S1–S9 font bien plus de 5 inscriptions par minute, ils
se jouent donc avant que la règle soit appliquée.

## 4. Créer les comptes des élèves et du professeur

```bash
bun run infra/setup-pocketbase.mjs --add-user eleve1:eleve
bun run infra/setup-pocketbase.mjs --add-user prof:prof:son-mot-de-passe
```

Le mot de passe omis est généré (16 caractères) et affiché une fois — notez-le
pour le transmettre. Le script peut aussi servir à réinitialiser un mot de passe :
relancer la même commande avec un mot de passe écrase l'ancien.

Vous pouvez toujours passer par le tableau de bord (`https://…/_/` →
collection `users`) : l'inscription par l'API publique, elle, est fermée.

Pour le parcours normal du site (code d'invitation, élèves créés par leur
professeur), voir « Comptes » plus haut.

## 5. Dans l'application

Réglages → Synchronisation : entrez l'URL du serveur, connectez-vous avec un
compte créé ci-dessus (pseudo + mot de passe), choisissez le dossier local à
synchroniser, puis cliquez sur **Synchroniser**. Le même bouton existe en bas de
la barre latérale.

L'adresse et les identifiants sont **enregistrés en clair** dans le dossier de
configuration de l'application, sur cet appareil uniquement : le formulaire est
donc déjà rempli au démarrage, et l'application se reconnecte toute seule quand
la session a expiré. Ce fichier n'est jamais synchronisé ni versionné ; il voisine
avec le jeton de session PocketBase, qui donne déjà accès aux mêmes cartes.

Si un dossier contient des cartes **jamais publiées** (créées dans l'application,
donc sans identité de synchronisation), elles ne partent pas — c'est ce que dit
le message « N cartes n'ont pas encore d'identité de synchronisation » dans les
réglages, avec le bouton qui les publie toutes d'un coup. Une carte publiée garde
son auteur : lui seul, ou un prof (qui déplace les cartes de ses élèves),
pourra la modifier par la suite.

## 6. Sauvegardes

Le script d'installation **active les sauvegardes automatiques de PocketBase**,
qu'il faut connaître parce qu'elles sont désactivées d'origine : son `cron` est
vide, donc un serveur que personne ne surveille n'a rien à restaurer tant que
quelqu'un n'y a pas pensé. Par défaut il programme une sauvegarde par nuit à 3 h
et en garde 7 ; `--backup-cron`/`--backup-keep` changent cela, `--no-backups`
laisse le serveur tranquille.

Pour une sauvegarde **maintenant** — avant de changer la version de l'image, par
exemple :

```bash
bun run infra/backup-pocketbase.mjs                       # crée et télécharge
bun run infra/backup-pocketbase.mjs --list                # ce que le serveur garde
bun run infra/backup-pocketbase.mjs --restore <clé> --yes # ⚠ remplace TOUTES les données
```

Elle arrive dans `infra/backups/` (gitignoré) et se restaure donc aussi depuis
le tableau de bord. `--restore` exige `--yes` : il remplace cartes, comptes et
réglages, et PocketBase redémarre son service dans la foulée.

## 7. Vérifier et automatiser

`bun run infra/setup-pocketbase.mjs --check` répond à la seule question qui
compte pour un déploiement : « ce serveur est-il exactement configuré ? » — et le
dit dans son code de sortie (`0` oui, `1` non, `2` injoignable). Un
post-déploiement peut donc refuser de publier tant que la réponse est non.

Le workflow `.github/workflows/infra-pocketbase.yml` fait ce contrôle en
intégration continue, contre un PocketBase **éphémère monté à la version épinglée
dans `infra/docker-compose.yml`** : il vérifie que `--check` échoue sur un
serveur vierge, que la configuration passe, que le second passage ne change plus
rien, qu'un compte ordinaire peut réellement publier et relire un fichier long,
que les comptes, les codes et les hooks se comportent (`integration.mjs`), que la
limitation de débit répond `429`, et qu'une sauvegarde se télécharge. C'est la seule protection réelle contre une
API PocketBase qui bouge sous nos pieds — c'est exactement ce qui a fait
disparaître le champ `username` des collections par défaut.

## 8. Quand ça ne marche pas

- **Le journal, à distance d'abord** : ouvrez `https://…/` → onglet
  « Journal ». Chaque synchronisation de chaque appareil y laisse une ligne, avec
  ce qui est parti, ce qui est arrivé, et ce qui a échoué. C'est la façon la plus
  rapide de répondre à « est-ce que ça passe, chez lui ? » sans toucher à sa
  machine. Le journal local ci-dessous reste plus détaillé, et reste la
  référence pour un vrai diagnostic.

- **Journal de synchronisation (local, sur la machine concernée)** : chaque
  connexion et chaque synchronisation y laisse une ligne (succès comme échec),
  dans le dossier de configuration de l'application :

  | Système | Chemin |
  | --- | --- |
  | Windows | `%APPDATA%\com.clape.zachart-mentale\sync-debug.log` |
  | macOS | `~/Library/Application Support/com.clape.zachart-mentale/sync-debug.log` |
  | Linux | `~/.config/com.clape.zachart-mentale/sync-debug.log` |

  Le bouton **« Ouvrir le dossier des logs »** (Réglages → Synchronisation)
  l'ouvre directement, et le chemin exact est affiché à côté.

- **Messages du script** :
  - *Serveur injoignable* : URL, tunnel ou réseau.
  - *Email ou mot de passe superutilisateur refusé* : les valeurs de `infra/.env`
    ne sont pas celles du serveur.
  - *Pas d'API superutilisateur* : l'URL ne pointe pas sur un PocketBase ≥ 0.23.
- **Vérifier un serveur déjà en service** : `bun run infra/setup-pocketbase.mjs`
  doit répondre « déjà à jour ». S'il propose des changements, lisez-les : c'est
  exactement ce qu'il appliquera.

## 9. La bibliothèque du site

`/bibliotheque/` est l'ancienne interface web d'administration de Mentale, désormais
une page du site (`apps/site/src/app/bibliotheque/`, voir son `README.md`) :

- **On s'y connecte avec la session du site** (`/login/`) ; seuls les comptes
  `prof` sont acceptés.
- **Elle ne demande aucun déploiement séparé** : elle est dans l'image
  PocketBase, construite par `infra/Dockerfile`.
- **Elle a besoin des trois collections de l'étape 3** (`dossiers`,
  `sync_events`, `sync_conflicts`). Si elle affiche « collection absente du
  serveur », c'est que le script n'a pas encore été relancé sur ce serveur —
  une commande, aucune perte de données.

```bash
bun run infra/setup-pocketbase.mjs --check   # 0 = le serveur a tout ce qu'il faut
```

## Tests

- `bun run test:infra` (depuis la racine) lance les tests unitaires de `infra/`. Le
  script appelle le `vitest` installé dans `apps/zachart-mentale/node_modules` : ni
  `vitest` seul (non résolu depuis la racine) ni `bunx vitest` (télécharge une
  autre version) ne conviennent.
- `bun run infra/integration.mjs` joue les scénarios S1–S9 (inscription par code,
  élèves, hooks, règles) contre un **vrai** PocketBase, qui doit avoir été
  configuré avec `--no-rate-limits`. `--only-rate-limit` joue S10 (le `429`), après
  une application normale. La séquence est celle du workflow
  `.github/workflows/infra-pocketbase.yml` :

  ```bash
  docker run -d --name pocketbase -p 8090:8090 \
    -e PB_ADMIN_EMAIL -e PB_ADMIN_PASSWORD \
    -v "$PWD/infra/pb_hooks:/pb_hooks:ro" \
    ghcr.io/muchobien/pocketbase:0.40.3        # la version épinglée dans infra/Dockerfile

  bun run infra/setup-pocketbase.mjs --no-rate-limits   # schéma, sans la limitation
  bun run infra/integration.mjs                         # S1–S9
  bun run infra/setup-pocketbase.mjs                    # applique la limitation
  bun run infra/setup-pocketbase.mjs --check            # 0 = conforme
  bun run infra/integration.mjs --only-rate-limit       # S10 : 429
  ```

  (`integration.mjs` lit `PB_URL`, `PB_ADMIN_EMAIL` et `PB_ADMIN_PASSWORD` dans
  l'environnement uniquement ; `setup-pocketbase.mjs` les lit aussi dans `infra/.env`.)
