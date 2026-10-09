/** The spacing of the central area, normal or condensed. */
export function spacing(compact: boolean) {
  return compact
    ? { zone: 4, outer: 4, header: 6, footer: 6, stackGap: 3, cardPad: 3 }
    : { zone: 16, outer: 8, header: 12, footer: 12, stackGap: 8, cardPad: 8 }
}
