# Ajouts 2026-10-10 aux lots Harmonie non terminés

Ces exigences s'ajoutent aux critères d'achèvement du lot concerné (chaque lot renvoie ici depuis sa première ligne).
Le prompt de chantier doit les traiter comme s'ils étaient écrits dans le lot.

## L4 — Barre du haut (déjà `extrait`, à rattraper au chantier 3 ou en A2)
- Thème : pas d'item de barre par défaut (→ A2a). Onglet « Boutons » (→ A2b). Bouton « fermer » commun noir (→ A2d).
- Mentale : en migrant sa barre, chaque bouton propre (Quiz, explorateur…) devient un item de zone `app` **masquable**.

## L6 — Fichiers, historique, accueil
- `NewFileDialog` : taille de modale vérifiée (A0) ; le champ dossier utilise `FolderPicker` (A1) ; le champ ne déborde jamais à 150 % de zoom.
- Accueil sans fichier : si l'arbre est vide, l'accueil propose aussi « Créer un fichier » (même action que L8, voir plus bas).

## L7 — Panneaux latéraux
- Règle des pastilles (A4) dans `PanelSections` : panneau replié → pastilles **éteintes à l'écran** mais état **mémorisé** ; clic sur une pastille panneau replié → **déplie sans éteindre** ce qui était allumé en mémoire (calculatrice incluse).
  Fonctions pures `pastilleView` / `onPastilleClick`, tests repris d'A4.
- Le pied de la barre gauche est le **même** dans Maths et Mentale (`TreeFooter`, voir L8) ; Mentale reçoit les boutons que Maths avait (tout replier/déplier…).

## L8 — Arbre de fichiers
- **Arbre vide** (aucun fichier ni dossier à la racine) : état vide avec un bouton « Créer un fichier » (+ « Créer un dossier »), libellés en config. Le bouton passe par la commande `tree.newFile`.
- **Renommer** : le renommage en ligne ouvert depuis le menu contextuel garde le focus (leçon d'A0) ; test commun « menu → Renommer → on peut taper » sur dossier ET fichier.
- « Déplacer vers… » utilise `FolderPicker` (A1).
- Recherche avancée : bouton dans le slot `trailing` de `TreeSearchHeader`, ouvre `AdvancedSearchDialog` (A3b). Dans Maths, **arbre ouvert par défaut** (A4) devient la valeur par défaut de `FileTreeConfig.defaultExpanded` pour toutes les apps.
- Pied standard `TreeFooter` identique dans Maths, Mentale, Base.
