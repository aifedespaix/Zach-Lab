import type { MathfieldElement } from '@suite/shared/equation'

export type { MathfieldElement }

/** Le `<math-field>` de MathLive : l'élément que la barre de symboles sait remplir. */
export const isMathField = (el: unknown): el is MathfieldElement => el instanceof HTMLElement && el.tagName === 'MATH-FIELD'
