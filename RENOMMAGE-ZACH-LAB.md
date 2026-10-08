# Renommer le dépôt en Zach'Lab

> Note personnelle, destinée à toi. Supprime ce fichier quand le renommage est fait.

Ce commit ne renomme rien : il change le README (marque Zach'Lab, logo, captures) et ajoute ce guide.
Le dépôt s'appelle toujours `aifedespaix/Zachar-t-Mentale`, et les adresses techniques du code
pointent encore dessus. Tant que tu ne renommes pas sur GitHub, tout continue de fonctionner.

## Ce qui a changé dans ce commit

- `README.md` réécrit : logo, téléchargements, concept, présentation des deux logiciels, puis Open Source,
  programmation, déploiement et outils.
- `docs/images/` : le logo (`zachlab-logo.svg`, le Z de Zachar't Mentale) et trois captures de l'app web
  avec des données d'exemple (carte mentale, fiche de maths, équation).
- Rien d'autre : aucun code, aucune URL, aucune version modifiée.

---

## 1. Renommer le dépôt sur GitHub

1. Sur `github.com/aifedespaix/Zachar-t-Mentale` : **Settings → General → Repository name**.
2. Mets **`Zach-Lab`**. L'apostrophe n'est pas autorisée dans un nom de dépôt GitHub : le nom
   lisible reste « Zach'Lab » dans le README, et l'adresse devient `github.com/aifedespaix/Zach-Lab`.
3. Dans le même écran, mets la description du dépôt (« Suite de logiciels éducatifs… ») si tu veux.

## 2. Mettre à jour ton clone local

```bash
git remote set-url origin https://github.com/aifedespaix/Zach-Lab.git
git remote -v        # vérifie
```

Le dossier local peut garder son nom, cela ne change rien à git.

## 3. Vérifier que les anciennes adresses redirigent

GitHub redirige l'ancien nom vers le nouveau. Vérifie après le renommage, c'est la base de tout le reste :

```bash
curl -sIL https://github.com/aifedespaix/Zachar-t-Mentale/releases/latest/download/latest.json | grep -i '^HTTP\|^location'
curl -sIL https://github.com/aifedespaix/Zachar-t-Mentale/releases/download/updater-zachart/latest.json | grep -i '^HTTP'
```

Tu dois voir des redirections (`301`/`302`) puis un `200` sur `Zach-Lab`. Si ce n'est pas le cas, ne
passe pas à l'étape 4 : les mises à jour des installations existantes en dépendent.

## 4. Mettre à jour les adresses dans le code

Liste exacte des endroits (on a vérifié avec `grep`) :

| Fichier | Quoi |
|---|---|
| `apps/zachart-mentale/src-tauri/tauri.conf.json` (lignes 59-60) | `plugins.updater.endpoints` : les deux adresses de mise à jour |
| `apps/zachart-maths/src-tauri/tauri.conf.json` (ligne 43) | `plugins.updater.endpoints` de Zach'Math |
| `apps/zachart-mentale/src/test/packaging.test.ts` (lignes 104-105) | fige ces deux adresses : **à changer dans le même commit** que `tauri.conf.json`, sinon le test casse |
| `scripts/make-update.mjs` (ligne 26) | constante `REPO` (commandes `gh` affichées par `update:*`) |
| `scripts/deploy.mjs` (ligne 15) | `REPO_URL` |
| `scripts/make-update.test.mjs` (ligne 149) | exemple d'adresse dans une fixture (cosmétique, mais autant être propre) |
| `README.md` | liens de téléchargement et de releases |
| `docs/RELEASE.md` | plusieurs passages (adresses `updater-*`, `latest.json`, dépôt) |

Pour retrouver tout ce qui reste (hors historique `docs/superpowers/`, à laisser tel quel) :

```bash
grep -rn "Zachar-t-Mentale" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=superpowers .
```

Remplacement une fois la liste relue (sur Linux/macOS ; sous Windows, fais-le à la main ou dans l'éditeur) :

```bash
grep -rl "aifedespaix/Zachar-t-Mentale" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=superpowers . \
  | xargs sed -i 's#aifedespaix/Zachar-t-Mentale#aifedespaix/Zach-Lab#g'
```

Puis valide avant de commit :

```bash
bun run test:all
```

**Ne touche pas** à la clé publique (`pubkey`) ni à l'identifiant d'app : ils ne dépendent pas du dépôt.

## 5. Commit et version

Le changement d'adresse de mise à jour part avec la **prochaine version** publiée (`bun run deploy`).
Respecte les règles de `docs/RELEASE.md` : la version doit être **supérieure** à celle des installations
existantes, sinon elles ne la voient pas. Les installations actuelles gardent l'ancienne adresse, qui
redirige : elles continuent de se mettre à jour.

---

## Conséquences du renommage

**Ce qui continue de marcher sans rien faire**

- Les installations déjà distribuées : leur adresse de mise à jour est codée en dur dans le binaire, mais GitHub
  la redirige. Les signatures ne dépendent que de la clé, pas de l'adresse : rien à re-signer.
- Les liens de téléchargement du README et les adresses `releases/latest/download/…`, grâce à la redirection.
- Les releases, les tags, les issues, les pull requests, les étoiles, les forks et l'historique git.
- Les secrets et les variables du dépôt (`TAURI_SIGNING_PRIVATE_KEY`, `PRUNE_OLD_RELEASES`…).
- Les workflows GitHub Actions : aucun ne contient le nom du dépôt en dur (vérifié).
- Le serveur de synchronisation (voir ci-dessous).

**Ce qu'il faut savoir**

- **Ne recrée jamais un dépôt nommé `Zachar-t-Mentale`.** Si le nom redevient libre, la redirection tombe et les
  installations existantes ne trouvent plus leurs mises à jour. C'est le seul vrai risque du renommage.
- Les intégrations configurées avec l'ancien nom (application GitHub de Claude, accès d'un outil, badge, lien
  externe, documentation d'un tiers) : à revérifier une par une. La redirection couvre les liens web, pas
  toujours les configurations.
- Les adresses écrites dans `docs/superpowers/` restent anciennes : c'est de l'historique, c'est voulu.

## Production : faut-il changer quelque chose ?

- **Le serveur de synchronisation** (PocketBase, sur `cartes.mon-domaine.fr`, voir
  `apps/zachart-mentale/infra/README_INFRA.md`) **ne dépend pas du nom du dépôt.** Son image vient de
  `ghcr.io/muchobien/pocketbase`, et le workflow `infra-pocketbase.yml` se déclenche sur des chemins de fichiers.
  Rien à changer là-dedans.
- **Seulement si ton hébergeur déploie depuis l'URL Git** (Coolify, Dokploy, Portainer, un webhook…), mets-y la
  nouvelle adresse `https://github.com/aifedespaix/Zach-Lab`. Les déploiements déjà en place ne bougent pas.
- L'adresse de synchronisation saisie dans les réglages de Zachar't Mentale est celle du serveur, pas de GitHub :
  elle ne change pas.

## Le nom « Zach'Lab » dans les applications

Ce commit ne change **pas** le nom des logiciels : Zachar't Mentale et Zach'Math restent leurs noms, et Zach'Lab
est le nom de la suite. C'est volontaire :

- **Ne change jamais l'identifiant** (`com.clape.zachart-mentale`, `com.clape.zachart-maths`) : c'est lui qui
  désigne le dossier de données de l'élève. Le changer ferait perdre ses cartes et ses réglages.
- Changer le `productName` (le nom affiché, dans le menu Démarrer) change le dossier d'installation et le raccourci :
  c'est une décision à part, qui se publie comme une version. À faire seulement si tu le veux vraiment.

## À faire à côté (Open Source)

- **Choisir une licence** et ajouter un fichier `LICENSE` à la racine. Tant qu'il n'existe pas, le README le dit :
  aucune réutilisation n'est autorisée par défaut.
- Mettre une image d'aperçu sociale (`Settings → General → Social preview`) : elle doit être en PNG, par exemple le
  logo sur fond uni, exporté depuis `docs/images/zachlab-logo.svg`.
- Ajouter quelques *topics* au dépôt (`education`, `tauri`, `react`, `mind-map`, `maths`).

---

Quand tout est fait et vérifié, supprime ce fichier : `git rm RENOMMAGE-ZACH-LAB.md`.
