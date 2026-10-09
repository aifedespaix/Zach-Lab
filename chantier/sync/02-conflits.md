# 02 — Conflits : tous les cas, et le doublon

## Table des cas

`L` = poste local, `S` = serveur. « Modifié » = différent de la dernière version vue (`base_rev`/`base_hash`).

| # | Situation | Réponse |
|---|---|---|
| 1 | L modifié, S inchangé | Pousser |
| 2 | L inchangé, S modifié | Tirer (avance rapide) |
| 3 | L et S modifiés, contenus **identiques** | `synced`, mettre à jour `base_*` |
| 4 | L et S modifiés, contenus différents | **Doublon** (voir plus bas) |
| 5 | L supprimé, S inchangé | Corbeille côté S (`deleted_by` = utilisateur). Élève : définitif sauf restauration par le prof. Prof : restaurable 30 j |
| 6 | L supprimé, S modifié | Le fichier **revient** sur L (la modif de l'autre prime sur une suppression) + bandeau « supprimé ici, mais modifié par X : conservé » |
| 7 | L modifié, S supprimé | Si le supprimeur est le **prof** : L est conservé, republié comme **nouveau fichier** (nouvel `id`, propriétaire L) — la suppression est annoncée. Si c'est l'élève sur sa propre copie : ne se produit pas (un seul propriétaire) |
| 8 | L inchangé, S supprimé | Supprimer sur L (vers la corbeille système si possible) |
| 9 | L déplacé/renommé, S contenu modifié | Appliquer les deux : le chemin et le contenu sont indépendants |
| 10 | L et S déplacés vers des chemins différents | Le serveur gagne sur le chemin ; pas de doublon (le contenu est identique) ; information discrète |
| 11 | Deux créations au même chemin, `id` différents | Les deux existent : le second reçoit le suffixe ` (2)` ; jamais d'écrasement |
| 12 | Même `id`, propriétaires différents | Faux `id` : nouvel `id` pour le fichier entrant (voir 01) |
| 13 | Fichier supprimé puis recréé au même chemin | Nouvel `id` : c'est un autre fichier |
| 14 | Contenu invalide d'un côté (JSON cassé) | Jamais poussé : le fichier est marqué « invalide », l'utilisateur est averti, le serveur garde sa version |
| 15 | Hors ligne | Les modifications restent `local-ahead` ; reprise à la reconnexion. Le conflit est alors détecté comme 4 |
| 16 | Interruption en cours de synchro | Chaque fichier est traité indépendamment et son état n'est enregistré qu'après succès |
| 17 | Dossier de synchro changé / vidé | Avertissement avant toute suppression de masse (garde « > N suppressions d'un coup ») |
| 18 | Prof met à jour un cours que l'élève a modifié | Cas 4, sur la copie de l'élève (la copie est un fichier à part entière, voir 03) |
| 19 | Image / binaire | Adressage par hash : pas de doublon, pas de conflit |

La garde du cas 17 est essentielle : un dossier monté de travers ne doit jamais vider le serveur.

## Le doublon

Quand le cas 4 survient, **la version du serveur garde le fichier d'origine** (même `id`, même chemin) et
**la version locale devient un nouveau fichier** :

- nouveau `id`, `conflict_of = <id d'origine>`, même `owner` que le fichier d'origine pour l'élève
  (le doublon vit dans la copie de l'élève) ;
- chemin : `<nom> (conflit – <utilisateur> – JJ-MM HHhMM).<ext>` dans le même dossier ;
- il est poussé comme un fichier normal : l'autre partie (le prof) le voit aussi ;
- c'est **le fichier de l'utilisateur qui se met à l'écart, jamais celui de l'autre** : l'utilisateur ne
  perd rien et ne détruit rien de ce qui lui est arrivé.

Cycle de vie :

1. Le doublon est marqué (`conflict_of`) : badge dans l'arbre, groupé avec l'original, bandeau
   « N conflits à examiner » (`useAppStatus`).
2. L'utilisateur fusionne **à la main** (copier ce qu'il veut d'un fichier vers l'autre) ou tranche.
3. Il **renomme** le doublon → `conflict_of` est retiré, c'est un fichier à part entière.
4. Ou il le **supprime** → corbeille normale. Un rappel doux (« 3 doublons de plus de 14 jours ») ; **aucune
   suppression automatique, jamais**.

## Écran de résolution

Une modale partagée, deux colonnes (« Ma version » / « La version de X, le … »), trois actions :

| Action | Effet |
|---|---|
| Garder la mienne | La mienne remplace l'original ; le doublon est supprimé |
| Garder l'autre | Le doublon est supprimé (original intact) |
| Garder les deux | Le doublon est renommé (devient un fichier à part) |

L'affichage des deux versions est fourni par l'app (`renderPreview`, slot) : une carte mentale et une fiche
de maths ne se comparent pas pareil. À défaut, comparaison texte brute. Ouvrir le doublon dans l'éditeur
normal reste possible à tout moment (la fusion manuelle se fait là).

## Migration de l'existant (Mentale)

| Aujourd'hui | Devient |
|---|---|
| `mergeCards` : la version distante gagne, les cartes locales en trop deviennent des cartes volantes | Supprimé : le doublon porte tout (aucune carte perdue, aucune carte « volante » à comprendre) |
| `meta.copyLink` + « Créer une copie » | `conflict_of` / `origin_id` (alias de lecture : un ancien `copyLink` est lu et réécrit) |
| collection `sync_conflicts` | Plus nécessaire (le conflit EST le doublon) ; journal de synchro (`sync_events`) conservé |
| `deleted-remote` / `deleted-local` | Cas 5–8 de la table |
