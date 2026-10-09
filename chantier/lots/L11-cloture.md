# L11 — Clôture : mesure, nettoyage, documentation

**Taille** : S · **Dépend de** : tous les autres · **Fonctionnalités** : toutes · **Décisions** : retrait des alias

## Objectif
Vérifier la cible (95 %), supprimer ce qui ne sert plus, figer la documentation.

## À faire
1. `bun run measure:sharing` : consigner le chiffre final de `base` dans `suivi.md` ; si < 95 %, lister dans `suivi.md` ce qui manque et ouvrir un lot L12 (ne pas truquer la mesure).
2. `apps/base/src` ≤ 150 lignes hors tests, `App.tsx` sans logique (README du chantier).
3. Retirer les **façades** et exports de transition restants ; supprimer le code mort (outil : `bunx knip` ou recherche d'exports inutilisés, à valider avant suppression).
4. **Alias de commandes** : les garder. (Ils protègent les raccourcis des élèves qui n'ont pas lancé l'app depuis longtemps.) Les retirer seulement par décision explicite, jamais ici.
5. `CLAUDE.md` : réécrire l'ensemble pour refléter l'état final ; supprimer les passages « Mentale n'utilise que… », « trop spécifique pour migrer » ; décrire `defineApp`, `<SuiteApp>`, les ports, le test de conformité.
6. Mettre à jour le graphe : `graphify update .`.
7. Relire `07-decisions-ux.md` : cocher le journal ; consigner les décisions prises par défaut.
8. Vérifier un **parcours bout en bout** dans chaque app (checklist de `09-non-regression.md` §Parcours).
9. Préparer la version : `docs/RELEASE.md` (le chantier touche les trois apps ; version mineure recommandée). Ne publie rien tant que l'utilisateur ne l'a pas demandé.

## Critères d'achèvement
- [ ] Mesure ≥ 95 % consignée
- [ ] Zéro façade de transition
- [ ] CLAUDE.md réécrit, graphe mis à jour
- [ ] Tous les parcours manuels validés par l'utilisateur
