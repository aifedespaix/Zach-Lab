# L9 — Contenu éditable : menus de champ, orthographe, symboles, historique de champ

**Taille** : M · **Dépend de** : L6 · **Fonctionnalités** : F103, F110–F115 · **Décisions** : D17

## Objectif
Les champs de texte de toutes les apps partagent les mêmes menus contextuels, le même correcteur orthographique français et le même moteur
d'historique local ; la barre de symboles a un rendu commun avec un catalogue propre à chaque app.

## À lire
- Maths : `exercises/{FieldContextMenu,BlockContextMenu,EmptyAreaContextMenu,insertAtCursor,caretAt,spell,spell.worker,spellCore,HighlightedTextarea,Toolbar,toolbarCatalog,symbolInsert,ToolbarSettingsPanel,useToolbarFamilies}.ts(x)`
- Mentale : `content/{FieldContextMenu,BlockContextMenu,EmptyAreaContextMenu,descriptionMenuKit,SymbolBand,symbolSets,symbolTabs,descriptionHistory,useDescriptionHistory,highlight,BlockEditor,DescriptionDialog}.ts(x)`
- Shared : `equation/*` (déjà partagé : `MathFieldEditor`, `fieldIntents`), `ui/context-menu.tsx`
- `CLAUDE.md` : sections « Orthographe et flèches », « Toolbar » de Maths.

## Chantier 2 — extraction (`@suite/shared/text`, nouveau)
- `insertAtCursor`, `caretAt` (Maths, tels quels).
- Correcteur : `spell.ts`, `spell.worker.ts`, `spellCore.ts` (dictionnaire `nspell` + `dictionary-fr` chargé **à la demande**) ; alias Vite `@dictionary-fr` documenté dans la config commune ; `useSpellcheck(enabled)`.
- `FieldContextMenu` fusionné : actions de Mentale (161 l.) + corrections orthographiques de Maths (137 l.) ; prop `spellcheck`.
- `BlockContextMenu` / `EmptyAreaContextMenu` : squelette commun, actions de bloc en slot.
- `SymbolBar` : rendu, familles, teintes, onglets ; **catalogue = donnée** (`SymbolCatalog` : `family`, `hue`, `glyph`, `latex`, `plain`), formats de Maths et Mentale convertis dans cette forme.
- `useFieldHistory` : `createHistoryStore` (L6) appliqué à un champ ; `descriptionHistory.ts` supprimé.
- `apps/base` : `TextDocument` utilise `FieldContextMenu` + `spellcheck`.

## Chantier 3 — migration
- **Maths** : `FieldContextMenu`, `BlockContextMenu`, `EmptyAreaContextMenu`, `insertAtCursor`, `caretAt`, `spell*`, `Toolbar` → imports du commun ; `toolbarCatalog.ts` reste (donnée) ; `useToolbarFamilies` → `createPersisted` (déjà L2).
- **Mentale** : `content/FieldContextMenu.tsx`, `BlockContextMenu.tsx`, `EmptyAreaContextMenu.tsx`, `descriptionHistory.ts`, `useDescriptionHistory.ts`, `descriptionMenuKit.tsx` → commun ; `SymbolBand.tsx`/`symbolSets.ts` → `SymbolBar` + `SymbolCatalog` ; champs de description/quiz : `spellcheck` activé (nouvelle fonctionnalité).

## Tests
- Déplacer `spell.test.ts`, `insertAtCursor.test.tsx`, `caretAt.test.ts`, `ContextMenus.test.tsx` (Maths) ; `descriptionHistory` tests, menus (Mentale).
- Nouveau : fusion des menus (chaque entrée des deux versions est conservée), `SymbolBar` (les deux catalogues rendent les mêmes touches qu'avant).

## Pièges
- Poids du dictionnaire français : chargement paresseux et dans un worker ; mesurer le temps de premier démarrage de Mentale avant/après.
- Les entrées de menu qui diffèrent sont **fusionnées, jamais supprimées** ; en cas de doute, garder les deux et noter dans le journal (07).
- L'alias `@dictionary-fr` doit exister dans `vite.config.ts`/`vitest.config.ts` de chaque app (ou venir d'une config commune) : le documenter dans `new-app`/`base`.

## Critères d'achèvement
- [ ] Une seule implémentation de chacun des 3 menus et de `insertAtCursor`
- [ ] Orthographe disponible dans Mentale et dans `base`
- [ ] `descriptionHistory.ts` supprimé
- [ ] CLAUDE.md : sections « Orthographe » et « Toolbar » déplacées vers le commun
- [ ] Suites vertes
