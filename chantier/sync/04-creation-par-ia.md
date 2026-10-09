# 04 — Création par IA depuis l'app

## Parcours

Visible **uniquement pour un prof authentifié**. L'élève crée via l'interface normale.

1. « Nouveau fichier » → modale de départ : **Fichier vierge** / **Générer avec une IA**.
2. « Générer avec une IA » → modale :
   - une explication courte (3 lignes) : « Copiez le pré-prompt, collez-le dans votre assistant IA
     (Claude, ChatGPT…), ajoutez votre demande à la suite, puis collez ici la réponse. » ;
   - un champ « type de fichier » (cours, exercice…) : le pré-prompt dépend du type ;
   - bouton **Copier le pré-prompt** ;
   - une **zone de texte** pour coller la réponse ;
   - le **validateur** en direct, un **aperçu**, et le choix des destinataires ;
   - **Enregistrer** (désactivé tant qu'il reste une erreur).
3. L'app génère l'`id` et les métadonnées, écrit le fichier dans le dossier de synchro (chemin proposé
   modifiable) ; la synchro le traite comme n'importe quel fichier.

## Le validateur

Contrat : `validate(text) → { ok, errors[], warnings[], preview?, normalized? }`.

- **Tolérant à l'entrée** : extrait le JSON d'un bloc ```json … ``` ou d'un texte entouré de prose ;
  accepte les guillemets typographiques courants ; ne touche pas au contenu.
- **Erreurs** (bloquent l'enregistrement) : JSON invalide, champ obligatoire manquant, type inconnu,
  référence cassée (« carte 12 : parent introuvable »). Message précis et localisé.
- **Avertissements** (n'empêchent PAS d'enregistrer) : texte vide, carte sans enfant, fichier très gros.
- **Réparation** : bouton « Réparer automatiquement » quand l'app sait corriger (Mentale :
  `repairCards`). Les corrections sont listées avant d'être appliquées.
- **Aperçu** : résumé (« 34 cartes, 5 niveaux ») ou mini-vue fournie par l'app (`renderPreview`).
- Réutilise les validateurs existants : `validateCards`/`repairCards` (Mentale), `parseBlocks` /
  lecture de fiche (Maths). Rien de copié.

## Le pré-prompt : une source unique

- Déclaré par l'app : `defineApp({ aiPrompts: { cours: …, exo: … } })` (texte + exemple minimal +
  rappel « réponds uniquement par le JSON, sans texte autour »).
- La **skill du dépôt** (`.claude/skills/…`) et le pré-prompt de l'app ne doivent pas diverger : le
  pré-prompt est généré depuis la skill (ou la skill le référence) par un script, vérifié par un test.
- Le pré-prompt contient le schéma exact, un exemple minimal valide, et les règles de nommage du dossier.
- L'`id` n'est PAS demandé à l'IA : l'app le pose (évite les faux `id` recopiés).

## Dépôt manuel de fichiers

Reste possible (dossier de synchro). Un fichier sans `id` en reçoit un à la première synchro ; un
fichier invalide est signalé et jamais poussé (cas 14). Le prof avancé peut donc aussi travailler avec
la skill en CLI.

## Extension prévue (hors v1) : « Corriger avec une IA »

Même modale, `mode: 'corriger'`, contexte = la copie de l'élève ajoutée au pré-prompt. La modale prend
déjà `mode` et `contexte` pour ne pas être refaite. **Avertissement de confidentialité** obligatoire :
coller le travail d'un élève (souvent mineur) dans un service externe est une décision du prof.

## Où ça vit

`@suite/shared/sync` (ou `@suite/shared/ai-create`) : `AiCreateDialog` avec `prompt`, `validate`,
`renderPreview`, `onSave(parsed, destinataires)`. L'app injecte tout ; la modale ne connaît aucun format.
