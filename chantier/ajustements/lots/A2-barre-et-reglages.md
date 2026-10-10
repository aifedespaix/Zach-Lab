# A2 — Barre du haut et réglages

**Taille** : L · **Dépend de** : L3, L4 (extraits) · **Modèle** : Sonnet · **Dans** : `packages/shared/src/{app,shell,settings,commands}`

## 2a. Bouton de thème retiré de la barre
Le thème est déjà dans Paramètres (panneau Apparence). `app.toggleTheme` reste une commande (palette, raccourci) mais l'item de barre disparaît **par défaut** dans `SuiteApp`. Il redevient activable via 2b. Maths/Mentale gardent le leur jusqu'à leur migration (chantier 3).

## 2b. Onglet de réglages « Boutons de la barre »
- Panneau standard `ToolbarSettingsPanel` (`standardSettings({ toolbar })`) : une case par item de barre de l'app (libellé, raccourci, icône), groupées par zone. Appliqué tout de suite, sans brouillon (comme « Apparence »).
- **Verrouillés (cochés, grisés)** : `file.newOrClose` (nouveau/fermer), `edit.undo`, `edit.redo`, `app.settings`. Constante `LOCKED_TOOLBAR_ITEMS` dans `shell`. Le menu « Fichier » reste aussi (il porte des actions verrouillées).
- Désactivables : tout item des zones `app`, `panels`, `view`, plus `app.palette`, `app.toggleTheme`. Exemples Mentale : Quiz, Afficher l'explorateur.
- Un item masqué reste une **commande** (raccourci et palette marchent toujours) ; seul le bouton disparaît (pas non plus dans le « … »).
- Stockage : `createPersisted` + `persistedSet`, clé `<id>:toolbar-hidden`. Un id inconnu est ignoré (app mise à jour).
- Fonction pure `visibleToolbarItems(items, hidden)` : un verrouillé n'est jamais retiré, même présent dans `hidden` (donnée corrompue).

## 2c. Raccourcis dans les noms d'onglet + ouverture directe
- `SettingsPanel` gagne `shortcut?` (ex. `F1`) rendu dans l'onglet à droite du nom (même composant de touche que la palette), avec `aria-keyshortcuts`.
- Chaque panneau avec raccourci enregistre `settings.open.<id>` (`allowInEditable`) : **fenêtre fermée → l'ouvre sur cet onglet ; ouverte → bascule sur l'onglet**. `app.shortcuts` devient l'instance du panneau « Raccourcis ».
- Défauts proposés : Raccourcis `F1`, Apparence `F3`, Boutons `F4`, Mises à jour `F5`. **`F2` est réservé au renommage (L8)** ; vérifier l'absence de conflit avec `standardCommands`, consigner dans `07-decisions-ux.md`. Reconfigurables dans « Raccourcis ».

## 2d. Bouton « fermer » commun, noir
`file.close` (slot `file.newOrClose`) a un style commun : bouton plein sombre (comme Mentale), `aria-label` « Fermer », même place partout. Maths l'adopte à sa migration L4 ; d'ici là, remplacer son bouton « fermer la fiche » par le composant commun si cela se fait sans migrer toute la barre, sinon le noter dans `suivi.md`.

## Tests d'abord
`visibleToolbarItems`, verrous du panneau, persistance, raccourci d'onglet (fenêtre fermée/ouverte), conflit de raccourci, contrat : « le bouton Quiz peut être masqué et sa commande répond encore ».

## Critères d'achèvement
- [ ] `base` : pas de thème dans la barre, onglet « Boutons » fonctionnel, raccourcis dans les onglets
- [ ] CLAUDE.md : sections « App frame » et « Top bar » mises à jour
