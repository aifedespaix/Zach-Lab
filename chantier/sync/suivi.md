# Suivi des lots — chantier « Synchro »

États : `à faire` → `en cours` → `terminé`. Le prochain lot = le premier non terminé dont les dépendances le sont.

| Lot | Titre | Taille | Dépend de | État | Notes |
|---|---|---|---|---|---|
| S0 | Décisions et cadrage | S | — | terminé | Décisions prises : voir `06-lots.md` (2 questions non bloquantes restent) |
| S1 | Serveur unique | M | S0 | en cours | Déplacement d'`infra/` à la racine : fait. Reste : schéma `files`, hook `rev`, migration |
| S2 | Moteur pur | L | S0 | à faire | |
| S3 | Droits | S | S2 | à faire | |
| S4 | Adaptateur et exécution | L | S1, S2 | à faire | |
| S5 | Intégration `SuiteApp` + base | M | S4, Harmonie L3 | à faire | |
| S6 | Conflits (UI) | M | S5 | à faire | |
| S7 | Prof et élèves | L | S3, S5 | en cours | Inscription prof, gestion des élèves : livré par le plan 2026-10-10-site-comptes (distribution, copies, corbeille restent à faire) |
| S8 | Création par IA | M | S5 | à faire | |
| S9 | Migration de Mentale | XL | S6, S7 | à faire | |
| S10 | Migration de Maths | L | S6, S8 | à faire | |
| S11 | Clôture | S | tous | à faire | |
