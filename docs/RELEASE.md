# Publier une app de la suite

Chaque app a **sa version, son tag et sa release**. Un tag pousse le workflow
`.github/workflows/release.yml`, qui construit l'app que ce tag désigne.

| App | Dossier | Tag | Release GitHub | Mises à jour signées |
|---|---|---|---|---|
| Zachar’t Mentale | `apps/zachart-mentale` | `zachart-vX.Y.Z` | normale | oui |
| Base | `apps/base` | `base-vX.Y.Z` | **pré-release** | non (pas encore de clé) |
| Zach'Math | `apps/zachart-maths` | `zachart-maths-vX.Y.Z` | **pré-release** | oui (clé de Zachar’t Mentale) |

**Liens de téléchargement stables.** Chaque app a une release roulante
`updater-<préfixe>` qui porte son dernier installeur sous un nom fixe
(`releases/download/updater-<préfixe>/<Nom>-setup.exe`) : les liens du README
donnent toujours la dernière version, sans toucher au « latest » du dépôt. Le nom
fixe est la valeur `asset` de `release.yml`.

**Voir la dernière version de chaque logiciel sur /releases.** GitHub liste toutes
les releases à la suite. Pour n'y garder que la plus récente de chaque app, active
la variable de dépôt `PRUNE_OLD_RELEASES=true` (Settings → Secrets and variables →
Actions → Variables) : `release.yml` supprime alors les anciennes releases de l'app
publiée (les tags restent, les anciens installeurs disparaissent). Désactivé par
défaut. Les releases techniques `updater-*` restent visibles.

Les anciens tags `v1.2.3` restent en place ; ils ne relancent rien.

## Publier une version

```bash
bun run deploy                                  # interactif : choisis l'app, le type de version, confirme
bun run deploy zachart-maths minor              # direct ; plusieurs : a,b ou « all »
bun run deploy all patch --yes --dry-run        # --dry-run : montre le plan sans rien écrire ; --yes : sans confirmation
```

`bun run deploy` vérifie l'état du dépôt (branche `main`, rien d'indexé, à jour avec
`origin`, tag libre), bumpe, fait un commit par app, pousse `main`, pose et pousse
les tags. **Seul le tag lance la construction** : un simple push sur `main` ne
construit rien (`build.yml` ne tourne que sur les PR et à la demande).

**Sans machine locale** : onglet Actions → « publish-manual » → *Run workflow* (aussi dans l'app GitHub
mobile). On choisit l'app et `patch` / `minor` / `major` (ou `none` pour publier la version déjà dans le
code) ; le workflow bumpe, commit sur `main`, pose le tag et lance `release.yml` dessus. À lancer depuis `main`.

Les étapes à la main, si besoin :

```bash
bun run version:bump -- zachart-mentale patch     # ou minor, major, X.Y.Z
```

Le script met **la même version** dans `package.json`, `tauri.conf.json`,
`Cargo.toml` et `Cargo.lock` de l'app (ce qui referme aussi la dérive historique
entre le `Cargo.toml` et le reste), puis imprime les commandes à coller :
`git add` des seuls fichiers concernés, `git commit`, `git push origin main`,
`git tag zachart-vX.Y.Z`, `git push origin zachart-vX.Y.Z`.

Le workflow refuse un tag qui ne correspond pas à la version du code
(`zachart-v1.20.7` posé sur un code en 1.20.6) : l'updater comparerait le mauvais
numéro.

## Générer une mise à jour en local

