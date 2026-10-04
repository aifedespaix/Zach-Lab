---
titre: Nombres premiers et PGCD
chapitre: Arithmétique
mots-cles: nombre premier, décomposition, facteurs premiers, PGCD, plus grand diviseur commun, fraction irréductible, algorithme d'Euclide
---
# Nombres premiers et PGCD

> [!definition] Nombre premier
> Un nombre est **premier** s'il a exactement **deux diviseurs** : $1$ et lui-même. Le plus petit est $2$ ($1$ n'est pas premier).

> [!propriete]
> Les nombres premiers inférieurs à $30$ : $2, 3, 5, 7, 11, 13, 17, 19, 23, 29$.

## Décomposition en facteurs premiers

> [!methode]
> On divise successivement par $2$, puis $3$, puis $5$… tant que c'est possible.

> [!exemple]
> $$60 = 2 \times 30 = 2 \times 2 \times 15 = 2^2 \times 3 \times 5$$

## PGCD

> [!definition] PGCD
> Le **PGCD** de deux entiers est leur **plus grand diviseur commun**.

> [!methode] Algorithme d'Euclide
> On fait la division euclidienne du grand par le petit, puis du diviseur par le reste, etc. Le **dernier reste non nul** est le PGCD.

> [!exemple] PGCD de $84$ et $36$
> $$84 = 36 \times 2 + 12 \qquad 36 = 12 \times 3 + 0$$
> Le PGCD est $12$.

> [!propriete] Application
> Pour rendre $\frac{a}{b}$ irréductible, on divise $a$ et $b$ par leur PGCD : $\frac{36}{84} = \frac{3}{7}$.

> [!retenir]
> Deux nombres sont **premiers entre eux** si leur PGCD est $1$.
