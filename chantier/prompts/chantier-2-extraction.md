# Prompt générique — Chantier 2 : extraction d'un lot dans `packages/shared`

> Copie tout ce qui suit la ligne `---` dans une nouvelle session Claude Code ouverte à la racine du dépôt.
> Variable : `LOT` (ex. `L3`). Si tu la laisses vide, la session prend le prochain lot éligible de `chantier/suivi.md`.

---

Tu travailles sur le dépôt Zach-Lab (monorepo Bun + Cargo : `apps/base`, `apps/zachart-maths`,
`apps/zachart-mentale`, `packages/shared`, `crates/suite-tauri`). Lis d'abord `CLAUDE.md` à la racine : ses règles
(« `shared` n'importe jamais une app », entrées publiques, imports relatifs dans `shared`, `@source` Tailwind,
pas de `git add -A`, ne jamais toucher `.cours/` ni `.cartes-mentales/`) s'appliquent à tout ce que tu écris.

## Mission
Réaliser la partie **EXTRACTION (chantier 2)** du lot **`LOT`** du chantier « Harmonie » : créer dans `packages/shared`
les composants, hooks, ports et utilitaires communs décrits par le lot, les brancher dans `apps/base`, et les couvrir de tests.
Tu **ne migres pas** encore Zach'Math ni Zachar't Mentale (c'est le chantier 3), sauf ce que le lot déclare explicitement
comme préalable à l'extraction.

## Étapes

1. **Orientation** (lecture seule, ne saute rien)
   - `chantier/README.md` (règles du chantier, définition des « 95 % »).
   - `chantier/suivi.md` : détermine `LOT` s'il est vide ; **vérifie que ses dépendances sont `terminé`**. Sinon, arrête-toi et dis lesquelles manquent.
   - `chantier/lots/Lxx-….md` du lot : objectif, fichiers à lire, « Chantier 2 — extraction », tests, pièges, critères d'achèvement.
   - `chantier/08-architecture-cible.md` (API cibles) et la/les zone(s) du lot (`03` à `06`).
   - `chantier/07-decisions-ux.md` : les décisions listées par le lot. Une décision non cochée n'est **pas** bloquante : applique la recommandation et note-la dans `chantier/suivi.md` (colonne « décisions par défaut »).
   - `chantier/09-non-regression.md` : règles de migration et filet.
   - Si le dépôt a un graphe (`graphify-out/graph.json`), interroge-le avant de grepper à l'aveugle.
2. **État de référence** : `bun install --frozen-lockfile` si `node_modules` est absent, puis `bun run test` et `bunx tsc --noEmit -p packages/shared`. Les résultats doivent correspondre à `suivi.md` ; sinon signale l'écart avant de commencer.
3. **Lis tous les fichiers sources que le lot cite** (les deux versions quand elles divergent). Écris, dans ta réponse, le tableau « ce que fait chaque version / ce que je garde / pourquoi » avant de coder.
4. **Conçois l'API** en suivant `08-architecture-cible.md` : config / slots / ports, hook headless + composants composés, pas de `if (app === …)`, pas de composant à plus de ~15 props. Tu peux ajuster les types de l'esquisse, pas ses responsabilités ; note toute entorse dans le journal de `07-decisions-ux.md`.
5. **Écris les tests d'abord** pour les « Pièges » du lot et pour la compatibilité des données (anciennes clés, anciens formats). Puis implémente.
6. **Branche `apps/base`** pour que la fonctionnalité soit utilisable dans l'app de base (elle doit rester ≤ 150 lignes hors tests à la fin du chantier : si tu ajoutes plus que de la configuration dans `base`, c'est que le code appartient à `shared`).
7. **Ajoute les entrées au test de conformité** (`describeAppContract`, `@suite/shared/testing`) que le lot demande d'activer ; elles passent sur `base`. (Maths et Mentale les activeront au chantier 3 ; laisse-les `skip` avec le numéro du lot.)
8. **Vérifie** : `bun run test`, `bunx tsc --noEmit` sur `packages/shared` et `apps/base`, les tests de frontière, `bun run measure:sharing` (si le lot L0 est fait). Aucune régression sur Maths/Mentale (leurs suites doivent rester vertes puisqu'elles ne sont pas encore migrées).
9. **Documente** : mets à jour la section concernée de `CLAUDE.md`, passe le lot à `extrait` dans `chantier/suivi.md` (tests, mutualisation, notes), ajoute les décisions prises au journal de `07-decisions-ux.md`.
10. **Commit** : un commit par étape logique, message à l'impératif en français ou anglais selon l'historique du dépôt, avec les lignes d'attribution demandées par la session. `git add` avec des chemins explicites (jamais `-A`). Pousse sur la branche désignée par la session. **Pas de pull request** sans demande.

## Garde-fous
- Ne renomme aucun identifiant persistant (clé de stockage, id de commande, nom de fichier de config, format de fichier) sans alias/lecture rétro-compatible testée.
- Ne supprime ni n'assouplis aucun test existant. Un test qui échoue est un signal, pas un obstacle.
- Si le lot révèle que son périmètre est faux (le code réel diffère de l'analyse), **arrête-toi, explique l'écart et propose la correction du lot** dans `chantier/lots/` plutôt que d'improviser.
- Si une décision UX demande ton arbitrage et change visiblement l'interface au-delà de ce que le lot décrit, demande avant d'agir.
- N'ajoute aucune dépendance npm/cargo sans l'écrire dans le journal du lot et la justifier.

## Compte rendu final (obligatoire, court)
Lot traité · ce qui a été créé dans `shared` (modules + API en 5 lignes) · tests ajoutés / total avant→après · mesure `base` avant→après · décisions prises par défaut · points ouverts pour le chantier 3.

## Avancement global (obligatoire, après le compte rendu du lot)
Lis `chantier/prompts/avancement-global.md` et produis le tableau de bord de TOUS les chantiers (Harmonie, Ajustements, Synchro), avec le prochain lot et le modele conseille.
