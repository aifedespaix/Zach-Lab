# Zach'Math — zone de travail à l'image de Zachar't Mentale

Cycle 1 sur 2. Le cycle 2 (sidebars partagées) est hors périmètre, voir la fin.

## Intention

Donner à la zone de travail de Zach'Math l'ergonomie de Zachar't Mentale, plus dense et plus
lisible, en partageant le code plutôt qu'en le copiant.

Demandé : barre de symboles sur deux colonnes ; blocs condensés avec animation de
déplacement ; modes calcul et équation comme dans Mentale, sans bouton « insérer » ni bouton
clavier ; icône par type de bloc ; « nouvel exercice » dans la zone de réponse, avec focus sur
l'énoncé ; centre scindable en deux zones indépendantes ; clic droit sur le contenu central.

## Décisions prises

- Énoncé en haut, réponse en bas, centre scindable en deux zones **indépendantes** (deux piles).
- Équation : **modèle de Mentale** (`left | right | operation`), pas une ligne LaTeX unique.
- Déplacement d'un bloc : flèches ▲▼ et clic droit. **Pas** de glisser-déposer.
- Animation : `motion` (`layout`) dans une zone ; entre zones, fondu + halo (pas de `layoutId`).

## Disposition

De haut en bas : en-tête (titre, numéro, page, navigation précédent/suivant/supprimer) ;
énoncé avec le bouton « scinder » ; centre (barre de symboles en 2 colonnes à gauche, puis une
zone de travail, ou deux quand l'exercice est scindé, chacune avec sa pile de blocs et ses
boutons d'ajout icône + libellé) ; zone de réponse avec le bouton « Exercice suivant / Nouvel
exercice » (crée un exercice au dernier, sinon passe au suivant).

Focus : un nouvel exercice place le curseur dans l'énoncé ; un nouveau bloc, dans son premier
champ (comportement actuel).

## Format de fichier

- `Exercise.blocsB?: Block[]` — l'exercice est scindé si et seulement si `blocsB` existe, même
  vide. Les fiches existantes restent valides sans migration ; `blocsB` est absent d'un
  exercice non scindé.
- Réunir les zones ajoute les blocs de `blocsB` à la suite de `blocs`. Rien n'est perdu.
- Un bloc de type inconnu est conservé verbatim dans l'une ou l'autre zone.
- `EquationBlock.etapes[]` passe de `{ id, latex, action }` à `{ id, left, right, operation }`.
  À la lecture, un `latex` ancien est découpé sur son premier `=` (sans `=` : tout dans `left`,
  `right` vide) ; `action` devient `operation`. Le fichier n'est réécrit qu'à la première
  modification, comme pour le passage v1 → v2.

## Blocs

- **Carte** : gouttière à gauche (▲, ▼, corbeille en colonne, pleinement visibles au survol ou
  au focus) ; l'en-tête textuel disparaît au profit d'une icône par type (`Type` texte, `Sigma`
  calcul, `Table2` tableau, `Equal` équation — celles de Mentale). Boutons d'ajout colorés par
  type, icône + libellé.
- **Déplacement** : `layout` de `motion` sur chaque carte, le bloc déplacé et celui qu'il
  remplace glissent. Le bloc déplacé reçoit un halo d'environ 600 ms et garde le focus. D'une
  zone à l'autre : fondu sortant/entrant avec le même halo. Avec `prefers-reduced-motion`, plus
  de glissement, seulement le halo.
- **Calcul** : cases colorées `expression = résultat`. Entrée passe de l'expression au
  résultat, puis crée le bloc suivant. Pas de bouton « insérer », pas de bouton clavier.
- **Équation** : deux cases (gauche bleu, droite ambre) et un champ opération entre les étapes ;
  ligne verte quand la variable est isolée ; flèches, Tab, Entrée (ajoute une étape),
  Retour arrière sur une étape vide (la supprime). La logique pure de Mentale (`equationNav`,
  `equationStepIsSolved`) est déplacée dans `@suite/shared/math` ; Mentale l'importe de là,
  Maths ne la copie pas. Les tests déplacés suivent le code.

## Clic droit (zone centrale, trois niveaux, propagation arrêtée entre niveaux)

- Bloc : monter, descendre, dupliquer, supprimer, changer de type, envoyer dans l'autre zone
  (si scindé).
- Champ : couper, copier, coller ; symboles courants pour un champ mathématique.
- Vide : ajouter un bloc (texte, calcul, tableau, équation) ; scinder / réunir les zones.

Basé sur `ContextMenu` de `@suite/shared/ui`, comme `BlockContextMenu` de Mentale.

## Barre de symboles

Grille à 2 colonnes au lieu d'une. Familles groupées par couleur, ordre inchangé.

## Tests

- Logique pure, en TDD : fusion des zones, déplacement d'un cran et entre zones, lecture d'un
  ancien `latex`, bloc inconnu conservé, sérialisation (`blocsB` absent si non scindé).
- Composants : ▲▼ désactivés aux extrémités ; clic droit aux trois niveaux avec arrêt de la
  propagation ; focus (énoncé après « nouvel exercice », premier champ après un ajout) ; bouton
  du bas suivant/nouveau selon la position ; équation (clavier, ligne verte) ; halo présent et
  glissement absent sous `prefers-reduced-motion`.
- Frontières : `boundary.test.ts` de `shared` et de Maths verts ; la logique d'équation passe
  par un point d'entrée public ; les tests de Mentale qui l'utilisent restent verts.
- Final : `bun run test`, `bunx tsc --noEmit` (Maths, `shared`, Mentale), et passage dans
  l'app réelle pour les animations et les deux colonnes.

## Ordre de réalisation (une tâche, un commit)

1. Format de fichier : `blocsB`, fusion, déplacement entre zones, lecture de l'ancien `latex`.
2. Extraction de la logique d'équation vers `@suite/shared/math`, Mentale l'importe.
3. Carte de bloc : gouttière, icônes, boutons d'ajout.
4. Éditeurs calcul et équation.
5. Animation de déplacement et halo.
6. Zone de réponse (suivant / nouvel exercice), focus, bouton « scinder », deux zones.
7. Barre de symboles sur 2 colonnes.
8. Clic droit à trois niveaux.
9. Revue de toute la branche, puis vérification dans l'app.

## Hors périmètre — cycle 2

Sidebars gauche et droite : rangement, raccourcis et icônes communs, arbre de fichiers partagé
entre Mentale et Maths, clic droit sur les deux sidebars. `FileSidebar`, `FileTreeRow` et
`BlockEditor` de Mentale sont très liés à l'app : ce cycle demande une vraie extraction, à
brainstormer séparément après la stabilisation de celui-ci.
