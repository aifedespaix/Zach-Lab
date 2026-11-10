/**
 * Le texte à formules en ligne, côté DOM pur (sans React ni MathLive) : la valeur est une chaîne où une formule
 * s'écrit `$latex$`, le DOM de l'éditeur est une suite de nœuds texte et de « pastilles » (`<span data-chip>` qui
 * contient le champ de formule). Tout ce qui lit ou écrit ce DOM est ici, pour être testé sans navigateur.
 */

/** Caractère invisible qui donne à une pastille un nœud texte de chaque côté, où poser le curseur. */
export const ZWSP = '​'

const INLINE = /\$([^$\n]+)\$/g

export type TextPart = { kind: 'text'; value: string } | { kind: 'math'; value: string }

/** Le texte découpé en morceaux de texte et de formules ; recollés avec leurs `$`, ils redonnent l'entrée. Un `$` sans fermeture sur sa ligne reste du texte. */
export function splitInlineMath(text: string): TextPart[] {
  const parts: TextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(INLINE)) {
    const start = match.index
    if (start > cursor) parts.push({ kind: 'text', value: text.slice(cursor, start) })
    parts.push({ kind: 'math', value: match[1] })
    cursor = start + match[0].length
  }
  if (cursor < text.length) parts.push({ kind: 'text', value: text.slice(cursor) })
  return parts
}

export const hasInlineMath = (text: string) => splitInlineMath(text).some(p => p.kind === 'math')

export const isChip = (node: Node | null): node is HTMLElement => node instanceof HTMLElement && node.dataset.chip !== undefined

/** Le LaTeX d'une pastille, sur une ligne, sans `$` (qui fermerait la formule) ni trou `\placeholder{}` laissé vide par MathLive. */
export const chipLatex = (chip: HTMLElement) =>
  (chip.dataset.latex ?? '').replace(/\\placeholder(\[[^\]]*\])?\{\}/g, '').replace(/\s*\n\s*/g, ' ').replace(/\$/g, '').trim()

/** Ce que la pastille écrit dans la valeur : rien tant qu'elle est vide. */
const chipText = (chip: HTMLElement) => (chipLatex(chip) === '' ? '' : `$${chipLatex(chip)}$`)

const withoutZwsp = (s: string) => s.replace(/\u200b/g, '')

/** La valeur de l'éditeur : le texte tel quel, chaque pastille en `$…$`. Tolère les `<br>` et `<div>` que le navigateur y glisse. */
export function readValue(root: HTMLElement): string {
  let out = ''
  const walk = (parent: Node) => {
    for (const node of parent.childNodes) {
      if (node instanceof Text) out += withoutZwsp(node.data)
      else if (isChip(node)) out += chipText(node)
      else if (node instanceof HTMLBRElement) out += '\n'
      else if (node instanceof HTMLElement) {
        if (node.tagName === 'DIV' && out !== '' && !out.endsWith('\n')) out += '\n'
        walk(node)
      }
    }
  }
  walk(root)
  return out
}

/** Une pastille a toujours un nœud texte avant et après elle ; un texte qui finit par un saut de ligne garde un caractère après (sinon la ligne vide n'a pas de hauteur). */
export function ensureAnchors(root: HTMLElement): void {
  for (const node of [...root.childNodes]) {
    if (!isChip(node)) continue
    if (!(node.previousSibling instanceof Text)) root.insertBefore(document.createTextNode(ZWSP), node)
    if (!(node.nextSibling instanceof Text)) node.after(document.createTextNode(ZWSP))
  }
  const last = root.lastChild
  if (last === null) root.append(document.createTextNode(ZWSP))
  else if (last instanceof Text && last.data.endsWith('\n')) last.data += ZWSP
}

/** Reconstruit le DOM de `value`. `makeChip` absent : tout est du texte (MathLive n'est pas là), `$` compris. */
export function renderValue(root: HTMLElement, value: string, makeChip: ((latex: string) => HTMLElement) | null): void {
  root.replaceChildren()
  if (makeChip === null) root.append(document.createTextNode(value))
  else {
    for (const part of splitInlineMath(value)) {
      root.append(part.kind === 'text' ? document.createTextNode(part.value) : makeChip(part.value))
    }
  }
  ensureAnchors(root)
}

export interface Position { node: Text; offset: number }

