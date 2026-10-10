# Bloc commun : compte rendu d'avancement GLOBAL

> Ce bloc est référencé par `chantier-2-extraction.md`, `chantier-3-migration.md` et `ajustements.md`. À la toute fin de la session,
> **après** le compte rendu du lot traité, produis ce tableau de bord. Il se calcule en LISANT les trois fichiers de suivi
> (jamais de mémoire) :
> - `chantier/suivi.md` — Harmonie (lots L0–L11)
> - `chantier/ajustements/suivi.md` — Ajustements (lots A0–A6)
> - `chantier/sync/suivi.md` — Synchro (lots S0–S11)

## Format (court, en français, tableau)

```
AVANCEMENT GLOBAL — <date>
| Chantier   | Terminés | En cours / extraits | À faire | Prochain lot (dépendances OK) |
|------------|----------|---------------------|---------|-------------------------------|
| Harmonie   | x / 12   | …                   | …       | Lxx — titre                   |
| Ajustements| x / 6    | …                   | …       | Axx — titre                   |
| Synchro    | x / 12   | …                   | …       | Sx — titre                    |
Harmonie, détail : L0 ✔ L1 ✔ L2 ✔ L3 extrait L4 extrait L5 extrait L6 … (un symbole par lot : terminé / extrait / migré Maths / migré Mentale / à faire)
Tests : <total>  ·  Mutualisation base : <%>  ·  Branche : <nom>, non fusionnée / fusionnée
Bloqué ou en attente de TOI : <décisions UX par défaut à valider, parcours manuels à faire, questions ouvertes>
À lancer ensuite (dans l'ordre) : 1) … 2) …  — modèle conseillé pour chacun : Haiku / Sonnet (+ pourquoi en 5 mots)
```

## Règles
- Un lot « extrait » n'est PAS terminé : l'écrire tel quel.
- Si deux suivis se contredisent (ex. un lot A repris par un lot L), le signaler, ne pas trancher en silence.
- Ne rien inventer : si un fichier de suivi est illisible ou vide, le dire.
- Le « prochain lot » respecte les dépendances et l'ordre recommandé dans `chantier/ajustements/README.md`.
