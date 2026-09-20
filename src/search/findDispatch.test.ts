import { describe, it, expect, afterEach } from 'vitest'
import { resolveFindTarget } from './findDispatch'

function elementWith(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('input')
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('resolveFindTarget', () => {
  it('routes to card search when focus is in the tree search field', () => {
    const el = elementWith({ 'data-search-zone': 'tree' })
    expect(resolveFindTarget(el, false)).toBe('view.findInCards')
  })

  it('routes to tree search when focus is in the card search field', () => {
    const el = elementWith({ 'data-search-zone': 'cards' })
    expect(resolveFindTarget(el, false)).toBe('view.findInTree')
  })

  it('routes to tree search when focus is elsewhere in the sidebar', () => {
    const zone = document.createElement('div')
    zone.setAttribute('data-focus-zone', 'sidebar')
    const button = document.createElement('button')
    zone.appendChild(button)
    document.body.appendChild(zone)
    expect(resolveFindTarget(button, false)).toBe('view.findInTree')
  })

  it('routes to card search when focus is elsewhere and no quiz is active', () => {
    expect(resolveFindTarget(document.body, false)).toBe('view.findInCards')
  })

  it('falls back to tree search when focus is elsewhere during a quiz', () => {
    expect(resolveFindTarget(document.body, true)).toBe('view.findInTree')
  })

  it('treats a null active element like the canvas', () => {
    expect(resolveFindTarget(null, false)).toBe('view.findInCards')
  })
})
