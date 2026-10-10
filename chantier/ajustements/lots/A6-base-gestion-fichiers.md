# A6 — Base : gestion de fichiers complète + synchro configurable

**Taille** : L · **Dépend de** : L6, L7, L8 (et A1, A2, A3b) · **Modèle** : Sonnet

## Objectif
`apps/base` = le modèle de toute nouvelle app : **arbre de fichiers/dossiers, création, renommage, suppression, déplacement, récents, recherche (avancée), réglages, historique**. C'est la version de Mentale (la plus complète) corrigée par l'UX de Maths (D05–D08 : renommage en ligne `F2`, duplication immédiate, suppression avec résumé, pied standard). Tout vient de `shared` ; `base` garde sa config + sa zone de texte (≤ 150 lignes, voir README Harmonie).

## Contenu
- Si L6/L7/L8 sont faits, presque rien à écrire : **vérifier** que `base` expose tout (contrat `describeAppContract` complet, plus aucun `todo`) et combler les trous dans `shared`.
- **Port de synchro** `SyncPort` (`@suite/shared/files`, ou l'entrée créée par le chantier Synchro) : `{ status$, push(path), pull(), resolveConflict?, onRename? }`, **optionnel** dans `defineApp({ sync })`. Absent = aucune UI de synchro. Fourni : `SyncStatusBadge` rendu seulement si `sync` est défini. Pas d'implémentation PocketBase ici : le chantier Synchro (`../../sync/`) fournira l'adaptateur ; Mentale garde sa synchro propre d'ici là (CLAUDE.md).
- `new-app` : le gabarit embarque cette config ; le README de `scripts/new-app` dit où brancher la synchro.
- Test : adaptateur de synchro **factice** (mémoire) prouvant le contrat, dont « renommage serveur pendant l'édition » (piège L6 n°1).

## Critères d'achèvement
- [ ] `bun run new-app essai` produit une app avec arbre, création, renommage, recherche, réglages, annuler/rétablir
- [ ] `sync` absent = aucune trace de synchro ; présent = badge + hooks appelés (test)
- [ ] `measure:sharing` base ≥ 95 %, `apps/base/src` ≤ 150 lignes hors tests
