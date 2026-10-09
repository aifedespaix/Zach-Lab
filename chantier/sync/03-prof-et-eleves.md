# 03 — Prof et élèves

## Comptes

- Le **prof** s'inscrit sur le site (admin web existant, `apps/zachart-mentale/admin/`, à élargir) et
  **crée ses élèves** : identifiant + mot de passe. Chaque élève a un `teacher` (relation vers le prof).
- Le prof donne les identifiants aux élèves, ou configure lui-même leur machine (URL serveur + identifiants).
- Le prof a la main sur ses élèves : créer, réinitialiser un mot de passe, désactiver, supprimer.
- Un élève n'appartient qu'à un prof (v1). Un prof ne voit jamais les élèves d'un autre prof.

## Le principe qui simplifie tout : une copie par élève

Un prof ne partage pas **un** fichier avec N élèves. Il **distribue** : le serveur crée **une copie
indépendante par élève cible**, liée à l'original par `origin_id`.

| Conséquence | Détail |
|---|---|
| Aucun conflit entre élèves | Chaque copie a un seul propriétaire |
| Un conflit possible seulement prof ↔ élève, **par copie** | Cas 4/18 : le prof met à jour son cours alors que l'élève a modifié sa copie |
| L'élève peut lire, améliorer, faire les exercices | Il écrit dans SA copie sans risque pour les autres |
| Ajouter un élève cible après coup | Crée simplement une nouvelle copie |
| Retirer un élève cible | La copie de l'élève n'est PAS supprimée (elle est à lui) ; elle cesse de recevoir les mises à jour du prof |

### Mettre à jour un cours déjà distribué

Le prof modifie l'original puis « Mettre à jour les copies ». Pour chaque copie :

- non modifiée par l'élève → avance rapide (cas 2) ;
- modifiée par l'élève → **doublon** dans sa copie (cas 4) : la nouvelle version du prof prend la place
  d'origine, la version de l'élève est conservée à côté, marquée.

Le prof décide s'il met à jour automatiquement ou à la demande (réglage par fichier, défaut : à la demande).

## Droits

| Action | Élève (sur sa copie) | Prof (sur ses fichiers) | Prof (sur la copie d'un élève) |
|---|---|---|---|
| Lire | oui | oui | oui |
| Modifier le contenu | oui | oui | oui |
| Renommer / déplacer | oui | oui | oui |
| Supprimer | oui (corbeille serveur) | oui | oui |
| **Annuler une suppression** | **non** | oui | **oui** |
| Choisir les destinataires | — | oui | — |
| Voir les copies des autres élèves | non | — | oui (ses élèves) |

Ces règles sont écrites **une seule fois**, dans le schéma PocketBase (règles de collection) ET dans
`permissions.ts` partagé (pour que l'interface n'offre pas un geste que le serveur refuserait — même
leçon que `canReorder`). Source unique : la même fonction pure `can(action, actor, file)` testée contre
la table ci-dessus.

## Suppression asymétrique

- L'élève supprime sa copie → `deleted_at`/`deleted_by` posés ; la copie quitte son poste.
- Le prof voit « supprimé par Léa, le … » dans une vue **Corbeille** (filtrable par élève) et peut
  **restaurer** : la copie revient chez l'élève à sa prochaine synchro, avec un bandeau explicatif.
- L'élève ne peut ni voir ni restaurer la corbeille des autres ; il voit la sienne (30 jours) pour une
  restauration que **seul le prof** peut valider : la corbeille de l'élève lui permet de *demander* (hors
  v1 si trop lourd : en v1, restauration par le prof uniquement).
- Purge définitive : après 30 jours, par le serveur.

## Vue du prof

- Une seule arborescence (le dossier de synchro de l'app), mais chaque copie d'élève apparaît sous
  `Élèves/<prénom>/…` (ou à plat avec une colonne « élève »).
- **Filtre par élève** (multi-sélection) en tête de l'arbre ; badge « à corriger » / « modifié depuis ta
  dernière visite » par élève.
- Le prof edite directement les copies (correction), avec les mêmes règles de conflit.
- Les données ne sont **téléchargées que pour les élèves cochés** (réglage « suivre ces élèves »), pour
  ne pas rapatrier 30 copies de tout sur un poste.

## Volume (un prof, plusieurs élèves)

- Synchro **incrémentale** : on interroge le serveur sur `rev > dernier_rev_vu` (liste de fichiers
  `id, rev, hash`), pas le contenu. On ne tire que ce qui a changé.
- Abonnement temps réel PocketBase en option plus tard ; la v1 est « à l'ouverture + au clic + toutes les
  N minutes » (réglage existant `autoSyncIntervalMinutes`).
