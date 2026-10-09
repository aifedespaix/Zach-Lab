# Suivi des lots

Fichier lu **et mis à jour** par les prompts `prompts/chantier-2-extraction.md` et `prompts/chantier-3-migration.md`.
Un lot passe de `à faire` → `extrait` (chantier 2 fini) → `migré Maths` → `migré Mentale` → `terminé`.
Ne jamais sauter un état. Le « prochain lot » = le premier de la liste, dans l'ordre ci-dessous, qui n'est pas `terminé`
et dont les dépendances le sont.

## État de référence

Voir `09-non-regression.md` §1 : 3 547 tests (shared 554, base 10, Maths 647, Mentale 2 336) + admin 179 + scripts 89.
Mesure de mutualisation de `base` au départ : *à relever au L0* (`bun run measure:sharing`).

## Lots

| Lot | Titre | Taille | Dépend de | Fichier | État | Tests (après) | Mutualisation `base` | Notes / décisions par défaut |
|---|---|---|---|---|---|---|---|---|
| L0 | Socle et filet | M | — | [lots/L00-socle-et-filet.md](lots/L00-socle-et-filet.md) | à faire | | | |
| L1 | Commandes | M | L0 | [lots/L01-commandes.md](lots/L01-commandes.md) | à faire | | | |
| L2 | Persistance | M | L0 | [lots/L02-persistance.md](lots/L02-persistance.md) | à faire | | | |
| L3 | Cadre et démarrage | L | L1, L2 | [lots/L03-cadre-et-demarrage.md](lots/L03-cadre-et-demarrage.md) | à faire | | | |
| L4 | Barre du haut | L | L1, L3 | [lots/L04-barre-du-haut.md](lots/L04-barre-du-haut.md) | à faire | | | |
| L5 | Vue : zoom, densité, police | M | L2, L3, L4, S1 | [lots/L05-vue-zoom-densite.md](lots/L05-vue-zoom-densite.md) | à faire | | | |
| L6 | Fichiers, historique, accueil | L | L1–L4 | [lots/L06-fichiers-historique-accueil.md](lots/L06-fichiers-historique-accueil.md) | à faire | | | |
| L7 | Panneaux latéraux | L | L1, L2, L4 | [lots/L07-panneaux.md](lots/L07-panneaux.md) | à faire | | | |
| L8 | Arbre de fichiers | XL (3 passes) | L1, L2, L6, L7 | [lots/L08-arbre.md](lots/L08-arbre.md) | à faire | | | |
| L9 | Contenu éditable | M | L6 | [lots/L09-contenu-editable.md](lots/L09-contenu-editable.md) | à faire | | | |
| L10 | Plateforme Rust / scripts | M | L3, L5 | [lots/L10-plateforme-rust-scripts.md](lots/L10-plateforme-rust-scripts.md) | à faire | | | |
| L11 | Clôture | S | tous | [lots/L11-cloture.md](lots/L11-cloture.md) | à faire | | | |

L'ordre L5 / L6 / L7 peut être permuté (pas de dépendance entre eux) si l'utilisateur veut voir en premier la barre
de gauche ou la zone de droite ; L8 attend L6 et L7.

## Décisions UX

Voir `07-decisions-ux.md`. Décisions non validées au démarrage d'un lot : prises **par défaut (recommandation)** et listées ici.

| Décision | Statut | Lot où elle a été appliquée par défaut |
|---|---|---|
| D01 à D19 | à valider | |

## Journal

| Date | Lot | Événement |
|---|---|---|
| 2026-10-09 | — | Chantier 1 (analyse) terminé : `chantier/` créé, état de référence relevé. |
