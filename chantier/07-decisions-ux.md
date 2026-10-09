# 07 — Décisions UX à valider

Chaque ligne tranche une divergence ou un choix de conception. **Recommandation** = ce que je ferais ;
**Choix** = à remplir par toi (`[x]` pour valider, ou écris l'alternative). Un lot qui dépend d'une décision
non validée la prend telle que recommandée **et le signale** dans `suivi.md` (« décision D0x prise par défaut »).

Critère de choix quand deux versions divergent : (1) pas de perte de fonctionnalité, (2) la plus complète,
(3) la plus économe en gestes / la plus lisible, (4) la plus accessible (clavier, lecteur d'écran), (5) la
moins fragile techniquement.

---

### D01 — Identifiants de commandes standard et alias
- **Problème** : mêmes actions, noms différents (`sheet.new` / `file.new`, `view.toggleTree` / `view.toggleSidebar`,
  `app.toggleTheme` / `view.toggleTheme`…) et les raccourcis personnalisés sont stockés par id.
- **Recommandation** : adopter les ids standard de `06-transversal.md` §1 ; **alias obligatoires** pour tout
  id renommé, lus avant la validation des raccourcis enregistrés. Aucun alias n’est retiré sans décision explicite (L11 les conserve).
- **Impact** : Mentale renomme 5 ids, Maths 6. Aucune perte pour les élèves.
- **Choix** : [ ] recommandé

### D02 — Barre du haut : zones imposées + menu « Fichier »
- **Problème** : deux ordres différents ; Mentale a le menu « Fichier », Maths la barre adaptative.
- **Recommandation** : `OverflowToolbar` partout ; zones `fichier · édition · titre · app · panneaux · vue · système` ;
  menu « Fichier » (libellés + raccourcis) dans la zone *fichier* des apps qui ont plus de deux actions de fichier ;
  *Fermer/Nouveau* en tête, jamais déplacés.
- **Impact** : Maths gagne le titre + menu « Fichier » ; Mentale gagne l'adaptation à la largeur. Les boutons
  propres à Mentale (quiz, cadenas, exporter, révéler…) passent en zone *app*.
- **Choix** : [ ] recommandé

### D03 — Réglages : un bouton direct
- **Recommandation** : bouton ⚙ qui ouvre le dialogue ; `app.shortcuts` (palette/raccourci) ouvre l'onglet Raccourcis ;
  la bascule des panneaux vit dans la zone *panneaux*. Le menu déroulant de Mentale disparaît.
- **Choix** : [ ] recommandé

### D04 — Barres latérales : `CollapsiblePanel` partout
- **Recommandation** : Mentale adopte `CollapsiblePanel` pour la gauche et la droite ; rail avec libellé
  vertical (« Cartes mentales · n », « Fiches · n ») ; pied d'actions avec **repli en dernier** (gauche) /
  **à l'intérieur** (droite). Le `CLAUDE.md` actuel (« trop spécifique pour migrer ») est corrigé.
- **Impact** : rail de 32 → 40 px côté Mentale quand il porte des actions ; le reste est identique.
- **Choix** : [ ] recommandé

### D05 — Dossiers et sous-dossiers
- **Recommandation** : composant commun à profondeur illimitée ; config `maxFolderDepth` (Maths = 1, Mentale = ∞)
  et `roots: 'single' | 'multiple'`. Activer les sous-chapitres dans Maths est une décision produit **séparée**
  (changement du modèle `library.ts` / `_ordre.json`), non incluse ici.
- **Choix** : [ ] recommandé  /  [ ] activer aussi les sous-chapitres dans Maths (lot dédié après L8)

### D06 — Renommer
- **Recommandation** : champ en ligne ouvert par double-clic, `F2` ou « Renommer » (menu) ; Entrée valide, Échap annule,
  perte de focus valide. (Maths n'avait que le menu ; Mentale n'avait pas `F2`.)
- **Choix** : [ ] recommandé

### D07 — Dupliquer
- **Problème** : Maths duplique tout de suite ; Mentale ouvre un dialogue de nom pré-rempli.
- **Recommandation** : duplication **immédiate**, la copie apparaît sous l'original en **mode renommage en ligne**
  (un geste de moins que le dialogue, et le nom reste modifiable).
- **Choix** : [ ] recommandé  /  [ ] garder le dialogue de Mentale

### D08 — Supprimer
- **Recommandation** : `ConfirmDialog` commun avec un slot de résumé (Maths : « 3 exercices » ; Mentale : plan de
  suppression détaillé, dont ce qui est effacé côté serveur). Bouton destructif, focus sur « Annuler ».
- **Choix** : [ ] recommandé

### D09 — Zoom : interface et canvas
- **Problème** : `view.zoom*` désigne deux choses ; `Mod+Plus/Minus/0` est pris deux fois.
- **Recommandation** : le zoom d'**interface** (50–150 %, pas de 10, « % » cliquable, `Mod+Plus/Minus/0`) devient commun
  et s'applique à toute l'app, Mentale incluse. Le zoom du **canvas** devient `canvas.zoomIn/Out/Reset/fit`
  (`Mod+Alt+Plus/Minus/0`, `Mod+Alt+F`), boutons de la vue canvas et molette inchangés.
  L'implémentation (zoom natif de la webview ou CSS) est tranchée par le spike S1.
- **Choix** : [ ] recommandé  /  [ ] zoom d'interface seulement dans Maths (Mentale garde son zoom de canvas sur `Mod+Plus…`)

### D10 — Écran de chargement
- **Recommandation** : plancher unique **1 300 ms** (configurable) ; marque animée configurable (M pour Maths, Z pour
  Mentale) via `AnimatedMark` ; même enchaînement de points/tracés.
- **Choix** : [ ] recommandé

### D11 — Erreurs et bandeaux
- **Recommandation** : erreur **globale** (chargement impossible, dépôt refusé, sauvegarde échouée) → pile de
  `StatusBanner` au-dessus de la zone de travail ; erreur **locale** (une opération sur l'arbre) → alerte dans le panneau
  concerné avec bouton « Fermer ». L'état d'enregistrement (« Enregistré », « Enregistrement… », « ⚠ Erreur de
  sauvegarde ») s'affiche à côté du titre, dans la barre.
- **Choix** : [ ] recommandé

### D12 — Autosave et historique
- **Recommandation** : anti-rebond **600 ms** (configurable), `flush` obligatoire avant : changement de fichier, fermeture
  du fichier, fermeture de la fenêtre. Historique : 200 pas, regroupement 700 ms **pour les frappes** (clé de groupe),
  une action discrète = un pas. Maths gagne la garde de fermeture ; Mentale gagne le regroupement et le plafond.
- **Choix** : [ ] recommandé

### D13 — Écran « aucun fichier »
- **Recommandation** : logo pulsant, consigne de l'app, liste des récents (10 max, temps relatif) ; fichiers disparus
  masqués (comportement Mentale). Surcouche de dépôt « Déposez … ici » dans toutes les apps.
- **Choix** : [ ] recommandé

### D14 — Panneau de droite : sections déclaratives
- **Recommandation** : registre `definePanelSections` (haut/bas, onglets par groupe, pastilles en barre/pied/rail,
  repli auto quand tout est éteint, ouverture auto à l'allumage). Mentale déclare la section « Fiches ».
- **Choix** : [ ] recommandé

### D15 — En-têtes de panneau et états vides
- **Recommandation** : en-tête `8px 12px`, titre en `13px / 600`, champ de recherche pleine largeur dessous ; textes
  d'état vide/chargement/erreur issus de la config (« Chargement des exercices… », « Aucun dossier configuré. »).
- **Choix** : [ ] recommandé

### D16 — Thème
- **Recommandation** : un seul `ThemeToggle` ; origine de l'animation = point cliqué si événement souris, sinon
  haut-centre ; `Mod+Shift+T` par défaut dans **toutes** les apps (Maths : aucun aujourd'hui).
- **Choix** : [ ] recommandé

### D17 — Correcteur orthographique
- **Recommandation** : partagé, chargé à la demande (worker), activé par champ (`spellcheck` sur les `HighlightedTextarea`,
  champs de description de Mentale, zone de texte de `base`). Le dictionnaire (poids) n'est chargé qu'à la
  première frappe dans un champ qui l'active.
- **Choix** : [ ] recommandé

### D18 — Fenêtre
- **Recommandation** : titre `fichier — App` ; taille/position mémorisées (plugin `window-state` ou équivalent
  maison dans `suite-tauri`).
- **Choix** : [ ] recommandé

### D19 — Fichiers illisibles
- **Recommandation** : marqueur d'avertissement sur la ligne (ni ouvrable, ni silencieux), actions « Supprimer »,
  « Déplacer », « Afficher dans l'explorateur » ; réparation (copie) proposée si l'app fournit un `repair` ;
  bascule « afficher/masquer les illisibles » dans le pied.
- **Choix** : [ ] recommandé

---

## Journal des décisions (rempli par les lots)

| Date | Décision | Prise par | Lot |
|---|---|---|---|
| | | | |
| 2026-10-09 | D01, D16 appliquées par défaut (ids standard + alias ; `Mod+Shift+T` pour le thème dans `base`) | recommandation | L1 |
| 2026-10-09 | Entorse : `createPersisted` n'a pas de `version` ; une entrée ancienne passe par `migrate`, les fichiers par `readVersioned` | extraction | L2 |
