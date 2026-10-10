# A1 — « Select avec recherche » (choix de dossier)

**Taille** : M · **Dépend de** : A0 · **Modèle** : Sonnet · **Règle de deux** : Mentale (`NewMindMapDialog`) + Maths (`NewSheetDialog`/`ChapterField`) + « Déplacer vers… » (L8) → justifié.

## Objectif
Avec beaucoup de dossiers et sous-dossiers, un `<select>` fait se perdre. Un champ qui se comporte comme un input : on tape, la liste se filtre.

## API (`@suite/shared/ui`)
- `ComboboxSelect<T>` : `options: { value: T; label: string; detail?: string; depth?: number }[]`, `value`, `onChange`, `placeholder`, `emptyText`, `ariaLabel`. Vérifier d'abord si `shared/ui` a déjà `command`/`cmdk` ou un popover Radix avant d'ajouter une dépendance.
- Filtre : insensible aux accents et à la casse, sous-chaîne **sur le chemin complet** (« 3e/géo » trouve `Collège/3e/Géométrie`). Fonction pure testée (réutiliser la normalisation de `@suite/shared/search` si elle existe).
- `FolderPicker` (même entrée) : prend un arbre de dossiers ; `label` = nom, `detail` grisé = chemin complet ; indenté par `depth` quand le filtre est vide, aplati quand on tape ; option « Racine » si `allowRoot`.
- Clavier : flèches, Entrée, Échap (referme sans changer), Début/Fin, saisie depuis le champ fermé ouvre la liste. `role="combobox"`, `aria-expanded`, `aria-activedescendant`.
- Dans une modale : la liste s'ouvre **dans** le dialogue (portail + z-index) ; Échap ferme d'abord la liste, pas la modale.

## Branchements
Mentale `NewMindMapDialog` ; Maths `NewSheetDialog`/`ChapterField` ; « Déplacer vers… » de L8 (point d'accroche prêt, branché là). `apps/base` n'a pas de dossiers avant L8.

## Tests d'abord
Filtre (accents, casse, chemin), liste vide, 500 options (virtualiser seulement si mesuré), clavier complet, Échap en deux temps dans une modale, sélection conservée à la réouverture.

## Critères d'achèvement
- [x] Composant dans `@suite/shared/ui` + ligne dans CLAUDE.md
- [x] Branché dans les deux modales de création
- [x] Tests clavier et filtre verts, frontière `shared` respectée
