# A3 — Parité des fonctionnalités Maths ↔ Mentale ↔ Base

**Taille** : L · **Dépend de** : A3a : — ; A3b : L8 pour l'arbre · **Modèle** : A3a = Haiku en sous-agents (un par zone) + Sonnet pour fusionner ; A3b = Sonnet

## A3a — Audit (lecture seule, aucun code)
`02-matrice-fonctionnalites.md` existe déjà (F1…F102) : la **relire et la compléter**, ne pas repartir de zéro.
- Sous-agents (consigne : interroger `graphify-out/graph.json` d'abord) : gauche, centre, droite, barre/commandes/réglages.
- Sortie : section « Addendum 2026-10-10 » dans la matrice : pour chaque écart nouveau → `Fxxx · app qui l'a · verdict (commun / reste propre) · lot cible`. « Commun » = utile à une autre app **ou** demandé par l'utilisateur.
- À vérifier en priorité : recherche avancée (Maths seule), pied de barre gauche de Maths (`tree.newChapter`, `tree.toggleAll`, `tree.onlyToCorrect`), orthographe `FieldContextMenu`, coloration unités/termes, Notes/Calculatrice ; côté Mentale : quiz, propriétés/export, synchro, historique de description, badges de type, copier le lien.
- Avant A3b : poser à l'utilisateur UNE question groupée sur les verdicts douteux, avec recommandation.

## A3b — Mise en commun
- **Recherche avancée** : `AdvancedSearchDialog` générique dans `@suite/shared/search` ; l'app fournit un **port** `SearchSource` (`load()`, `fields`, `renderExcerpt?`, `filters`). Maths : `librarySearch.ts` devient sa source ; Mentale : titres et contenus de cartes (lus via le port fichiers) ; Base : texte des `.txt`. Commande standard `search.advanced` (`Mod+Shift+F`), bouton à droite de la recherche de l'arbre (slot `trailing`, branché par L8).
- **Pied de la barre gauche** : `TreeFooter` standard (L8) = créer fichier → créer dossier → tout replier/déplier → filtres de l'app → replier. Mentale gagne ce que Maths avait (replier tout, etc.).
- Chaque écart « commun » de l'addendum devient une ligne dans le lot le plus proche (L6–L9) ou un mini-lot `A3-x` ajouté à `suivi.md`.

## Critères d'achèvement
- [ ] A3a : addendum écrit, verdicts douteux validés par l'utilisateur
- [ ] A3b : recherche avancée et pied standard dans les 3 apps
