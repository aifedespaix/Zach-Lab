# Publier une app de la suite

Chaque app a **sa version, son tag et sa release**. Un tag pousse le workflow
`.github/workflows/release.yml`, qui construit l'app que ce tag désigne.

| App | Dossier | Tag | Release GitHub | Mises à jour signées |
|---|---|---|---|---|
| Zachar’t Mentale | `apps/zachart-mentale` | `zachart-vX.Y.Z` | normale | oui |
| Base | `apps/base` | `base-vX.Y.Z` | **pré-release** | non (pas encore de clé) |

Les anciens tags `v1.2.3` restent en place ; ils ne relancent rien.

## Publier une version

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

## Les secrets de signature

Ils se créent dans les réglages du dépôt GitHub (jamais dans le code, jamais
dans une discussion) et sont choisis **par nom** selon l'app :

| App | Clé privée | Mot de passe |
|---|---|---|
| Zachar’t Mentale | `TAURI_SIGNING_PRIVATE_KEY` | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| Base | `TAURI_SIGNING_PRIVATE_KEY_BASE` | `TAURI_SIGNING_PRIVATE_KEY_BASE_PASSWORD` |

Une clé par app : la fuite de l'une ne permet pas de signer les mises à jour des
autres. Zachar’t Mentale garde les noms d'origine pour que sa publication
continue de fonctionner sans rien changer.

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

Le workflow alimente déjà `updater-zachart` à chaque release de Zachar’t
Mentale ; **la configuration, elle, interroge encore l'ancienne adresse**
(`apps/zachart-mentale/src-tauri/tauri.conf.json`, et le test
`packaging.test.ts` qui la fige). Basculer est une décision à part, en deux temps :

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

1. `bun tauri signer generate` (en local) ; ranger la clé privée et son mot de
   passe dans les deux secrets de l'app (voir plus haut), **par nom**.
2. Dans `tauri.conf.json` de l'app : `createUpdaterArtifacts: true`,
   `plugins.updater.pubkey` (la clé publique) et `plugins.updater.endpoints`
   (l'adresse de sa release roulante).
3. Dans `release.yml`, passer `updater=true` pour l'app.
4. Remplacer les icônes copiées de Base : `bun tauri icon <image>`.
