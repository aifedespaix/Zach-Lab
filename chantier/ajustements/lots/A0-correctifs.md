# A0 — Correctifs

**Taille** : S · **Dépend de** : — · **Modèle** : Sonnet

## 1. Clic droit sur un dossier → « Renommer » : le champ flashe puis n'est pas éditable
Le double-clic fonctionne, donc le champ en ligne existe : c'est le chemin « menu contextuel » qui perd le focus.
**Hypothèse à vérifier d'abord** (ne pas corriger à l'aveugle) : à la fermeture du menu Radix, `onCloseAutoFocus` rend le focus au déclencheur,
ce qui déclenche le `blur` du champ → le renommage est validé/annulé aussitôt. Pistes : `onCloseAutoFocus={(e) => { if (renaming) e.preventDefault() }}`
sur le `ContextMenuContent`, ou armer le mode renommage après `onOpenChange(false)` (`requestAnimationFrame`).
- Lire : `apps/zachart-mentale/src/components/sidebar/FileTreeRow.tsx` (menu + mode renommage), `FileTreeRow.test.tsx`.
- **Test d'abord** (reproduit le bug) : ouvrir le menu contextuel d'un dossier, choisir « Renommer », vérifier que l'`input` est dans le DOM, **a le focus après un tick**, qu'on peut taper puis valider avec Entrée. Idem pour un fichier.
- Vérifier le même chemin dans Maths (`ExerciseTree`, menu d'un chapitre) ; corriger aussi s'il est atteint.
- Quand L8 extrait `FileTree`, ce test déménage avec lui (assertions intactes).

## 2. Modale « nouvelle carte mentale » trop petite
- Lire : `components/NewMindMapDialog.tsx` + test. Les champs dépassent : largeur de `DialogContent` trop étroite, ou champs sans `min-w-0` / `w-full` dans une grille.
- Corriger la largeur (`max-w-lg` ou plus selon le contenu, `max-h` + défilement interne), `min-w-0` sur les enfants de grille. Vérifier à zoom 150 % et en mode condensé.
- Même vérification pour `NewSheetDialog` (Maths) ; si les deux partagent le gabarit, noter dans `suivi.md` que `NewFileDialog` (L6) doit reprendre la bonne taille.
- Capture avant/après via `node scripts/baseline-shots.mjs zachart-mentale` si la modale y figure, sinon description écrite.

## Critères d'achèvement
- [ ] Test rouge puis vert pour le renommage par menu (dossier ET fichier)
- [ ] Modale lisible sans débordement à 100 % et 150 %
- [ ] `bun run test` vert, `bunx tsc --noEmit -p apps/zachart-mentale`
