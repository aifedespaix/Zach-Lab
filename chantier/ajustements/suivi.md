# Suivi des lots — chantier « Ajustements »

États : `à faire` → `en cours` → `terminé`. Lu et mis à jour par `../prompts/ajustements.md`.

| Lot | Titre | Taille | Dépend de | Fichier | État | Notes |
|---|---|---|---|---|---|---|
| A0 | Correctifs : renommer dossier (clic droit), modale « nouvelle carte » | S | — | [lots/A0-correctifs.md](lots/A0-correctifs.md) | en cours | Modale corrigée (Mentale + Maths, `sm:max-w-lg`, champs `w-full`/`min-w-0`) : `NewFileDialog` (L6) doit reprendre ce gabarit. Renommage par menu : NON reproduit (jsdom ni Chromium) ; démarrage déplacé dans `onCloseAutoFocus`, à confirmer dans Tauri. Maths `ExerciseTree` : déjà gardé (`keepNameFocus`), non reproduit. |
| A1 | `ComboboxSelect` / `FolderPicker` (select avec recherche) | M | A0 (taille modale) | [lots/A1-select-avec-recherche.md](lots/A1-select-avec-recherche.md) | à faire | |
| A2 | Barre et réglages : thème masqué, onglet « Boutons », raccourcis d'onglets, bouton fermer commun | L | L3, L4 | [lots/A2-barre-et-reglages.md](lots/A2-barre-et-reglages.md) | à faire | |
| A3 | Parité Maths ↔ Mentale ↔ Base : audit (A3a) puis mise en commun (A3b), recherche avancée partout | L | A3b après L8 | [lots/A3-parite-des-features.md](lots/A3-parite-des-features.md) | à faire | |
| A4 | Maths : arbre ouvert par défaut, barre de droite (mémoire des pastilles) | S | (L7 le généralise) | [lots/A4-maths-defauts-et-panneau-droit.md](lots/A4-maths-defauts-et-panneau-droit.md) | à faire | |
| A6 | Base : gestion de fichiers complète + port de synchro configurable | L | L6, L7, L8 | [lots/A6-base-gestion-fichiers.md](lots/A6-base-gestion-fichiers.md) | à faire | |

## Journal
| Date | Lot | Note |
|---|---|---|
| 2026-10-10 | — | Chantier créé à partir des retours utilisateur ; ajouts consignés dans L4, L6, L7, L8. |
| 2026-10-10 | A0 | Modale « nouvelle carte » corrigée ; renommage clic droit non reproduit hors Tauri, correctif défensif en attente de confirmation utilisateur. |
