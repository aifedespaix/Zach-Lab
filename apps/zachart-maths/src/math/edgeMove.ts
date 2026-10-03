export type EdgeMove = 'left' | 'right' | 'up' | 'down'

export interface CaretState {
  atStart: boolean
  atEnd: boolean
  /** Aucune sélection : une flèche sur une sélection la réduit, elle ne quitte pas le champ. */
  collapsed: boolean
  /** Pas de fraction, racine ou exposant ouverts : ↑/↓ n'ont rien à faire à l'intérieur. */
  flat: boolean
}

/** Où une flèche mène HORS du champ ; `null` quand le champ la garde pour lui (déplacement du curseur). */
export function edgeMove(key: string, caret: CaretState): EdgeMove | null {
  switch (key) {
    case 'ArrowLeft': return caret.collapsed && caret.atStart ? 'left' : null
    case 'ArrowRight': return caret.collapsed && caret.atEnd ? 'right' : null
    case 'ArrowUp': return caret.flat ? 'up' : null
    case 'ArrowDown': return caret.flat ? 'down' : null
    default: return null
  }
}

/** Dans une fraction, une racine ou un exposant, MathLive utilise ↑/↓ pour changer de zone : on les lui laisse. */
export const isFlatLatex = (latex: string): boolean =>
  !/\\(?:d?frac|tfrac|binom|sqrt|left|right|over|begin)(?![a-zA-Z])|[\^_]\{/.test(latex)
