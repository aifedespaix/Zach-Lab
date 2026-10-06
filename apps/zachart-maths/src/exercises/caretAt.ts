import { isTextField } from './insertAtCursor'

type TextField = HTMLInputElement | HTMLTextAreaElement

// What decides where a character lands in a field: fonts, spacing, box model. Copied onto the mirror.
const LAYOUT = [
  'boxSizing', 'direction', 'fontFamily', 'fontSize', 'fontStretch', 'fontStyle', 'fontVariant', 'fontWeight',
  'letterSpacing', 'lineHeight', 'tabSize', 'textAlign', 'textIndent', 'textTransform', 'wordSpacing',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
] as const

/** The text offset under a point, from the browser's own hit test, whichever of the two standard APIs it has. */
function offsetAt(node: Node, x: number, y: number): number | null {
  const position = document.caretPositionFromPoint?.(x, y)
  if (position != null) return position.offsetNode === node ? position.offset : null
  const range = document.caretRangeFromPoint?.(x, y)
  return range != null && range.startContainer === node ? range.startOffset : null
}

/**
 * The index in `field.value` of the character under the point (`x`, `y`, viewport coordinates), or `null`
 * when the browser cannot tell.
 *
 * A right click does not move the caret by itself: Chromium does that in the default action of `contextmenu`,
 * which the menu cancels. So the click position has to be read back. Browsers do not hit-test the text inside
 * an `<input>` or `<textarea>`, so a transparent copy of its text is laid out over it, with the same metrics,
 * and hit-tested instead. The copy is placed by measuring it, not by computing coordinates: the page may be zoomed.
 */
export function caretIndexAt(field: unknown, x: number, y: number): number | null {
  if (!isTextField(field) || field.value === '') return null
  const target = field as TextField
  const style = getComputedStyle(target)
  const box = target.getBoundingClientRect()
  const mirror = document.createElement('div')
  for (const property of LAYOUT) mirror.style[property] = style[property]
  Object.assign(mirror.style, {
    position: 'fixed',
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    overflow: 'hidden',
    whiteSpace: target instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre',
    overflowWrap: 'break-word',
    color: 'transparent',
    zIndex: '2147483647',
  })
  mirror.textContent = target.value
  document.body.append(mirror)
  try {
    const placed = mirror.getBoundingClientRect()
    mirror.style.left = `${box.left + (box.left - placed.left)}px`
    mirror.style.top = `${box.top + (box.top - placed.top)}px`
    mirror.scrollTop = target.scrollTop
    mirror.scrollLeft = target.scrollLeft
    const text = mirror.firstChild
    return text === null ? null : offsetAt(text, x, y)
  } finally {
    mirror.remove()
  }
}
