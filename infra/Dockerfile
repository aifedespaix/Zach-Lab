# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# PocketBase + le site (vitrine et applications web), dans UNE seule image.
#
# Pourquoi pas un second conteneur : PocketBase sert lui-même les fichiers
# statiques déposés dans `--publicDir` (`/pb_public` dans cette image, voir son
# `entrypoint.sh`), pour toute URL qui n'est ni `/api/…` ni `/_/…`. Déposer le
# SPA là revient donc à le publier sur le domaine qui sert DÉJÀ l'API :
#
#   - même origine, donc aucun CORS à ouvrir ;
#   - un seul port, un seul tunnel, une seule entrée à configurer ;
#   - l'application de bureau continue d'utiliser la même URL, inchangée.
#
# Un nginx séparé faisant du reverse-proxy vers PocketBase ferait exactement le
# même travail, avec un conteneur, un réseau et un fichier de configuration en
# plus, et une adresse de plus à tenir à jour.
#
# L'image de base reste ÉPINGLÉE, pour la même raison qu'avant : le script
# `setup-pocketbase.mjs` parle l'API des collections de PocketBase >= 0.23 et le
# SDK JS embarqué vise cette série. Changer cette version, c'est changer les
# deux ensemble — voir infra/README_INFRA.md.
# ---------------------------------------------------------------------------

FROM oven/bun:1.3-alpine AS build

WORKDIR /build

# Les workspaces Bun veulent tous leurs package.json pour résoudre bun.lock :
# on copie donc `apps/` et `packages/` (le .dockerignore écarte node_modules,
# src-tauri et dist), puis on n'installe que le site. `apps/zachart-mentale/src`
# est indispensable : la bibliothèque importe le code PUR de l'application de
# bureau (types des cartes, validation, sérialisation) via l'alias `@app`.
# C'est délibéré — un validateur recopié finirait par accepter ce que
# l'application refuse d'ouvrir.
COPY package.json bun.lock tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
# La table de cas des codes d'invitation : le test du site l'importe, et `astro check`
# type-vérifie les tests aussi.
COPY infra/fixtures ./infra/fixtures
RUN bun install --frozen-lockfile --filter site

# `bun run build` = `astro check && astro build && check-dist` : la construction
# ÉCHOUE sur une erreur de types, une route manquante ou un <script> dans la vitrine.
RUN cd apps/site && bun run build

FROM ghcr.io/muchobien/pocketbase:0.40.3

# Servi à la racine du domaine pour tout ce qui n'est pas `/api/…` ni `/_/…`.
COPY --from=build /build/apps/site/dist /pb_public

# Les hooks JavaScript de PocketBase (inscription par code, garde de suppression).
# `--hooksDir=/pb_hooks` dans l'entrypoint.sh de l'image de base.
COPY infra/pb_hooks /pb_hooks
