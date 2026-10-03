/** Les teintes de Mentale : membre gauche bleu, membre droit ambre, résultat vert. */
const tone = (color: string) => ({
  borderColor: `color-mix(in oklch, ${color}, transparent 30%)`,
  background: `color-mix(in oklch, ${color}, transparent 92%)`,
})
export const LEFT_TONE = tone('#3a6bb0')
export const RIGHT_TONE = tone('#b8791f')
export const SOLVED_TONE = tone('#2f8f5b')
export const BOX = { border: '1.5px solid', borderRadius: 10, padding: '6px 10px' } as const
