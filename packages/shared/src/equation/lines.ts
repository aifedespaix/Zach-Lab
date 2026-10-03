/** Une ligne d'un bloc Calcul : un sous-bloc, un champ de formule. */
export interface SubLine { id: string; latex: string }

export const newLine = (): SubLine => ({ id: crypto.randomUUID(), latex: '' })

export const isLineEmpty = (line: SubLine): boolean => line.latex.trim() === ''

export function insertLineAfter(lines: readonly SubLine[], index: number): { lines: SubLine[]; added: SubLine } {
  const added = newLine()
  const next = [...lines]
  next.splice(index + 1, 0, added)
  return { lines: next, added }
}

/** Un bloc Calcul garde toujours au moins une ligne. */
export function removeLineAt(lines: readonly SubLine[], index: number): SubLine[] {
  return lines.length <= 1 || index < 0 || index >= lines.length ? [...lines] : lines.filter((_, i) => i !== index)
}
