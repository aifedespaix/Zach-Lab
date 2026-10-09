# 05 — Barre de droite

Ce que la demande veut : un panneau « un peu plus libre », mais dont le **code commun gère le système
d'onglets** et tout ce que plusieurs apps peuvent utiliser. Et : reprendre ce qu'a Maths — les boutons, le
texte vertical quand le panneau est replié — et mettre les boutons d'action **dans le pied** du panneau,
avec le bouton de repli.

## État actuel

| | Maths | Mentale |
|---|---|---|
| Coque | `CollapsiblePanel` (rail 40 px avec pastilles verticales, pied `PanelToggles`, `Mod+Shift+B`) | `CardDetailPanel.tsx` (807 l.) : `PanelResizeHandle` + `usePanelResize` directs, `CollapsedRail` sans libellé, largeur dans `persistence/cardDetailWidth.ts` |
| Contenu | `CoursePanel` = moitié haute (cours) + `BottomSection` à **deux onglets** (Notes / Calculatrice) | pile de **fiches** (une par carte ouverte), repliables une à une, filtrées |
| Visibilité | 3 pastilles : `cours.toggle`, `notes.toggle`, `calculatrice.toggle` ; `foldWhenEmpty` replie le panneau quand tout est éteint ; allumer une pastille le déplie | `view.toggleDetailPanel` ; le panneau est retiré du cadre pendant un quiz (`right={undefined}`) |
| Pied | `PanelToggles` (les mêmes pastilles qu'en barre et que sur le rail) | aucun |
| État mémorisé | `bottom-tab`, `courses-visible`, `notes-visible`, `right-collapsed`, `right-width` (clés `zachart-maths:*`) | `card-detail-width`, `description-narrow`, repli via `usePanelCollapsed` |

## Constat

- La **coque** est identique en droit ; Mentale en est restée à une version plus ancienne.
- Maths a inventé trois choses qui valent pour tous : (1) des **sections** déclarées une fois et affichables
  à la demande, (2) des **pastilles** de bascule présentes à trois endroits (barre, pied, rail),
  (3) le **repli automatique** quand rien n'est allumé.
- Le **contenu** (cours/notes/calculatrice, fiches) est entièrement propre à l'app et doit le rester.

## Cible : un registre de sections

```
definePanelSections('right', [
  { id: 'courses', label: 'Cours', icon: BookOpen, command: 'cours.toggle',
    area: 'top', defaultVisible: true, render: () => <CourseList /> },
  { id: 'notes',   label: 'Notes', icon: NotebookPen, command: 'notes.toggle',
    area: 'bottom', group: 'bottom-tabs', render: () => <Notes /> },
  { id: 'calc',    label: 'Calculatrice', icon: Calculator, command: 'calculatrice.toggle',
    area: 'bottom', group: 'bottom-tabs', render: () => <Calculator /> },
])
```

Le commun fournit : le panneau (`CollapsiblePanel`), le **store des sections visibles** persisté, les
**onglets** d'un groupe (`group` : une seule section du groupe visible à la fois, bouton sur l'onglet actif =
referme), les **pastilles** (`PanelToggles`) à rendre dans la barre / le pied / le rail, le repli
automatique, l'ouverture automatique à l'allumage, la hauteur partagée haut/bas (diviseur). L'app fournit les
sections et leurs commandes.

Mentale déclare **une** section (`fiches`, `area: 'top'`, `visibleWhen` = « il y a des fiches ouvertes » ou
toujours) ; elle gagne le rail avec libellé vertical (« Fiches · 3 »), le pied avec pastille, la largeur
mémorisée par la clé standard.

### Pied et rail (reprise de Maths)
- **Pied** : `[repli]   ‹ espace ›   [pastilles / actions de l'app]   ‹ espace ›` côté droit (repli à l'**intérieur**,
  actions centrées) ; côté gauche l'inverse. C'est le comportement actuel de `CollapsiblePanel`, à conserver.
- **Rail replié** : soit un libellé vertical (`railContent`), soit les pastilles verticales (`railActions`) ;
  le bouton « déplier » reste **en bas**, pour que le geste ne change pas de coin.

## Détails à régler

1. **Retrait temporaire** (quiz de Mentale) : aujourd'hui `right={undefined}` détruit le panneau. À remplacer
   par une prop `hidden` : le panneau n'est pas rendu mais son état (largeur, repli) est conservé.
2. **Raccourcis** : `Mod+Shift+B` est déjà identique ; `Mod+B` (gauche) aussi. Ids standard
   `view.toggleLeftPanel` / `view.toggleRightPanel` (alias des anciens, voir D01).
3. **Largeur** : une seule fabrique `createPanelWidthStorage` (min/max/défaut par app).
4. **Mentale** : `description-narrow` (largeur étroite de la modale de description) n'est pas du panneau
   mais une préférence d'affichage : passe par `createPersisted` (L2), pas par le panneau.

## Risques

- `CardDetailPanel` a beaucoup de comportements propres (survol carte↔fiche, fiches filtrées, rétention).
  La migration ne touche **que la coque** (largeur, repli, rail, pied, masquage) ; la pile de fiches est
  inchangée et devient le `render` de la section.
- Le test `CardDetailPanel.test.tsx` doit rester vert sans modification d'assertions (seuls les montages
  changent si la coque est maintenant `CollapsiblePanel`).
