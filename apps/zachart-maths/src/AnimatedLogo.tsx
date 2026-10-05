interface AnimatedLogoProps {
  /**
   * `draw-fade` : se dessine une fois, tient, s'efface, recommence — se lit « chargement ».
   * `draw-pulse` : se dessine une fois, puis respire doucement, sans reprise — se lit « en attente »
   * (écran sans exercice).
   */
  mode: 'draw-fade' | 'draw-pulse'
  size?: number
}

/**
 * La marque de l'app (quatre points reliés par un M), animée : le M s'écrit comme on l'écrit à la
 * main — bas gauche, haut gauche, creux, haut droite, bas droite — et chaque point glisse depuis
 * l'endroit où le précédent s'est posé. Mêmes quatre points, mêmes couleurs et même grille que
 * `public/favicon.svg`, et que le Z de Zachar't Mentale dont il est le pendant.
 */
export function AnimatedLogo({ mode, size = 96 }: AnimatedLogoProps) {
  return (
    <svg className={`animated-logo animated-logo--${mode}`} viewBox="0 0 128 128" width={size} height={size} aria-hidden="true">
      {/* `pathLength` ramène chaque trait à 80 : un même `stroke-dasharray` les dessine tous. */}
      <polyline className="animated-logo-seg animated-logo-seg--1" pathLength="80" points="36,92 36,36" />
      <polyline className="animated-logo-seg animated-logo-seg--2" pathLength="80" points="36,36 64,78 92,36" />
      <polyline className="animated-logo-seg animated-logo-seg--3" pathLength="80" points="92,36 92,92" />
      <circle className="animated-logo-dot animated-logo-dot--1" cx="36" cy="92" r="20" fill="#EF4444" />
      <circle className="animated-logo-dot animated-logo-dot--2" cx="36" cy="36" r="20" fill="#F97316" />
      <circle className="animated-logo-dot animated-logo-dot--3" cx="92" cy="36" r="20" fill="#3B82F6" />
      <circle className="animated-logo-dot animated-logo-dot--4" cx="92" cy="92" r="20" fill="#EAB308" />
    </svg>
  )
}
