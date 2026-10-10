# Suivi des lots — chantier « Ajustements »

États : `à faire` → `en cours` → `terminé`. Lu et mis à jour par `../prompts/ajustements.md`.

| Lot | Titre | Taille | Dépend de | Fichier | État | Notes |
|---|---|---|---|---|---|---|
| A0 | Correctifs : renommer dossier (clic droit), modale « nouvelle carte » | S | — | [lots/A0-correctifs.md](lots/A0-correctifs.md) | terminé | Modale corrigée (Mentale + Maths, `sm:max-w-lg`, `max-h-[85vh] overflow-y-auto`, champs `w-full`/`min-w-0`) : `NewFileDialog` (L6) doit reprendre ce gabarit. Renommage par menu : démarrage déplacé dans `onCloseAutoFocus`, confirmé dans Tauri par l'utilisateur. Maths `ExerciseTree` : déjà gardé (`keepNameFocus`), non reproduit. |
| A1 | `ComboboxSelect` / `FolderPicker` (select avec recherche) | M | A0 (taille modale) | [lots/A1-select-avec-recherche.md](lots/A1-select-avec-recherche.md) | terminé | `ComboboxSelect` + `FolderPicker` dans `shared/ui`, branchés dans `NewMindMapDialog` et `NewSheetDialog`. « Déplacer vers… » (L8) : point d'accroche `FolderPicker allowRoot` prêt, à brancher au L8. Parcours manuel à faire dans Tauri. |
| A2 | Barre et réglages : thème masqué, onglet « Boutons », raccourcis d'onglets, bouton fermer commun | L | L3, L4 | [lots/A2-barre-et-reglages.md](lots/A2-barre-et-reglages.md) | terminé | Thème masqué par défaut ; onglet « Boutons » (`ToolbarSettingsPanel`, `<id>:toolbar-hidden`) ; raccourcis d'onglets F1/F3/F4/**F6** (F5 = `tree.refresh`, voir `07-decisions-ux.md`) avec bascule fenêtre ouverte ; « Fermer » plein sombre (base + bouton de Maths, libellé « Fermer la fiche » conservé). Parcours manuel à faire dans Tauri. |
| A3 | Parité Maths ↔ Mentale ↔ Base : audit (A3a) puis mise en commun (A3b), recherche avancée partout | L | A3b après L8 | [lots/A3-parite-des-features.md](lots/A3-parite-des-features.md) | à faire | |
| A4 | Maths : arbre ouvert par défaut, barre de droite (mémoire des pastilles) | S | (L7 le généralise) | [lots/A4-maths-defauts-et-panneau-droit.md](lots/A4-maths-defauts-et-panneau-droit.md) | à faire | |
| A6 | Base : gestion de fichiers complète + port de synchro configurable | L | L6, L7, L8 | [lots/A6-base-gestion-fichiers.md](lots/A6-base-gestion-fichiers.md) | à faire | |

## Journal
| Date | Lot | Note |
|---|---|---|
| 2026-10-10 | — | Chantier créé à partir des retours utilisateur ; ajouts consignés dans L4, L6, L7, L8. |
| 2026-10-10 | A0 | Modale « nouvelle carte » corrigée ; renommage clic droit non reproduit hors Tauri, correctif défensif en attente de confirmation utilisateur. |
| 2026-10-10 | A1 | `ComboboxSelect`/`FolderPicker` ajoutés et branchés (Mentale, Maths) ; tests clavier/filtre/Échap en modale verts. |
| 2026-10-10 | A0 | Validé par l'utilisateur dans Tauri (renommage par clic droit + modale « nouvelle carte ») : A0 `terminé`. |
| 2026-10-10 | A2 | Barre et réglages faits dans `shared` + `base` ; Maths : seul le style du bouton fermer. Mentale garde sa barre jusqu'à sa migration L4. |
