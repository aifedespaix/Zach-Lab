# L1 — Commandes : ids standard, alias, typage

**Taille** : M · **Dépend de** : L0 · **Fonctionnalités** : F08, F09, F64 · **Décisions** : D01, D09 (partie ids), D16 (raccourci thème)

## Objectif
Un vocabulaire de commandes commun et **sans perte** pour les raccourcis déjà personnalisés, et la fin des trois
façades de typage de Mentale.

## À lire
- `packages/shared/src/commands/{catalog.ts,useCommand.ts,useGlobalShortcuts.ts,shortcutSettingsPersistence.ts,useShortcutSettingsStore.ts,CommandButton.tsx,CommandMenuItem.tsx}`
- `apps/zachart-maths/src/commands.ts`, `apps/zachart-mentale/src/types/commands.ts`
- `apps/zachart-mentale/src/hooks/useCommand.ts`, `components/commands/{CommandButton,CommandMenuItem,CardContextMenu}.tsx`
- `apps/zachart-mentale/src/catalogRegistration.test.ts`
- `chantier/06-transversal.md` §1

## Chantier 2 — extraction (`packages/shared/src/commands`)
1. `defineCommandCatalog({ …, aliases })` : table `ancienId → nouvelId`. `commandById`, `runCommand`, `useCommand`,
   `useBinding`, `isCommandId` résolvent les alias. `sanitizeShortcutSettings` **réécrit** les ids d'alias avant de filtrer
   (si l'ancien et le nouveau existent tous deux dans le fichier, le nouveau gagne).
2. `createTypedCommands<typeof COMMANDS>()` → `{ useCommand, runCommand, CommandButton, CommandDropdownItem, useBinding, … }` typés.
3. `STANDARD_COMMANDS` (`commands/standard.ts`) : définitions des ids standard de `06-transversal.md` §1 (libellé, description,
   catégorie, binding par défaut) que l'app inclut par `...standardCommands(['app.palette', 'file.new', …])`. Une app peut
   en surcharger libellé/description, pas le sens.
4. Catégories standard exportées (`STANDARD_CATEGORIES`).
5. Tests : alias (lecture d'un ancien `shortcuts.json`), typage (`expectTypeOf`), conflit de binding entre standard et app (erreur au chargement du catalogue en dev).
6. `apps/base/src/commands.ts` devient la liste des standards utilisés + rien d'autre.

## Chantier 3 — migration
**Maths** (`apps/zachart-maths/src/commands.ts` et tous les `runCommand`/`useCommand`/`command="…"`) :
`sheet.new → file.new`, `sheet.close → file.close`, `view.toggleTree → view.toggleLeftPanel`, `view.toggleCourses → view.toggleRightPanel`,
`view.toggleCompact → view.toggleDensity`, `tree.newChapter → tree.newFolder`, `tree.toggleAll → tree.collapseAll`. Alias déclarés pour chacun.
`cours.toggle`, `notes.toggle`, `calculatrice.toggle` restent (deviendront `panel.*.toggle` au L7, avec alias).

**Mentale** (`types/commands.ts`, `hooks/useCommand.ts`, `components/commands/*`, `components/toolbar/AppToolbar.tsx`, `FileSidebar.tsx`, `CardDetailPanel.tsx`, `MindMapCanvas.tsx`, `hooks/useCanvasCommands.ts`) :
`view.toggleTheme → app.toggleTheme`, `view.toggleSidebar → view.toggleLeftPanel`, `view.toggleDetailPanel → view.toggleRightPanel`,
`file.newFolder → tree.newFolder`, `view.collapseFolders → tree.collapseAll`, `file.refresh → tree.refresh`, `view.findInTree → tree.focusSearch`.
Zoom du canvas : `view.zoomIn/Out/Reset → canvas.zoomIn/Out/Reset`, `view.fitView → canvas.fit` **avec** les nouveaux bindings de D09
(`Mod+Alt+Plus/Minus/0`, `Mod+Alt+F`) — l'alias garde l'ancien id mais **pas** l'ancien binding (`Mod+Plus/Minus/0` est pris par le zoom d'interface). Les
élèves qui avaient personnalisé ces quatre commandes les retrouvent sous leur nouvel id avec leur binding perso.
Supprimer les 3 façades ; importer `createTypedCommands` dans un seul fichier `commands.ts`.

## Tests
- Les deux `commands`-tests (`catalogRegistration.test.ts` de Mentale, tests du catalogue) mis à jour pour les nouveaux ids.
- Test d'alias : pour chaque entrée `aliases`, `commandById(ancien) === commandById(nouveau)`.
- `describeAppContract` : activer « ids standard présents ».

## Pièges
- **Ne pas perdre les raccourcis personnalisés** : fixture d'un `shortcuts.json` ancien dans les tests.
- `Mod+Shift+T` pour le thème : si un élève l'a déjà pris pour autre chose, la détection de conflit existante s'applique.
- Bien chercher les ids en chaînes dans les tests (`getByRole('button', { name: … })` dépendent des libellés, pas des ids — vérifier les libellés standard avant de les changer).

## Critères d'achèvement
- [ ] Aucun id obsolète dans le code des apps (hors table `aliases`)
- [ ] Les 3 façades de Mentale supprimées
- [ ] Un ancien `shortcuts.json` de chaque app est relu correctement (test)
- [ ] CLAUDE.md : sections « commandes » des deux apps + nouvelle section « ids standard »
- [ ] Suites vertes, `suivi.md` à jour
