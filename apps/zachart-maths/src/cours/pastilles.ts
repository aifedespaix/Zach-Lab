/**
 * Les pastilles du panneau de droite (cours, notes, calculatrice), en logique pure.
 *
 * `remembered` est l'état mémorisé de la pastille (`coursesVisible`, ou `notesVisible` + l'onglet). Replié, le panneau
 * ne l'efface pas : la pastille s'affiche simplement éteinte, et reprend son état au dépliage.
 */
export interface PastilleState {
  /** Le panneau de droite est replié. */
  collapsed: boolean
  /** La pastille est allumée dans la mémoire. */
  remembered: boolean
}

/** Ce qu'une pastille montre : éteinte tant que le panneau est replié, quelle que soit la mémoire. */
export function pastilleView({ collapsed, remembered }: PastilleState): { lit: boolean } {
  return { lit: remembered && !collapsed }
}

/**
 * Le résultat d'un clic. Replié : on déplie et la pastille est allumée (une pastille déjà allumée en mémoire
 * le reste). Déplié : bascule classique, l'allumée s'éteint.
 */
export function onPastilleClick({ collapsed, remembered }: PastilleState): { unfold: boolean; nextRemembered: boolean } {
  if (collapsed) return { unfold: true, nextRemembered: true }
  return { unfold: false, nextRemembered: !remembered }
}
