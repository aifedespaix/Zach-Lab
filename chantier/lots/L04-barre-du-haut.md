# L4 — Barre du haut : zones imposées

> **Ajouts 2026-10-10** : voir `../ajustements/ajouts-aux-lots.md` § L4 et le lot A2.

**Taille** : L · **Dépend de** : L1, L3 · **Fonctionnalités** : F20–F30 · **Décisions** : D02, D03, D16

## Objectif
Une barre qui ne déborde jamais, dont les zones et l'ordre sont imposés par le commun : *Fermer / Nouveau*, *Annuler / Rétablir*, le titre,
les panneaux, la vue et le système sont **toujours au même endroit**. Le menu « Fichier » de Mentale et l'adaptation de Maths sont réunis.

## À lire
- `packages/shared/src/shell/OverflowToolbar.tsx` (+ test), `commands/{CommandButton,CommandMenuItem}.tsx`
- `apps/zachart-maths/src/App.tsx` (l. 117–172 : `toolbarItems`, priorités)
- `apps/zachart-mentale/src/components/toolbar/AppToolbar.tsx` (520 l.) et `AppToolbar.test.tsx`
- `apps/zachart-maths/src/cours/PanelToggles.tsx`
- `chantier/04-zone-centrale.md` §1

## Chantier 2 — extraction (`@suite/shared/shell`)
- `ToolbarZones` : `defineToolbar(items)` + composant `<AppToolbar>` basé sur `OverflowToolbar` ; zones `file · edit · title · app · panels · view · system`, ordre fixe,
  priorités par zone (file & system les plus hautes). Items standard fournis par le commun si la commande existe dans le catalogue :
  - `file` : `file.new` ↔ `file.close` (un seul emplacement, bascule selon `hasOpenFile`), menu « Fichier » (`FileMenu`, liste de commandes `file.*` + `tree.newFolder` selon le catalogue, raccourcis affichés).
  - `edit` : `edit.undo`, `edit.redo` (activés par `canUndo/canRedo` de l'historique).
  - `title` : `FileTitle` (nom tronqué, `title=chemin`, état « Enregistré / Enregistrement… / ⚠ Erreur de sauvegarde » — l'état vient de `useFileSession` au L6 ; ici une prop).
  - `panels` : `PanelToggles` (stub vide jusqu'au L7).
  - `view` : vide jusqu'au L5.
  - `system` : `app.palette`, `app.toggleTheme` (`ThemeToggle`), `app.settings`.
- Les items de l'app se posent dans `app` avec `priority`. Une app peut masquer un item standard (`hide: ['file.menu']`).
- `FileMenu` : `DropdownMenu` avec `CommandDropdownItem` par commande ; groupes séparés par un filet.

## Chantier 3 — migration
- **Maths** : `toolbarItems` (App.tsx l. 117–172) → `app` : suivant à corriger, revue, couleurs, condensé (le zoom/condensé passeront en zone `view` au L5, les pastilles de panneaux en zone `panels` au L7). Gagne : titre de la fiche, menu « Fichier ».
- **Mentale** : `AppToolbar.tsx` perd la mise en page (flex, boutons communs, menu réglages) et ne déclare plus que ses items `app` : carte flottante, exporter, révéler, quiz, cadenas, mise à jour (`UpdateCheckHandle`), synchronisation. Le dialogue d'export, de nom, de suppression restent dans l'app.
- Le bouton de thème utilise `ThemeToggle` (origine au clic).
- Suppression du menu déroulant « Paramètres et raccourcis » (D03).

## Tests
- `OverflowToolbar` reste testé tel quel ; ajouter les tests de zones (ordre, priorité, masquage, un seul emplacement Nouveau/Fermer).
- `describeAppContract` : activer (a) *Fermer* est dans la zone `file` avant *Annuler*, (b) l'ordre des zones, (c) `app.shortcuts` ouvre l'onglet Raccourcis.
- `AppToolbar.test.tsx` de Mentale : conserver chaque cas métier (quiz, cadenas, export, révéler, publication) ; adapter seulement l'accès aux boutons si leur zone change.

## Pièges
- Mentale a un grand nombre d'états conditionnels dans la barre (quiz actif → barre masquée, lecture seule, fichier absent) : ils deviennent des conditions de pose d'items (`when`).
- Le nom du fichier est aujourd'hui rendu **après** la barre ; il passe dans la barre (zone `title`) — vérifier la troncature avec le titre long.
- `variant="outline"` des boutons de Mentale vs `ghost` de Maths : le commun impose `ghost` + `size="icon-sm"` ; les styles spéciaux restent via `className` (ex. `toolbar-quiz--rainbow`).

## Critères d'achèvement
- [ ] Même ordre de zones dans base, Maths, Mentale (contrat)
- [ ] `AppToolbar.tsx` de Mentale < 250 lignes
- [ ] Plus de `<header>` de barre écrit à la main dans une app
- [ ] CLAUDE.md : « Barre du haut »
- [ ] Suites vertes
