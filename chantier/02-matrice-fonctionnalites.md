# 02 — Matrice des fonctionnalités

Légende : ✅ présent · 🟡 partiel ou différent · ♻️ présent mais dupliqué · ➖ absent · ✨ bonus pour l'app qui ne l'a pas.

**Verdict** : `COMMUN` (tout va dans `shared`, l'app ne fait que configurer) · `COMMUN+SLOT` (squelette
commun, contenu de l'app injecté) · `APP` (reste propre à une app, mais branché sur un point d'accueil
commun) · `DÉJÀ` (déjà partagé, il reste à supprimer le câblage dupliqué).

**Version retenue** : quand deux versions divergent, laquelle sert de base (détail et raisons dans
`07-decisions-ux.md`). **Lot** : où la fonctionnalité est traitée (`lots/`).

## A. Cadre de l'application

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F01 | Cadre 3 zones (gauche, centre + barre, droite) + overlays | ✅ | ✅ | ✅ | DÉJÀ | `AppShell` | L3 |
| F02 | Bascule thème clair/sombre avec transition circulaire | ✅ | ✅ (origine haut-centre) | ♻️ (origine = clic, `view.toggleTheme`, `Mod+Shift+T`) | COMMUN | origine = clic quand il y en a un, sinon haut-centre ; id `app.toggleTheme` | L3/L4 |
| F03 | Palette de commandes | ✅ | ✅ | ✅ | DÉJÀ (câblage ♻️) | | L3 |
| F04 | Fenêtre de réglages + panneaux Raccourcis / Mises à jour | ✅ | ♻️ | ♻️ | COMMUN | panneaux standard fournis, l'app ajoute les siens | L3 |
| F05 | Mises à jour : bannière + section | ✅ | ✅ | ✅ | DÉJÀ (câblage ♻️) | | L3 |
| F06 | Écran de chargement (logo animé, plancher de durée) | ➖ | ♻️ 1,3 s | ♻️ 1,5 s | COMMUN+SLOT (marque) | 1,3 s, marque configurable | L3 |
| F07 | Bandeaux d'état / erreur globaux | ➖ | 🟡 (alerte locale dans l'arbre) | 🟡 (`.status-banner`) | COMMUN | un `StatusBanner` | L3 |
| F08 | Ids de commande typés | ➖ | ✅ (`as const`) | ♻️ (3 façades) | COMMUN | `createTypedCommands` | L1 |
| F09 | Ids standard + alias de migration | ➖ | 🟡 | 🟡 | COMMUN | espaces `app.* file.* edit.* view.* tree.* panel.*` | L1 |
| F10 | Persistance `clé → valeur` (préférences d'interface) | 🟡 | ♻️ ×8 | ♻️ ×7 | COMMUN | `createPersisted*` préfixé par l'id de l'app | L2 |
| F11 | Session (dernier fichier ouvert, dossiers dépliés) | ➖ | ♻️ | ♻️ | COMMUN | `createSessionStore` | L2/L6 |
| F12 | Fichiers de config Tauri (`appConfigDir`) | ♻️ (raccourcis) | ♻️ | ♻️ (+ `workspace.json`) | COMMUN | un utilitaire de lecture/écriture JSON versionné | L2 |
| F13 | Réglage « police d'affichage » | ➖ | ➖ | ✅ (`useAppliedFontFamily`) | COMMUN ✨ | réglage Apparence standard | L5 |
| F14 | Densité (mode condensé) | ➖ | ✅ (`useCompact`, `spacing()`) | ➖ | COMMUN ✨ | `useDensity` | L5 |
| F15 | Zoom de l'interface (50–150 %, `Mod+Plus/Minus/0`, « % » cliquable) | ➖ | ✅ | ➖ (≠ zoom du canvas) | COMMUN ✨ | version Maths (D09) | L5 |
| F16 | Correction de position des infobulles/menus sous zoom | ➖ | ✅ (CSS `[data-radix-popper-content-wrapper]`) | ➖ | COMMUN | selon spike S1 : zoom natif de la webview, sinon CSS | L5 |

## B. Barre du haut (zone centrale)

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F20 | Barre qui ne déborde jamais (`OverflowToolbar`) | 🟡 (simple `<header>`) | ✅ | ➖ (fixe, `AppToolbar` 520 l.) | COMMUN | Maths | L4 |
| F21 | Zones et ordre **fixes** (Fermer / Nouveau / Annuler … toujours au même endroit) | ➖ | 🟡 | 🟡 (ordre différent) | COMMUN | `ToolbarZones` (08) | L4 |
| F22 | Nouveau fichier / Fermer le fichier | ➖ | ✅ (`sheet.new`/`sheet.close`, s'excluent) | ✅ (`file.new` `Mod+N`, `file.close` `Mod+W`) | COMMUN | `file.new`, `file.close`, toujours en tête de zone | L4/L6 |
| F23 | Menu « Fichier » (libellés + raccourcis) | ➖ | ➖ | ✅ | COMMUN ✨ | Mentale | L4 |
| F24 | Annuler / rétablir (boutons + `Mod+Z`, `Mod+Shift+Z`) | ➖ | ✅ | ✅ | COMMUN | | L4/L6 |
| F25 | Bouton palette | ✅ | ✅ | ✅ | COMMUN | zone système | L4 |
| F26 | Bouton thème | ✅ | ✅ | ✅ | COMMUN | zone système | L4 |
| F27 | Bouton réglages | ✅ direct | ✅ direct | 🟡 menu déroulant (réglages, raccourcis, panneaux, thème) | COMMUN | direct + commande `app.shortcuts` ouvre l'onglet Raccourcis | L4 |
| F28 | Nom du fichier ouvert + état d'enregistrement | ➖ | ➖ | ✅ (nom tronqué, « ⚠ Erreur de sauvegarde ») | COMMUN ✨ | Mentale, avec état « Enregistré / Enregistrement… » | L4/L6 |
| F29 | Bascules de panneaux dans la barre | ➖ | ✅ (`PanelToggles`) | ➖ | COMMUN | zone « panneaux » | L4/L7 |
| F30 | Réglages d'affichage dans la barre (zoom, densité) | ➖ | ✅ | ➖ | COMMUN | zone « vue » | L4/L5 |

## C. Cycle de vie d'un fichier

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F40 | Nouveau fichier (dialogue) | ➖ | `NewSheetDialog` | `NewMindMapDialog` (+ `NameDialog`) | COMMUN+SLOT | dialogue commun, champs spécifiques en slot | L6 |
| F41 | Ouvrir depuis l'arbre / les récents | ➖ | ✅ | ✅ | COMMUN | | L6 |
| F42 | Ouvrir par glisser-déposer sur la fenêtre | ➖ | ➖ | ✅ (`useFileDropZone`) | COMMUN ✨ | Mentale | L6 |
| F43 | Ouvrir avec… (double-clic OS, instance unique) | ➖ | ➖ (aucune extension) | ✅ (`useLaunchFile` + Rust `file_arg`) | COMMUN | hook partagé, extensions en config | L6/L10 |
| F44 | Fermer | ➖ | ✅ | ✅ | COMMUN | | L6 |
| F45 | Dupliquer | ➖ | direct « … (copie) » | dialogue pré-remplie | COMMUN | duplication immédiate puis renommage en ligne (D07) | L8 |
| F46 | Renommer | ➖ | menu | double-clic + menu | COMMUN | double-clic, `F2`, menu | L8 |
| F47 | Supprimer (confirmation) | ➖ | compte des fichiers | « plan de suppression » détaillé | COMMUN+SLOT | `ConfirmDialog` + slot de résumé | L8 |
| F48 | Autosave anti-rebond + `flush` | ➖ | ♻️ 600 ms | ♻️ 500 ms | COMMUN | 600 ms, configurable | L6 |
| F49 | Garde : changement de fichier / fermeture de fenêtre | ➖ | 🟡 (flush au changement) | ✅ `useUnsavedChangesGuard` | COMMUN ✨ | Mentale | L6 |
| F50 | Moteur d'historique (annuler/rétablir) | ➖ | ✅ regroupement 700 ms, 200 pas | 🟡 sans plafond ni regroupement | COMMUN | Maths | L6 |
| F51 | Titre de la fenêtre (`fichier — App`) | ➖ | ➖ | ✅ | COMMUN ✨ | Mentale | L6 |
| F52 | Fichiers récents + accueil (logo + consigne + liste) | ➖ | ♻️ | ♻️ | COMMUN | `HomeScreen` + `RecentFilesList` | L6 |
| F53 | Dialogue « échec de sauvegarde » | ➖ | ➖ | ✅ | COMMUN ✨ | Mentale | L6 |
| F54 | Fichier illisible : message + réparation | ➖ | 🟡 (ligne marquée « corrompu », ni ouvrable ni réparable) | ✅ (réparation en copie) | COMMUN+SLOT | cadre commun, réparation = port de l'app | L6/L8 |
| F55 | Lecture seule / droits d'édition | ➖ | ➖ | ✅ (sync) | APP | slot « bandeau » | — |
| F56 | Synchronisation PocketBase | ➖ | ➖ | ✅ | APP | slots : badge d'état, pied de panneau | — |

## D. Barre de gauche

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F60 | Panneau redimensionnable, mémorisé | ✅ | ✅ | ♻️ (`sidebarWidth.ts`) | DÉJÀ | `createPanelWidthStorage` | L7 |
| F61 | Repli animé + rail | ✅ | ✅ `CollapsiblePanel` | 🟡 maison (32 px, bouton seul) | DÉJÀ | `CollapsiblePanel` partout | L7 |
| F62 | Rail replié : libellé vertical + compteurs | ✅ | ✅ (`TreeRailLabel`) | ➖ | COMMUN+SLOT | Maths | L7 |
| F63 | Pied d'actions, bouton de repli **toujours dernier** | ✅ | ✅ | ✅ (refait à la main) | DÉJÀ | `PanelFooter` | L7 |
| F64 | Commande de repli standard (`Mod+B`) | ➖ | `view.toggleTree` | `view.toggleSidebar` | COMMUN | `view.toggleLeftPanel` (+ alias) | L1/L7 |
| F65 | Recherche dans l'arbre (`PanelSearch`, Échap efface) | ➖ | ✅ | ✅ | DÉJÀ | marges et titre unifiés | L8 |
| F66 | Filtre supplémentaire | ➖ | « à corriger » (pied) | type de carte (select) | COMMUN+SLOT | slot `filters` | L8 |
| F67 | Recherche avancée | ➖ | ✅ (`AdvancedSearchDialog`, Orama) | 🟡 (`view.findInCards`, `app.find`) | COMMUN+SLOT | dialogue commun, corpus fourni par l'app | L8 |
| F68 | Dossiers et **sous-dossiers** (créer, déplacer, replier) | ➖ | 🟡 1 niveau (chapitres) | ✅ N niveaux, multi-racines | COMMUN | Mentale, profondeur max configurable (Maths = 1) | L8 |
| F69 | Création fichier / dossier depuis le pied et le clic droit | ➖ | ✅ | ✅ | COMMUN | | L8 |
| F70 | Tout replier / tout déplier | ➖ | ✅ `tree.toggleAll` | ✅ `view.collapseFolders` | COMMUN | `tree.collapseAll` | L8 |
| F71 | Glisser-déposer des lignes | ➖ | ✅ | ✅ | COMMUN (moteur ✅ DÉJÀ) | | L8 |
| F72 | « Déplacer vers » (sous-menu) | ➖ | ✅ | ➖ | COMMUN ✨ | Maths (accessible au clavier) | L8 |
| F73 | Ordre : manuel (Monter/Descendre) ou alphabétique | ➖ | manuel (`_ordre.json`) | alphabétique (dossiers d'abord) | COMMUN (capacité) | capacité `reorder` de l'adaptateur | L8 |
| F74 | Menu contextuel de ligne (jeu standard + slot) | ➖ | ✅ | ✅ | COMMUN+SLOT | | L8 |
| F75 | Afficher dans l'explorateur / copier le chemin | ➖ | ➖ | ✅ | COMMUN ✨ | Mentale | L8 |
| F76 | Propriétés d'un fichier | ➖ | ➖ | ✅ | APP | entrée de menu en slot | — |
| F77 | Fichiers illisibles (marqueur, masquer/afficher) | ➖ | 🟡 | ✅ | COMMUN | Mentale | L8 |
| F78 | Pastilles de ligne (« à corriger », type de carte, sync) | ➖ | ✅ | ✅ | APP via slot `badges` | | L8 |
| F79 | Plan du fichier ouvert sous l'arbre | ➖ | ✅ `SheetOutline` | ➖ | APP | slot « section » du panneau | L7 |
| F80 | Import/export, dossiers de travail multiples | ➖ | ➖ | ✅ | APP | | — |

## E. Barre de droite

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F90 | Repli animé + rail avec actions | ✅ | ✅ (rail 40 px, pastilles verticales) | 🟡 (rail 32 px, bouton seul) | DÉJÀ | `CollapsiblePanel` | L7 |
| F91 | Sections empilées / onglets (registre) | ➖ | ✅ (haut : cours ; bas : onglets Notes/Calculatrice) | ➖ | COMMUN+SLOT | Maths, généralisé en registre | L7 |
| F92 | Pastilles de bascule (barre du haut, pied, rail) | ➖ | ✅ `PanelToggles` | ➖ | COMMUN | | L7 |
| F93 | Repli automatique quand plus rien n'est allumé | ➖ | ✅ (`foldWhenEmpty`) | ➖ | COMMUN | | L7 |
| F94 | Panneau masquable par mode (quiz) | ➖ | ➖ | ✅ (retiré du cadre) | COMMUN | prop `hidden` qui garde l'état de repli | L7 |
| F95 | Largeur mémorisée | ✅ | ✅ | ♻️ (`cardDetailWidth.ts`) | DÉJÀ | | L7 |
| F96 | Contenu du panneau (cours, notes, calculatrice / fiches de carte) | ➖ | APP | APP | APP | slots | — |

## F. Zone de travail

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F100 | Zone de travail par défaut = **zone de texte** liée au fichier ouvert | ➖ (texte statique) | — | — | NOUVEAU (base) | `TextDocument` en démo | L6 |
| F101 | Écran « aucun fichier » (logo pulsant, consigne, récents) | ➖ | ♻️ | ♻️ | COMMUN | `HomeScreen` | L6 |
| F102 | Surcouche de dépôt de fichier (« Déposez … ici ») | ➖ | ➖ | ✅ | COMMUN ✨ | | L6 |
| F103 | Correcteur orthographique français (worker Hunspell) + menu de champ | ➖ | ✅ (`spell*.ts`, `FieldContextMenu`) | ➖ | COMMUN ✨ | Maths | L9 |
| F105 | Blocs maths, équations, tableaux, lignes | DÉJÀ (`equation`) | ✅ | ✅ | DÉJÀ | | — |
| F106 | Colorations d'unités / de termes semblables | ➖ | ✅ | ➖ | APP | | — |
| F107 | Correction (« corrigé », « à revoir »), cours suggérés | ➖ | ✅ | ➖ | APP | | — |
| F108 | Canvas de carte mentale, quiz, fiches | ➖ | ➖ | ✅ | APP | | — |

## F bis. Édition de contenu (blocs, champs, symboles)

Doublons trouvés en fin d'analyse : trois paires de menus contextuels, deux barres de symboles, un troisième
moteur d'historique. Les trois menus de Maths sont plus courts (137 / 53 / 42 l.) que ceux de Mentale
(161 / 161 / 171 l.) ; la base commune se décide à partir de la plus complète (Mentale), en gardant le
correcteur orthographique (Maths).

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F110 | Menu contextuel de champ texte (couper/copier/coller, correction) | ➖ | `exercises/FieldContextMenu.tsx` (+ orthographe) | `content/FieldContextMenu.tsx` (sans orthographe) | COMMUN | fusion : jeu d'actions de Mentale + corrections de Maths | L9 |
| F111 | Menu contextuel de bloc | ➖ | `BlockContextMenu.tsx` | `content/BlockContextMenu.tsx` | COMMUN+SLOT | squelette commun, actions de bloc en slot | L9 |
| F112 | Menu contextuel de zone vide | ➖ | `EmptyAreaContextMenu.tsx` | `content/EmptyAreaContextMenu.tsx` | COMMUN+SLOT | idem | L9 |
| F113 | Barre de symboles à insérer (familles, teintes, LaTeX / texte) | ➖ | `toolbarCatalog.ts` + `Toolbar.tsx` (données + barre) | `SymbolBand.tsx` + `symbolSets.ts` + `symbolTabs.ts` | COMMUN+SLOT | rendu commun, catalogue = donnée de l'app (Maths garde le format `glyph/latex/plain`) | L9 |
| F114 | Historique local d'un champ (description) | ➖ | — | `descriptionHistory.ts` + `useDescriptionHistory.ts` | COMMUN | réutilise `createHistoryStore` (L6) | L9 |
| F115 | Insertion au curseur, position du curseur | ➖ | `insertAtCursor.ts`, `caretAt.ts` | doublons partiels | COMMUN | Maths | L9 |

## G. Plateforme

| ID | Fonctionnalité | Base | Maths | Mentale | Verdict | Version retenue | Lot |
|---|---|---|---|---|---|---|---|
| F120 | Constructeur Tauri (`suite_tauri::builder`) | ✅ | ✅ | ✅ | DÉJÀ | | L10 |
| F121 | Mémoire de la taille/position de la fenêtre | ➖ | ➖ | ➖ | COMMUN ✨ (nouveau) | plugin `window-state` ou équivalent | L10 |
| F122 | `capabilities/default.json` : socle commun + ajouts par app | ♻️ | ♻️ (étroit) | ♻️ (large) | COMMUN | socle vérifié par un test ; scopes `fs` propres à chaque app | L10 |
| F123 | `new-app` : une seule chaîne à renommer | 🟡 (remplace des chaînes dans `App.tsx`) | | | COMMUN | `defineApp({ id })` | L10 |
| F124 | Test de conformité d'app | ➖ | ➖ | ➖ | NOUVEAU | `describeAppContract` | L0 |
| F125 | Mesure du taux de mutualisation | ➖ | ➖ | ➖ | NOUVEAU | `scripts/measure-sharing.mjs` | L0 |

## Autres points proposés (non cités dans la demande initiale)

Repérés pendant l'analyse ; chacun est dans la matrice ci-dessus avec son lot.

1. **Titre de fenêtre** (F51), **garde de fermeture** (F49), **dépôt de fichier** (F42) : Mentale les a, Maths non.
2. **Dialogue d'échec de sauvegarde / fichier illisible** (F53, F54) : un élève de Maths n'est pas prévenu aujourd'hui.
3. **Réglage de police et densité** (F13, F14) : dans Apparence, pour toutes les apps.
4. **Correcteur orthographique** (F103) : utile aussi aux descriptions de cartes de Mentale.
5. **Mémoire de la fenêtre** (F121) : taille et position retrouvées au lancement.
6. **Test de conformité** (F124) : garantit que « Fermer » reste au même endroit dans toute future app.
7. **Mesure des 95 %** (F125) : un chiffre plutôt qu'une impression.
8. **Capacités Tauri** (F122) : un test qui échoue si une app oublie un droit du socle.
