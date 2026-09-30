export type FindTarget = 'view.findInTree' | 'view.findInCards'

/**
 * Which search zone Ctrl+F should route to, given where focus currently is.
 * A focused search field routes to the OTHER zone — that's what lets repeated
 * presses toggle between the two, with no extra state to track beyond
 * `document.activeElement` itself.
 */
export function resolveFindTarget(activeElement: Element | null, quizActive: boolean): FindTarget {
  const zone = activeElement instanceof HTMLElement ? activeElement.getAttribute('data-search-zone') : null
  if (zone === 'tree') return 'view.findInCards'
  if (zone === 'cards') return 'view.findInTree'

  const inSidebar =
    activeElement instanceof HTMLElement && activeElement.closest('[data-focus-zone="sidebar"]') !== null
  if (inSidebar) return 'view.findInTree'

  return quizActive ? 'view.findInTree' : 'view.findInCards'
}
