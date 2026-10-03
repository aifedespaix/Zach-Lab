import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BlockStack } from './BlockStack'

// Le système demande « réduire les animations » : motion le lit à la première utilisation du hook.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query.includes('prefers-reduced-motion'), media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
}))

describe('BlockStack avec « réduire les animations »', () => {
  it('ne fait plus glisser les cartes, mais garde le halo', () => {
    render(<BlockStack value={[{ id: 'a', type: 'texte', contenu: '' }]} onChange={() => {}} arrivedId="a" />)
    expect(document.querySelector('li')!.getAttribute('data-slide')).toBe('off')
    expect(document.querySelector('[data-block-id="a"]')!.classList.contains('block-halo')).toBe(true)
  })
})
