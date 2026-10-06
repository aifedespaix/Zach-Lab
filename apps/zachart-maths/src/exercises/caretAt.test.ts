import { afterEach, describe, expect, it } from 'vitest'
import { caretIndexAt } from './caretAt'

type Hit = (x: number, y: number) => { offsetNode: Node; offset: number } | null

/** jsdom has no hit test: the tests give one that answers from the node the mirror really holds. */
function stubHitTest(offset: number) {
  const seen: { text: string | null; whiteSpace: string }[] = []
  const hit: Hit = () => {
    const mirror = document.body.lastElementChild as HTMLElement
    seen.push({ text: mirror.textContent, whiteSpace: mirror.style.whiteSpace })
    return { offsetNode: mirror.firstChild as Node, offset }
  }
  Object.defineProperty(document, 'caretPositionFromPoint', { value: hit, configurable: true })
  return seen
}

afterEach(() => {
  Reflect.deleteProperty(document, 'caretPositionFromPoint')
  document.body.replaceChildren()
})

describe('caretIndexAt', () => {
  it('lays a copy of the text over the field, hit-tests it and removes it', () => {
    const field = document.createElement('textarea')
    field.value = 'un bonjoure ici'
    document.body.append(field)
    const seen = stubHitTest(6)
    expect(caretIndexAt(field, 40, 10)).toBe(6)
    expect(seen).toEqual([{ text: 'un bonjoure ici', whiteSpace: 'pre-wrap' }])
    expect(document.body.children).toHaveLength(1)
  })

  it('keeps an input on one line', () => {
    const field = document.createElement('input')
    field.value = 'abc'
    document.body.append(field)
    const seen = stubHitTest(1)
    caretIndexAt(field, 5, 5)
    expect(seen[0].whiteSpace).toBe('pre')
  })

  it('gives null when the browser has no hit test, the field is empty or it is not a text field', () => {
    const field = document.createElement('input')
    field.value = 'abc'
    document.body.append(field)
    expect(caretIndexAt(field, 5, 5)).toBeNull()
    field.value = ''
    stubHitTest(0)
    expect(caretIndexAt(field, 5, 5)).toBeNull()
    expect(caretIndexAt(document.createElement('div'), 5, 5)).toBeNull()
  })

  it('ignores an answer that is not about the mirror text', () => {
    const field = document.createElement('input')
    field.value = 'abc'
    document.body.append(field)
    Object.defineProperty(document, 'caretPositionFromPoint', { value: () => ({ offsetNode: field, offset: 2 }), configurable: true })
    expect(caretIndexAt(field, 5, 5)).toBeNull()
  })
})
