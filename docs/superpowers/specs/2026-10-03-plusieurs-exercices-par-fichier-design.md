# Zach'Math — plusieurs exercices par fichier (lot D)

Date : 2026-10-03. App : `apps/zachart-maths`. Suite du lot A (`151fdbb`).

## Objectif

Un fichier est une **fiche** (une feuille de manuel, « Fractions p.45 ») qui contient
plusieurs exercices. L'élève ajoute un exercice, passe au précédent ou au suivant, et voit
d'un coup d'œil tous les exercices de la fiche ouverte.

Réussite : on peut parcourir et agrandir une fiche entièrement au clavier ou à la souris,
sans perdre le moindre fichier existant.

## Décisions prises avec l'utilisateur

- Un fichier devient une liste d'exercices (pas « un exercice = un fichier »).
- Le **titre** appartient à la fiche. Le numéro, la page, l'énoncé, les blocs, la réponse et
  les notes appartiennent à **chaque exercice**.
- La vue d'ensemble est une **liste en bas de la sidebar gauche**, pas une modale.
- « Suivant » au dernier exercice en crée un après ; « précédent » au premier en crée un avant.
  Si l'exercice courant est encore vierge, la flèche au bord ne fait rien (pas d'exercices vides
  empilés), plutôt qu'une confirmation.

## 1. Format de fichier (v2)

```json
{
  "version": 2,
  "id": "…",
  "titre": "Fractions p.45",
  "exercices": [
    { "id": "…", "numero": "3.b", "page": "45", "enonce": "…", "blocs": [], "reponse": "", "notes": "" }
  ]
}
```

- `EXERCISE_VERSION` passe à 2. Le type `Exercise` devient l'exercice seul ; un nouveau type
  `Sheet` porte `version`, `id`, `titre`, `exercices`.
- **Migration v1 → v2**, à la lecture : un fichier v1 est lu comme une fiche à un exercice
  (`question` → `numero` ; `enonce`, `page`, `blocs`, `reponse`, `notes` repris tels quels).
  Le fichier n'est réécrit en v2 qu'à la première modification : ouvrir sans modifier ne touche
  pas au disque.
- Une version supérieure à 2 est refusée, comme aujourd'hui (`corrompu`).
- Une fiche a toujours au moins un exercice : un fichier v2 sans exercice s'ouvre avec un
  exercice vierge. Un exercice sans `id` en reçoit un, et les `id` en double sont refaits.
- Les champs inconnus d'un exercice sont conservés à l'écriture.
- Les blocs gardent leur format actuel (`blocks.ts`, lot B pour le bloc Calcul).

## 2. État et sauvegarde

- `useExerciseStore.selected` devient `{ path, exerciseId }`. L'arbre liste toujours des
  fichiers ; sélectionner un fichier ouvre son premier exercice.
- `useOpenExercise` charge la **fiche entière** ; `edit(patch)` modifie l'exercice courant ;
  l'autosauvegarde (600 ms, au changement de fiche, à la fermeture) écrit toute la fiche.
- Le titre de l'arbre continue de venir du titre de la fiche (`ExerciseEntry.titre`).
- Opérations pures sur `Sheet`, testées sans React (module `sheet.ts`) :
  - `addExercise(sheet, position)` : exercice vierge au début ou à la fin ;
  - `neighbour(sheet, id, delta)` : l'id voisin, ou `null` au bord ;
  - `isBlank(exercise)` : ni numéro, ni énoncé, ni blocs, ni réponse, ni notes ;
  - `removeExercise(sheet, id)` : garde toujours un exercice.

## 3. Navigation dans la zone centrale

- En haut à droite de l'en-tête : `‹  3 / 7  ›` et un bouton « Nouvel exercice ».
- Suivant au dernier : crée un exercice après et s'y place. Précédent au premier : en crée un
  avant. Si l'exercice courant est vierge (`isBlank`), la flèche au bord est désactivée.
- Le champ « Question » devient « Numéro » ; vide, l'exercice s'affiche par sa position (« 3 »).
- Changer d'exercice écrit tout de suite la fiche (comportement actuel du changement de fichier)
  et remet `lastField` à zéro, pour que la barre de symboles n'écrive pas dans un champ disparu.

## 4. Vue d'ensemble : liste en bas de la sidebar gauche

- Composant `SheetOutline`, sous `ExerciseTree`, repliable ; il liste les exercices de la fiche
  ouverte.
- Une ligne par exercice : numéro (ou position), `p.45` s'il y a une page, la première ligne de
  l'énoncé tronquée, une coche si la réponse est remplie, l'exercice courant mis en évidence.
- Un clic change d'exercice. Rien d'autre (pas de glisser-déposer).
- Absent quand aucune fiche n'est ouverte.

## Erreurs et cas limites

- Fichier illisible : inchangé (reste visible dans l'arbre, ne s'ouvre pas).
- Échec d'écriture : même message qu'aujourd'hui, la fiche reste en mémoire.
- Suppression d'un exercice : hors périmètre de ce lot (seule la suppression du fichier existe).
- Renommage de chapitre ou déplacement de fichier : `selected.path` suit, `exerciseId` reste.

## Tests

- `types`/`sheet` : migration v1 → v2 (y compris sans réécriture à l'ouverture), fiche vide,
  `id` manquants ou en double, version > 2 refusée, champs inconnus conservés.
- `sheet.ts` : `addExercise`, `neighbour`, `isBlank`, `removeExercise`.
- `ExerciseWorkspace` : précédent/suivant, création au bord, flèche désactivée sur un exercice
  vierge, compteur `3 / 7`, écriture du fichier v2.
- `SheetOutline` : une ligne par exercice, coche de réponse, clic de navigation.
- Les tests existants qui écrivent des fichiers v1 continuent de passer (ils servent de test de
  migration).

## Hors périmètre

Réordonner les exercices, les déplacer entre fiches, supprimer un exercice, statistiques de
progression ; lot B (sous-lignes du bloc Calcul) et lot C (groupes de symboles).
