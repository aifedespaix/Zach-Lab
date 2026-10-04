---
titre: Statistiques : moyenne, médiane, étendue
chapitre: Statistiques et probabilités
mots-cles: statistiques, moyenne, médiane, étendue, effectif, fréquence, série, quartiles, diagramme, données
---
# Statistiques : moyenne, médiane, étendue

> [!definition] Série statistique
> Une **série statistique** est une liste de valeurs. L'**effectif** d'une valeur est le nombre de fois où elle apparaît ; sa **fréquence** est l'effectif divisé par l'effectif total.

## Moyenne

> [!propriete]
> $$\text{moyenne} = \frac{\text{somme de toutes les valeurs}}{\text{nombre de valeurs}}$$

> [!propriete] Moyenne pondérée
> Quand les valeurs ont des effectifs, on multiplie chaque valeur par son effectif :
>
> $$\bar{x} = \frac{n_1 x_1 + n_2 x_2 + \dots + n_p x_p}{n_1 + n_2 + \dots + n_p}$$

> [!exemple] Notes : $8$, $12$, $12$, $16$
> $$\bar{x} = \frac{8 + 12 + 12 + 16}{4} = 12$$

## Médiane

> [!definition] Médiane
> La **médiane** partage la série **rangée par ordre croissant** en deux groupes de même effectif : au moins la moitié des valeurs lui sont inférieures ou égales, au moins la moitié lui sont supérieures ou égales.

> [!methode]
> 1. On range les valeurs dans l'ordre croissant.
> 2. Si l'effectif $N$ est **impair**, la médiane est la valeur du milieu.
> 3. S'il est **pair**, c'est la **moyenne des deux valeurs centrales**.

> [!exemple]
> Série $3, 5, 8, 9, 15, 20$ : la médiane est $\frac{8 + 9}{2} = 8{,}5$.

## Étendue

> [!definition]
> L'**étendue** est la différence entre la plus grande et la plus petite valeur : elle mesure la dispersion.

> [!attention]
> On **range toujours** les valeurs avant de chercher la médiane.

> [!retenir]
> La moyenne est sensible aux valeurs extrêmes ; la médiane l'est beaucoup moins.