Sans passer par GitHub Actions, depuis une machine **Windows** (l'installeur est un NSIS) :

```bash
bun run update:mentale           # Zachar’t Mentale
bun run update:maths             # Zach'Math
bun run update:all               # les deux, l'une après l'autre
bun run update:mentale -- patch  # bumpe la version d'abord (patch, minor, major ou X.Y.Z)
```

Options, après `--` : `--skip-tests` (saute les tests de l'app), `--notes "texte"` (les notes de
`latest.json`), `--out dossier` (par défaut `updates/`, ignoré par git).

La commande **vérifie tout avant de compiler** (clé de signature, clé publique et adresse dans
`tauri.conf.json`, Windows), lance les tests de l'app, construit avec `createUpdaterArtifacts`, puis
range dans `updates/<app>/<version>/` l'installeur signé, sa `.sig` et le `latest.json` que l'app
interroge. Les noms de fichiers sont en ASCII exprès : GitHub réécrit les espaces et les `’` des noms
d'assets, ce qui casserait l'adresse écrite dans `latest.json`.

**Elle ne publie rien** : elle imprime les commandes `gh` (créer la release du tag, déposer le
`latest.json` sur la release roulante de l'app). Pour une version donnée, choisis une voie ou l'autre :
cette commande, ou le tag poussé qui lance `release.yml`.

La clé privée se donne par variable d'environnement, **par nom d'app** (tableau ci-dessous) : son
contenu, ou le chemin du fichier. Bun lit aussi un fichier `.env.local` à la racine (ignoré par git).
Zach'Math signe avec la même clé que Zachar’t Mentale : `update:maths` lit donc les mêmes variables.

## Les secrets de signature

Ils se créent dans les réglages du dépôt GitHub (jamais dans le code, jamais
dans une discussion) et sont choisis **par nom** selon l'app :

| App | Clé privée | Mot de passe |
|---|---|---|
| Zachar’t Mentale | `TAURI_SIGNING_PRIVATE_KEY` | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| Base | `TAURI_SIGNING_PRIVATE_KEY_BASE` | `TAURI_SIGNING_PRIVATE_KEY_BASE_PASSWORD` |
| Zach'Math | `TAURI_SIGNING_PRIVATE_KEY` | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |

Zach'Math **réutilise la clé de Zachar’t Mentale** : un seul secret à gérer, et
la même clé publique dans les deux `tauri.conf.json`. Le revers : la fuite de
cette clé permettrait de signer une mise à jour pour les deux apps. Une app
peut avoir sa propre clé (voir plus bas) ; Base n'en a pas encore.

## Où l'app cherche ses mises à jour

`releases/latest/download/latest.json` désigne **la dernière release non
pré-release de tout le dépôt**, toutes apps confondues. Les installations de
Zachar’t Mentale déjà distribuées interrogent cette adresse. Deux règles en
découlent :

1. **Toute app autre que Zachar’t Mentale est publiée en pré-release.** Sinon sa
   release deviendrait « la dernière » et les installations existantes de
   Zachar’t Mentale iraient chercher un `latest.json` qui n'existe pas chez elle :
   leurs mises à jour s'arrêteraient sans un message. `release.yml` le fait déjà
   (`prerelease` par app).
2. Chaque app à mises à jour signées reçoit une **release roulante**
   `updater-<préfixe>` (par exemple `updater-zachart`), créée et réécrite par le
   workflow à chaque publication. Son `latest.json` a une adresse stable qui ne
   dépend d'aucune autre app :
   `https://github.com/aifedespaix/Zachar-t-Mentale/releases/download/updater-zachart/latest.json`.
   Ne pas la supprimer.

### Migration de l’endpoint de Zachar’t Mentale

Le workflow alimente `updater-zachart` à chaque release de Zachar’t Mentale, et
la configuration l'interroge **en premier**, l'ancienne adresse venant après
(`apps/zachart-mentale/src-tauri/tauri.conf.json`, et le test `packaging.test.ts`
qui le fige). L'étape 1 ci-dessous est donc faite ; la première version publiée
avec cette configuration est la version de transition. Elle doit avoir un numéro
**supérieur** à celui des installations existantes, sinon elles ne la voient pas.
Les deux temps :

1. **Version de transition.** Dans `tauri.conf.json`, `plugins.updater.endpoints`
   devient `[ <adresse roulante>, <ancienne adresse> ]` (Tauri essaie les
   adresses dans l'ordre). Mettre à jour `packaging.test.ts` dans le même commit,
   puis publier normalement. Les installations existantes trouvent cette version
   par l'**ancienne** adresse (c'est la dernière release non pré-release), se
   mettent à jour, et la nouvelle version, elle, interroge la roulante d'abord.
2. **Plus tard**, quand plus personne n'utilise les anciennes versions, l'ancienne
   adresse peut quitter la configuration. Elle doit rester **valide** aussi
   longtemps que d'anciennes installations existent : garder Zachar’t Mentale
   comme seule app publiée en release normale.

Ne rien changer tant que la version de transition n'est pas décidée : une
configuration qui n'interroge que la roulante, publiée avant que celle-ci existe,
laisserait ses utilisateurs sans mises à jour.

## Ajouter une app à la publication

1. `bun run new-app <nom>` crée `apps/<nom>` à partir de `apps/base`.
2. Ajouter **un cas** dans l'étape `pick the app from the tag` de
   `release.yml` (dossier, préfixe de tag, titre, secrets) et le motif
   `<préfixe>-v*` dans `on.push.tags`.
3. `TAG_PREFIX` de `scripts/bump-version.mjs` : seulement si le préfixe du tag
   diffère du nom du dossier.

### Activer les mises à jour signées d'une app

Une app créée depuis Base n'en a pas (`createUpdaterArtifacts: false`, pas de clé
publique) : elle ne produit ni signature ni `latest.json`.

1. Soit réutiliser la clé de Zachar’t Mentale (copier sa clé publique, voir
   Zach'Math), soit `bun tauri signer generate` (en local) et ranger la clé
   privée et son mot de passe dans deux secrets propres à l'app, **par nom**
   (et dans `release.yml` / `scripts/make-update.mjs`).
2. Dans `tauri.conf.json` de l'app : `createUpdaterArtifacts: true`,
   `plugins.updater.pubkey` (la clé publique) et `plugins.updater.endpoints`
   (l'adresse de sa release roulante).
3. Dans `release.yml`, passer `updater=true` pour l'app.
4. Remplacer les icônes copiées de Base : `bun tauri icon <image>`.
