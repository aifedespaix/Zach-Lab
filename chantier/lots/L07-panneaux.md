# L7 — Panneaux latéraux : coque unique et registre de sections

> **Ajouts 2026-10-10 (obligatoires)** : voir `../ajustements/ajouts-aux-lots.md` § L7 (règle des pastilles, pied commun).

**Taille** : L · **Dépend de** : L1, L2, L4 · **Fonctionnalités** : F29, F60–F64, F79, F90–F95 · **Décisions** : D04, D14, D15

## Objectif
Mentale adopte `CollapsiblePanel` pour ses deux panneaux (rail avec libellé vertical, pied d'actions, repli dernier). Le panneau de droite de Maths
devient un **registre de sections** réutilisable (onglets, pastilles, repli automatique) ; Mentale y déclare sa section « Fiches ».

## À lire
- `packages/shared/src/shell/{CollapsiblePanel,CollapsedRail,PanelFooter,PanelSearch,ResizablePanel,PanelResizeHandle,usePanelCollapsed,usePanelResize,panelWidth}.ts(x)` et leurs tests
- Maths : `App.tsx` l. 177–218, `cours/{CoursePanel,PanelToggles,useCoursesStore}.ts(x)`, `exercises/TreeRailLabel.tsx`
- Mentale : `components/sidebar/FileSidebar.tsx` (coque : l. 120–135, 300–335, 460–510, 670–745), `components/detail/CardDetailPanel.tsx` (coque : l. 38, 270–300), `persistence/{sidebarWidth,cardDetailWidth}.ts`
- `chantier/03-zone-gauche.md`, `05-zone-droite.md`

## Chantier 2 — extraction
- `CollapsiblePanel` : ajouter `hidden` (retire le rendu, garde largeur et repli), `defaultCollapsed`, et accepter `railContent`/`railActions` des deux côtés ; vérifier que le pied et le rail suivent D04.
- `@suite/shared/shell` : `definePanelSections(side, sections)` + `<PanelSections side>` :
  - section `{ id, label, icon, command, area: 'top'|'bottom', group?, defaultVisible, visibleWhen?, render }`.
  - store persisté (`<id>:panel:<side>`), `toggle(id)` (dans un `group` : ouvre l'onglet, ou referme si c'est déjà lui), `foldWhenEmpty`, ouverture auto du panneau à l'allumage.
  - `PanelToggles` (barre, pied, rail ; orientation) ; commandes `panel.<id>.toggle` (alias `cours.toggle`, `notes.toggle`, `calculatrice.toggle`).
  - diviseur haut/bas redimensionnable si deux zones visibles.
- Le **libellé du rail** (`railContent`) devient un composant commun `RailLabel` (`titre · compteurs`), repris de `TreeRailLabel` (Maths).
- Les largeurs de Mentale (`sidebarWidth.ts`, `cardDetailWidth.ts`) passent à `createPanelWidthStorage`.

## Chantier 3 — migration
- **Maths** : `App.tsx` droit = `<PanelSections side="right" …>` avec 3 sections ; `useCoursesStore` perd la logique de visibilité (garde `selectedId`, `searchOpen`) ; `PanelToggles` supprimé (→ commun) ; clés de stockage conservées via alias de lecture (`courses-visible`, `notes-visible`, `bottom-tab`, `right-collapsed`).
- **Mentale gauche** : `FileSidebar.tsx` perd sa coque (largeur 32/replié, bouton, `PanelFooter` à la main, `PanelResizeHandle`) ; l'arbre lui-même est migré au L8, donc ici la coque seule : `CollapsiblePanel` + `children`=ancien contenu. Footer = actions existantes dans l'ordre D04.
- **Mentale droite** : `CardDetailPanel.tsx` perd `PanelResizeHandle`/`usePanelResize`/`CollapsedRail`, gagne `CollapsiblePanel` + section `fiches` ; masquage pendant le quiz = `hidden`.
- Clés de repli : `zachart-mentale:sidebar-collapsed` conservée ; droit : nouvelle clé `zachart-mentale:right-collapsed` (état par défaut = déplié, comme avant).

## Tests
- Déplacer/adapter : `CollapsiblePanel.test.tsx` (existant), `CoursePanel.test.tsx`, `CoursePanel.menus.test.tsx` (Maths) ; `CardDetailPanel.test.tsx`, `CardDetailPanelHover.test.tsx`, `FileSidebar.test.tsx` (Mentale, parties de coque).
- Nouveaux : `PanelSections` (visibilité, groupe/onglets, repli auto, ouverture auto), `RailLabel`.
- `describeAppContract` : activer (c) « les panneaux se replient au raccourci et au bouton », (f) « ordre du pied : créer → affichage → app → repli ».

## Pièges
- Tests Mentale qui comptent des largeurs en pixels (32 px) → mettre à jour avec la largeur de rail du composant commun, sans changer d'autres assertions.
- Focus après repli/dépli : `FileSidebar` rend le focus au champ de recherche après un dépli demandé par raccourci (l. 319–330) ; `CollapsiblePanel` doit offrir un crochet `onUnfold`.
- `CardDetailPanel` supprime un état `collapsed` par fiche (différent du repli du panneau) : ne pas confondre.

## Critères d'achèvement
- [ ] Plus de `PanelResizeHandle`/`usePanelResize` directs dans les apps
- [ ] Mentale : les deux panneaux sont des `CollapsiblePanel`
- [ ] Section « Barre latérale droite » du CLAUDE.md réécrite
- [ ] Suites vertes
