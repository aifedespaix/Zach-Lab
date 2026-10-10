# Prompt générique — Chantier 3 : migrer Zach'Math puis Zachar't Mentale sur le commun

> Copie tout ce qui suit la ligne `---` dans une nouvelle session Claude Code ouverte à la racine du dépôt.
> Variable : `LOT` (ex. `L3`), qui doit être à l'état `extrait` dans `chantier/suivi.md`. Vide = prochain lot `extrait`.

---

Tu travailles sur le dépôt Zach-Lab (monorepo Bun + Cargo). Lis d'abord `CLAUDE.md` à la racine : ses règles s'appliquent
(frontière `shared`/apps, entrées publiques, pas de `git add -A`, ne jamais toucher `.cours/` ni `.cartes-mentales/`).

## Mission
Réaliser la partie **MIGRATION (chantier 3)** du lot **`LOT`** : faire en sorte que **Zach'Math** (`apps/zachart-maths`) puis
**Zachar't Mentale** (`apps/zachart-mentale`) n'utilisent plus que le code commun extrait au chantier 2, **sans régression**
et, quand l'ancienne version d'une app était meilleure sur un point d'UX, **sans perte** (le commun doit alors avoir
la version retenue par `chantier/07-decisions-ux.md`).

## Étapes

1. **Orientation** (lecture seule)
   - `chantier/README.md`, `chantier/suivi.md` (le lot doit être `extrait`, sinon arrête-toi), `chantier/lots/Lxx-….md` (section « Chantier 3 — migration », tests, pièges), `chantier/09-non-regression.md` (règles de migration, filet par zone, parcours manuels), `chantier/07-decisions-ux.md`.
   - Lis dans `packages/shared` l'API réellement livrée par le chantier 2 (elle a pu s'écarter de l'esquisse : le code fait foi) et le journal de `07-decisions-ux.md`.
2. **État de référence** : `bun install --frozen-lockfile` si besoin ; `bun run test` (les deux apps doivent être vertes), `bunx tsc --noEmit -p apps/zachart-maths` et `-p apps/zachart-mentale`. Note le nombre de tests par workspace.
3. **Plan de migration par app** : liste, avant de coder, chaque fichier de l'app à modifier / supprimer / déplacer, et pour chaque comportement qui change visiblement : « avant → après » et la décision UX qui le justifie. Si un comportement de l'app n'a pas d'équivalent dans le commun, **ne le supprime pas** : propose soit d'enrichir le commun (nouveau slot/option), soit de le garder dans l'app, et dis pourquoi.
4. **Migre Zach'Math d'abord**, par petits commits verts (un composant ou un store à la fois, ancien chemin supprimé dans le même commit). Règles :
   - Les tests des composants qui partent dans `shared` y partent avec eux (`git mv`), assertions intactes ; seul le harnais s'adapte.
   - Les clés de stockage, ids de commande, noms de fichiers de config et formats de fichiers utilisateur sont conservés (ou aliasés, avec un test de lecture de l'ancienne forme).
   - Pas de façade « de transition » qui survive au lot.
   - Après chaque commit : `bun run --filter zachart-maths test` + `bunx tsc --noEmit -p apps/zachart-maths`.
5. **Active dans le test de conformité** (`describeAppContract`) les vérifications du lot pour Maths, vérifie qu'elles passent.
6. **Migre ensuite Zachar't Mentale**, même méthode (plus gros, plus de tests : avance par petites étapes, relis chaque suite après chaque commit). Même activation du contrat.
7. **Régression visuelle / fonctionnelle** : relis la checklist de la zone concernée dans `09-non-regression.md` §3 et déroule celles que tu peux automatiser ; pour le reste, écris dans ta réponse finale la liste exacte des parcours manuels à faire par l'utilisateur (§4), app par app. Si les captures de référence existent (spike S2), compare-les.
8. **Nettoyage** : supprime le code mort laissé par la migration (sources, CSS, tests devenus doublons). Vérifie qu'aucun import ne traverse la frontière (`boundary.test.ts` de `shared`, des apps et de l'admin).
9. **Mesure** : compte les lignes retirées par app (`git diff --shortstat`) ; `bun run measure:sharing` si dispo.
10. **Vérification complète** : `bun run test:all`, `bunx tsc --noEmit` sur les 4 workspaces. (`cargo test --workspace` est exécuté par la CI si l'environnement ne peut pas compiler Tauri ; dis-le si c'est le cas.)
11. **Documente** : `CLAUDE.md` (retire les passages devenus faux, décris le nouveau fonctionnement), `chantier/suivi.md` (état `migré Maths` puis `migré Mentale` puis `terminé`, tests avant→après, notes), journal de `07-decisions-ux.md`.
12. **Commit et push** sur la branche désignée par la session (attribution demandée par la session, chemins explicites, jamais `-A`). **Pas de pull request** sans demande.

## Garde-fous
- Aucun test supprimé, désactivé ou assoupli pour passer au vert. Un test rouge = comprendre d'abord (régression ou ancien comportement à rétablir).
- Ne change pas de comportement utilisateur au-delà de ce que le lot et les décisions UX décrivent. Une amélioration trouvée en route va dans `suivi.md` > Notes, pas dans le code.
- Si la migration d'un écran exige une décision produit non prévue (ex. un cas d'usage qu'aucune config ne couvre), arrête-toi sur cet écran, explique, propose deux options, et continue sur le reste.
- Les données de l'utilisateur ne sont jamais migrées en silence : toute lecture d'un ancien format est testée avec un exemple réel (fixtures dans les tests, jamais le contenu de `.cours/`/`.cartes-mentales/`).
- Ne publie rien (pas de `deploy`, pas de bump de version, pas de tag) sans demande explicite.

## Compte rendu final (obligatoire, court)
Lot traité · par app : fichiers supprimés / déplacés / modifiés, lignes retirées · tests avant→après (par workspace) · décisions UX appliquées (par défaut ou validées) · comportements qui changent visiblement · parcours manuels à faire (liste) · points ouverts.

## Avancement global (obligatoire, après le compte rendu du lot)
Lis `chantier/prompts/avancement-global.md` et produis le tableau de bord de TOUS les chantiers (Harmonie, Ajustements, Synchro), avec le prochain lot et le modele conseille.
