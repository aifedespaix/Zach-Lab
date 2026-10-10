# Prompt générique Chantier « Ajustements » : traiter un lot A

> Copie tout ce qui suit la ligne `---` dans une nouvelle session Claude Code ouverte à la racine du dépôt. Variable : `LOT` (ex. `A0`).
> Vide = prochain lot `à faire` de `chantier/ajustements/suivi.md` dont les dépendances sont terminées.
> Modèle conseillé : voir `chantier/ajustements/README.md` (tableau « Quel modèle »).

---

Tu travailles sur le dépôt Zach-Lab (monorepo Bun + Cargo). Lis d'abord `CLAUDE.md` racine : ses règles s'appliquent (frontière `shared`/apps,
entrées publiques, pas de `git add -A`, ne jamais toucher `.cours/` ni `.cartes-mentales/`, ne rien publier).

## Mission
Réaliser le lot **`LOT`** du chantier « Ajustements » (`chantier/ajustements/lots/`). Les exigences ajoutées aux lots Harmonie
(`chantier/ajustements/ajouts-aux-lots.md`) ne se traitent PAS ici, mais dans leur lot L : ne les fais que si le lot demandé les cite.

## Étapes
1. **Orientation** (lecture seule) : `chantier/ajustements/README.md`, `chantier/ajustements/suivi.md` (le lot est `à faire` et ses dépendances `terminé`,
   sinon arrête-toi et dis lequel manque), le fichier du lot, puis `chantier/README.md` (règles du chantier : règle de deux, config/slots/ports),
   `chantier/07-decisions-ux.md`, `chantier/09-non-regression.md`. Interroge `graphify-out/graph.json` avant de grepper à l'aveugle.
2. **Vérifie l'état réel** : `git status`, branche courante, `bun install --frozen-lockfile`, `bun run test` pour connaître la base verte. Ne commence pas sur un rouge non expliqué.
3. **Bug ou comportement** : écris le test qui échoue d'abord (`superpowers:test-driven-development`) ; pour un bug, établis la cause avant de corriger (`superpowers:systematic-debugging`).
4. **Implémente** minimalement, dans `packages/shared` quand c'est commun (jamais de `if (app === …)`), clés de stockage / ids de commande / formats de fichier conservés ou aliasés.
5. **Vérifie** : `bun run test`, `bunx tsc --noEmit` sur chaque workspace touché, `boundary.test.ts`. Tu ne déclares rien « fait » sans avoir lu la sortie.
6. **Documente** : section concernée de `CLAUDE.md`, état du lot dans `chantier/ajustements/suivi.md` (+ journal), décision par défaut prise → `07-decisions-ux.md`.
7. **Commits** : un par étape logique, messages avec les lignes d'attribution demandées par la session, jamais `git add -A`. Pas de PR ni de bump sans demande.

## Garde-fous
- Besoin hors périmètre → `suivi.md` Notes, pas dans le code. Décision produit non prévue → arrête-toi sur ce point, propose deux options avec une recommandation, continue le reste.
- Données utilisateur jamais migrées en silence ; tout ancien format lu est testé avec une fixture.
- Sous-agents autorisés pour la lecture/l'audit (consigne : graphe d'abord) ; l'écriture de code reste dans le fil principal sauf fichiers disjoints.

## Compte rendu final (obligatoire, court)
Lot traité · fichiers créés/modifiés/supprimés · tests avant→après · décisions appliquées · changements visibles · parcours manuels à faire par l'utilisateur · points ouverts.
**Puis, obligatoirement : le bloc « AVANCEMENT GLOBAL » défini dans `chantier/prompts/avancement-global.md`** (lis ce fichier et applique-le tel quel).
