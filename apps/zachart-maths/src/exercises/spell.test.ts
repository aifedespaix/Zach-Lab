import { describe, expect, it } from 'vitest'
import { createChecker } from './spellCore'
import { misspellingAt, wordAt } from './spell'

const fake = async (w: string) => (w === 'bonjoure' ? ['bonjour', 'bonjours'] : null)

function input(value: string, caret: number) {
  const el = document.createElement('input')
  el.value = value
  el.setSelectionRange(caret, caret)
  return el
}

describe('wordAt', () => {
  it('finds the word around or touching the caret', () => {
    expect(wordAt('un bonjoure ici', 6)).toEqual({ start: 3, end: 11, word: 'bonjoure' })
    expect(wordAt('un bonjoure ici', 11)?.word).toBe('bonjoure')
    expect(wordAt("aujourd'hui, peut-être", 3)?.word).toBe("aujourd'hui")
    expect(wordAt('12 + 3', 1)).toBeNull()
  })
})

describe('misspellingAt', () => {
  it('proposes corrections for a wrong word', async () => {
    expect(await misspellingAt(input('un bonjoure ici', 6), fake)).toEqual({
      start: 3, end: 11, word: 'bonjoure', suggestions: ['bonjour', 'bonjours'],
    })
  })
  it('says nothing for a right word, a one-letter word or a non-text field', async () => {
    expect(await misspellingAt(input('un bonjour', 6), fake)).toBeNull()
    expect(await misspellingAt(input('x = 2', 0), fake)).toBeNull()
    expect(await misspellingAt(document.createElement('div'), fake)).toBeNull()
  })
  it('knows French for real', async () => {
    const check = createChecker()
    expect(check('orthographe')).toBeNull()
    expect(check('ortographe')).toContain('orthographe')
  }, 60_000)
})
