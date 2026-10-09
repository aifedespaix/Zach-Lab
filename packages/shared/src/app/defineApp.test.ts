import { describe, expect, it } from 'vitest'
import { defineApp } from './defineApp'

const mark = {
  points: [[0, 0], [1, 1], [2, 2], [3, 3]],
  colors: ['#000', '#000', '#000', '#000'],
  segments: [],
} as const

describe('defineApp', () => {
  it('rend un objet inerte et figé', () => {
    const app = defineApp({ id: 'demo', name: 'Demo', mark })
    expect(app.id).toBe('demo')
    expect(Object.isFrozen(app)).toBe(true)
  })

  it.each(['', 'Demo', '1demo', 'de mo'])('refuse l\'id « %s »', id => {
    expect(() => defineApp({ id, name: 'X', mark })).toThrow(/id invalide/)
  })
})
