# Chantier « Ajustements » — demandes du 2026-10-10

Origine : retours d'usage de l'utilisateur sur Mentale, Maths et Base. Ce chantier **complète** « Harmonie » (`../README.md`)
et ne le remplace pas : ce qui tient dans un lot Harmonie non fini (L4, L6, L7, L8) y est ajouté en section « Ajouts 2026-10-10 » ;
le reste devient un lot `A0`–`A6` ici. Progression : [suivi.md](suivi.md). Prompt : [../prompts/ajustements.md](../prompts/ajustements.md).

## Où va chaque demande

| Demande | Où | Lot |
|---|---|---|
| Clic droit dossier → Renommer : flash puis champ non éditable (double-clic OK) | bug, à corriger MAINTENANT dans Mentale, test déplacé au commun avec L8 | A0 |
| Modale « nouvelle carte mentale » trop petite, champs qui dépassent | bug | A0 |
| Choix du dossier : « select avec recherche » (filtrer au clavier) | nouveau composant `@suite/shared/ui` | A1 |
| Retirer le bouton de thème de la barre (déjà dans Paramètres) | `defineApp`/barre : masqué par défaut | A2 |
| Onglet de réglages « Boutons » : activer/désactiver les boutons de la barre (jamais : fermer, nouveau, annuler, rétablir, paramètres) | nouveau panneau standard | A2 |
| Raccourci affiché dans le nom de chaque onglet de réglages (ex. « Raccourcis F1 ») ; la touche ouvre l'onglet, fenêtre ouverte ou non | réglages | A2 |
| Bouton « fermer la fiche » commun, noir, dans toutes les apps (Maths y compris) | barre du haut | A2 |
| Audit des features propres à Maths ou à Mentale → mise en commun (Base comprise) | audit puis lots | A3 |
| Recherche avancée (Maths) dispo partout, donc Mentale | A3 (composant + port de source), branchement arbre = L8 | A3 |
| Boutons du pied de la barre gauche de Maths aussi dans Mentale | L7/L8 (pied standard `TreeFooter`) | L8 + A3 |
| Arbre vide → bouton « Créer un fichier » | L8 (critère ajouté) | L8 |
| Maths : arbre ouvert par défaut | A4 | A4 |
| Maths : barre de droite repliée → boutons montrés éteints sans perdre la mémoire ; clic sur Calculatrice quand repliée = déplie, ne l'éteint pas | L7 (règle ajoutée) + A4 pour l'existant | L7 / A4 |
| Base : gestion de fichiers complète (arbre, créer, renommer, réglages…) = Mentale + UX de Maths, avec port de synchro configurable | A6 (après L6–L8) | A6 |
| Que le prompt d'avancement rende compte de TOUS les chantiers | [../prompts/avancement-global.md](../prompts/avancement-global.md) | tous |

## Ordre recommandé

1. **A0** (bugs) — tout de suite, indépendant. 2. **A3a** (audit, lecture seule) — tôt, pour que L6–L8 absorbent le résultat.
3. **A1**, **A2** — indépendants des lots L. 4. **L6 → L7 → L8** (avec leurs ajouts). 5. **A3b**, **A4**, **A6**. 6. L9–L11 puis clôture.
A4 peut passer avant L7 si la gêne est forte (correctif local), il sera alors réécrit par L7.

## Quel modèle pour lancer chaque tâche

| Tâche | Modèle | Pourquoi |
|---|---|---|
| A0 | Sonnet | il faut diagnostiquer (focus Radix, taille de modale), pas seulement éditer |
| A1 | Sonnet | composant d'accessibilité (combobox clavier) à tester |
| A2 | Sonnet | touche `defineApp`, réglages, barre : plusieurs modules liés |
| A3a (audit) | **Haiku en sous-agents** (un par zone) puis Sonnet pour fusionner | lecture et inventaire, pas de décision de conception |
| A3b, A4 | Sonnet | |
| L6, L8a | Sonnet **+ relecture finale par un modèle plus fort** | risque d'écraser des fichiers d'élèves / 30 000 lignes de Mentale |
| L7, L8b/c, A6 | Sonnet | |
| Mises à jour de docs, `git mv` + réécriture d'imports, comptes rendus | Haiku | mécanique |
Règle : Haiku seulement quand la tâche est mécanique ou en lecture seule ; dès qu'il y a une API à concevoir ou un bug à comprendre, Sonnet.
Sous-agents : oui pour l'audit A3a et pour paralléliser A0/A1/A2 (fichiers disjoints) ; non pour L6/L8 (un seul fil, trop couplé).
