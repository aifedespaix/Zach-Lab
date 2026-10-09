# 01 — Principes et modèle de données

## Principes

1. **Le disque local est la vérité de l'utilisateur ; le serveur est la vérité partagée.** Rien n'est
   jamais perdu en silence : en cas de doute, on garde les deux (doublon).
2. **Pas d'horloge pour décider.** Les horloges des machines divergent. On décide avec des
   *révisions* comptées par le serveur ; l'heure ne sert qu'à l'affichage (« modifié par Zach, il y a 2 h »).
3. **Un fichier = une identité stable (`id`) + un chemin (attribut).** Renommer ou déplacer ne change pas
   l'identité : ce n'est jamais « supprimé puis créé ».
4. **Jamais bloquant.** Un conflit crée un doublon immédiatement et la synchro continue.
5. **Le moteur ne connaît pas les formats.** Il manipule des fichiers opaques (texte + hash). L'app
   fournit `parse`/`validate`/`preview`.
6. **Idempotent et reprenable.** Une synchro interrompue (réseau, fermeture) peut être relancée sans effet
   de bord.

## Modèle

### Fichier (côté serveur : collection `files`)

| Champ | Rôle |
|---|---|
| `id` (`file_id`) | Identité stable, posée à la création, écrite dans le contenu du fichier (`meta.id`) |
| `app` | `zachart-mentale`, `zachart-maths`… — un serveur, plusieurs apps |
| `kind` | Type de fichier propre à l'app (`cours`, `exo`, `fiche`…) — opaque pour le moteur |
| `path` | Chemin relatif depuis le dossier de synchro de l'app |
| `content` | Le fichier entier, texte (UTF-8). Max à relever comme `TEXT_MAX` |
| `hash` | Hash du contenu (déjà `contentHash.ts`) |
| `rev` | Entier, **incrémenté par le serveur** à chaque écriture acceptée |
| `owner` | Utilisateur propriétaire de CETTE copie |
| `origin_id` | `id` du fichier d'origine si c'est une copie distribuée par un prof, sinon vide |
| `conflict_of` | `id` du fichier dont celui-ci est le doublon, sinon vide |
| `deleted_at` | Corbeille (soft-delete), sinon vide |
| `deleted_by` | Qui a supprimé (le prof peut restaurer ce que l'élève a supprimé) |
| `updated_by`, `updated` | Pour l'affichage uniquement |

Les binaires (images) restent dans `assets`, adressés par hash : jamais de doublon, la plus récente gagne.

### État local (par fichier, fichier `.sync-state.json` dans `appConfigDir`, PAS dans le dossier synchronisé)

`{ id → { base_rev, base_hash, path, dirty? } }`

- `base_rev` / `base_hash` : la dernière version serveur que ce poste a vue ET écrite sur disque.
- Un fichier est **modifié localement** si `hash(disque) ≠ base_hash`.
- Un fichier est **en avance côté serveur** si `serveur.rev > base_rev`.

### Les cinq états d'un fichier

| État | Condition | Action de la synchro |
|---|---|---|
| `synced` | ni modifié localement, ni en avance | rien |
| `local-ahead` | modifié localement, serveur inchangé | pousser (le serveur incrémente `rev`) |
| `remote-ahead` | non modifié localement, serveur en avance | tirer et écrire sur le disque |
| `conflict` | modifié localement ET serveur en avance (hash différents) | créer le doublon (voir 02) |
| `gone` | supprimé d'un côté | voir la table des cas, 02 |

Cas dégénéré utile : modifié des deux côtés mais `hash` identique → `synced` (on met juste à jour `base_rev`).

### Identité d'un fichier déposé à la main

Un fichier sans `meta.id` est « nouveau » : la synchro lui attribue un `id`, l'écrit dans le fichier,
puis le pousse. Un fichier dont l'`id` existe déjà sur le serveur avec un **autre `owner`** n'est
JAMAIS fusionné : c'est un faux `id` (copier-coller d'un fichier) → il reçoit un nouvel `id`.
