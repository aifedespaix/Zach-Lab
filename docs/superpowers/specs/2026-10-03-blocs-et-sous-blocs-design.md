# Blocs et sous-blocs, éditeur d'équations partagé, accueil de Zach'Math

## Intention

Que les équations et les formules de Zach'Math se saisissent exactement comme dans Mentale :
même code, même clavier, et une logique claire où l'on ne se perd pas. Entrée crée un
**sous-bloc**, jamais un bloc. Et que Zach'Math, quand rien n'est ouvert, propose les derniers
fichiers ouverts comme Mentale.

## Décisions prises

- Un **bloc contient des sous-blocs**. Équation : sous-blocs = étapes. Calcul : sous-blocs =
  lignes. Texte et Tableau restent des blocs simples.
- Entrée = nouveau sous-bloc. Ctrl/Cmd+Entrée = nouveau bloc après le bloc courant. Maths n'a
  pas de groupes : Ctrl/Cmd+Maj+Entrée fait la même chose.
- Le clavier est écrit **une fois**, dans `@suite/shared`, et utilisé par les deux apps.
- Aucun bouton à droite d'un sous-bloc : ni ✕, ni « + Étape », ni menu clic droit sur les champs
  de formule. Le clavier suffit.
- Le bloc Calcul est une liste de lignes, chacune un champ de formule (MathLive, repli LaTeX brut
  qui reste un éditeur complet). `CalcEditor` ne calcule rien aujourd'hui : rien à préserver.

## 1. Moteur de sous-blocs (`@suite/shared/equation`)

Nouveau point d'entrée public. Il ne touche pas Tauri ; MathLive reste chargé à la demande.

- **Vocabulaire d'intentions**, remonté depuis `apps/zachart-mentale/src/content/fieldIntents.ts` :
  `ExitDirection`, `ExitVia`, `BlockPlace`, `BlockEdgeHandle`, la garde de répétition
  (`latchEdgeKey`, `rawFieldKeyDown`). Un champ **émet** une intention, son parent décide.
- **Champ de formule** : le `MathFieldEditor` de Mentale (un seul wrapper MathLive pour la suite).
- **Hook `useSubBlocks`** : table des handles par clé de champ, focus posé *après* le rendu qui a
  ajouté ou retiré un sous-bloc, saut vers le suivant s'il est vide, suppression, sortie du bloc.
- **`EquationBlockField`** : l'éditeur d'équations de Mentale, générique sur des étapes
  `{ left, right, operation? }` sans id (la forme de `equationNav`). Props : `steps`, `onChange`,
  `onEnterBlock`, `onDeleteEmpty`, `onDeleteForward`, `onExitBlock`, `onFieldChange`, `ref`
  (`BlockEdgeHandle`). Les types de bloc et le rendu propres à une app restent dans l'app.
- **`LinesBlockField`** : même moteur pour une liste de lignes (le Calcul).
- La règle `shared` n'importe rien d'une app tient ; `src/boundary.test.ts` la vérifie.

Mentale migre sur ce module (ses fichiers deviennent de minces façades, comme pour le glisser-
déposer de l'arbre). Ses tests existants (`equationKeys`, `BlockEditor`, `blockKeys`) sont la
protection contre une régression.

## 2. Clavier (les deux apps)

| Touche | Effet |
|---|---|
| Entrée | nouveau sous-bloc juste après ; s'il est déjà vide, on y saute |
| Ctrl/Cmd+Entrée (+Maj) | nouveau bloc juste après le bloc courant |
| ↑ ↓ ← → | d'un sous-bloc à l'autre ; ← → seulement au bord du champ ; hors du bloc depuis le premier/dernier |
| Retour arrière, sous-bloc vide | le supprime, curseur en fin du sous-bloc du dessus |
| Retour arrière, dernier sous-bloc vide d'un bloc vide | supprime le bloc, curseur sur le bloc précédent |
| Suppr en fin de sous-bloc vide | même chose vers le bas |

Retour arrière et Suppr sont protégés contre la répétition de touche maintenue (aucune perte de
contenu par répétition). Dans Maths, `BlockStack` reçoit `onEnterBlock` et insère un bloc après
l'id courant ; le bloc inséré reçoit le curseur (c'est déjà le rôle de `toFocus`).

## 3. Données de Zach'Math

- Équation : inchangée (`etapes: { id, left, right, operation }[]`). L'adaptateur retire les ids
  pour le moteur partagé et les rétablit au retour.
- Calcul : `{ id, type: 'calcul', lignes: { id, latex }[] }`. Un ancien
  `{ expression, resultat }` est relu comme `[expression, resultat]` (`resultat` vide ignoré) ;
  le fichier n'est réécrit qu'à la première modification, comme les feuilles v1.
- `blockToPlain` et `convertBlock` suivent : une ligne par ligne de calcul, les conversions
  Calcul ⇄ Équation ⇄ Texte gardent leur contenu.
- Un bloc de type inconnu reste conservé tel quel.

## 4. Accueil de Zach'Math

- `RecentFilesList` devient un composant **présentationnel partagé** (`files`, `onOpen`) ;
  Mentale l'utilise depuis le partage.
- Maths garde ses récents en `localStorage` (clé `zachart-maths:session`, 10 au plus, le plus
  récent d'abord), sur le modèle de `sessionState.ts` de Mentale ; un stockage illisible est
  ignoré. Un fichier supprimé ou déplacé n'est pas proposé.
- `ExerciseWorkspace` n'affiche plus « Choisis un exercice dans la liste de gauche » seul : sans
  fichier ouvert, il montre la liste des récents ; sans aucun récent, ce message reste.

## Livraison

Trois étapes testées et commitées à part :

1. Accueil (récents partagés + stockage Maths).
2. Moteur partagé, Mentale migré, ses tests verts.
3. Maths câblé : équation et calcul sur le moteur, Ctrl+Entrée, suppression des boutons, données
   du calcul migrées.

## Tests

- Moteur : un test par ligne du tableau clavier, dont la garde de répétition.
- Maths : Entrée dans un Calcul et dans une Équation n'ajoute **pas** de bloc ; Ctrl+Entrée en
  ajoute un, avec le curseur dessus ; relecture d'un ancien calcul ; conversions de type.
- Accueil : récents triés, plafonnés à 10, fichiers absents ignorés, message de repli.
- `bunx tsc --noEmit -p apps/zachart-maths`, `-p apps/zachart-mentale`, `-p packages/shared`, puis
  `bun run test` et `bun run test:admin`.

## Hors périmètre

- Les blocs Texte et Tableau (comportement inchangé).
- Les groupes de blocs de Mentale (Maths n'en a pas).
- La synchronisation et PocketBase.