/** Où poser le curseur pour qu'il soit à `offset` caractères du début de la VALEUR ; dans une formule : juste après sa pastille. */
export function positionAt(root: HTMLElement, offset: number): Position | null {
  let remaining = offset
  let lastText: Text | null = null
  for (const node of root.childNodes) {
    if (node instanceof Text) {
      lastText = node
      let seen = 0
      for (let i = 0; i < node.data.length; i++) {
        if (node.data[i] === ZWSP) continue
        if (seen === remaining) return { node, offset: i }
        seen++
      }
      remaining -= seen
    } else if (isChip(node)) {
      const length = chipText(node).length
      if (remaining < length) {
        const next = node.nextSibling
        return next instanceof Text ? { node: next, offset: next.data.startsWith(ZWSP) ? 1 : 0 } : null
      }
      remaining -= length
    }
  }
  return lastText === null ? null : { node: lastText, offset: lastText.data.length }
}

/** Le contraire : le décalage dans la valeur du curseur (`node`, `offset`), ou `null` s'il n'est pas dans l'éditeur. */
export function valueOffsetOf(root: HTMLElement, node: Node, offset: number): number | null {
  let total = 0
  for (const child of root.childNodes) {
    if (child === node && child instanceof Text) return total + withoutZwsp(child.data.slice(0, offset)).length
    if (child instanceof Text) total += withoutZwsp(child.data).length
    else if (isChip(child)) {
      if (child.contains(node)) return total + chipText(child).length
      total += chipText(child).length
    }
  }
  return node === root ? total : null
}

/** La sélection courante, si elle est dans `root`. */
export function rangeIn(root: HTMLElement): Range | null {
  const selection = root.ownerDocument.getSelection()
  if (selection === null || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  return root.contains(range.commonAncestorContainer) ? range : null
}

export function placeCaret(root: HTMLElement, at: Position): void {
  const selection = root.ownerDocument.getSelection()
  if (selection === null) return
  const range = root.ownerDocument.createRange()
  range.setStart(at.node, at.offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * Écrit `text` au curseur (à la place de la sélection), curseur juste après. Sans sélection dans l'éditeur : à la fin.
 * Le texte entre dans le nœud texte du curseur plutôt que dans un nœud voisin : Chromium ramène le curseur à la fin du nœud
 * d'avant, et la frappe suivante passerait avant le saut de ligne.
 */
export function insertTextAtCaret(root: HTMLElement, text: string): void {
  const range = rangeIn(root) ?? endRange(root)
  range.deleteContents()
  const { startContainer, startOffset } = range
  let node: Text
  let offset: number
  if (startContainer instanceof Text) {
    node = startContainer
    node.data = node.data.slice(0, startOffset) + text + node.data.slice(startOffset)
    offset = startOffset + text.length
  } else {
    node = document.createTextNode(text)
    startContainer.insertBefore(node, startContainer.childNodes[startOffset] ?? null)
    offset = text.length
  }
  ensureAnchors(root)
  placeCaret(root, { node, offset })
}

function endRange(root: HTMLElement): Range {
  const range = root.ownerDocument.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  return range
}

/** Pose `chip` au curseur (à la place de la sélection) et rend le texte qui était sélectionné. */
export function insertChipAtCaret(root: HTMLElement, chip: HTMLElement): string {
  const range = rangeIn(root) ?? endRange(root)
  const selected = withoutZwsp(range.toString())
  range.deleteContents()
  range.insertNode(chip)
  ensureAnchors(root)
  return selected
}

/** Le cadre autour de la sélection : pose le curseur dans le nœud texte voisin de `chip` (`'after'` : juste après lui, `'before'` : juste avant). */
export function caretBeside(root: HTMLElement, chip: HTMLElement, side: 'before' | 'after'): void {
  ensureAnchors(root)
  const text = side === 'after' ? chip.nextSibling : chip.previousSibling
  if (!(text instanceof Text)) return
  placeCaret(root, { node: text, offset: side === 'after' ? (text.data.startsWith(ZWSP) ? 1 : 0) : text.data.length })
}

/** Un nœud texte de l'éditeur contient-il une formule complète `$…$` à transformer en pastille ? */
export function hasRawFormula(root: HTMLElement): boolean {
  for (const node of root.childNodes) if (node instanceof Text && hasInlineMath(withoutZwsp(node.data))) return true
  return false
}
