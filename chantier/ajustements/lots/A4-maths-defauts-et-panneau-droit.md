# A4 — Maths : arbre ouvert par défaut, barre de droite

**Taille** : S · **Dépend de** : — (L7 le généralise ensuite) · **Modèle** : Sonnet · **Dans** : `apps/zachart-maths/src/{App.tsx,cours/{useCoursesStore,PanelToggles,CoursePanel}.tsx,exercises/…}`

1. **Arbre ouvert par défaut** : panneau gauche déplié au premier lancement (clé de repli absente = déplié) **et** chapitres dépliés tant que l'utilisateur n'a rien replié. Un état enregistré n'est jamais écrasé. Tester clé absente / présente.
2. **Pastilles de la barre de droite** (cours / notes / calculatrice, `PanelToggles`) :
   - Panneau **replié** → pastilles affichées **éteintes**, mais `coursesVisible`, `notesVisible`, `bottomTab` ne changent pas (mémoire conservée). Au dépliage, elles reprennent leur état mémorisé.
   - Clic sur une pastille panneau replié : **déplie** et laisse l'état mémorisé ; une pastille « allumée en mémoire » (ex. calculatrice) n'est **pas éteinte** par ce clic (aujourd'hui `toggleBottom` la referme). Si elle était éteinte en mémoire : le clic l'allume ET déplie.
   - Logique pure et testée : `pastilleView({ collapsed, remembered }) → { lit }` et `onPastilleClick({ collapsed, remembered }) → { unfold, nextRemembered }`.
3. L7 reprend ces deux fonctions dans `PanelSections` (clés `zachart-maths:*` inchangées ou aliasées).

## Critères d'achèvement
- [ ] Tests purs + test d'intégration `PanelToggles` replié/déplié
- [ ] Aucune clé de stockage renommée
