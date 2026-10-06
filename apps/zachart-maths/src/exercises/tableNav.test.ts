import { describe, expect, it } from 'vitest'
import { cellMove } from './tableNav'

const at = (start: number, length = 5, end = start) => ({ start, end, length })

describe('cellMove', () => {
  it('moves vertically in the same column, whatever the caret', () => {
    expect(cellMove('ArrowUp', 1, 2, 3, 3, at(2))).toEqual({ row: 0, column: 2, caret: 'end' })
    expect(cellMove('ArrowDown', 1, 2, 3, 3, at(2))).toEqual({ row: 2, column: 2, caret: 'end' })
    expect(cellMove('ArrowUp', 0, 0, 3, 3, at(0))).toBeNull()
    expect(cellMove('ArrowDown', 2, 0, 3, 3, at(0))).toBeNull()
  })
  it('moves sideways only when there is no character left to cross', () => {
    expect(cellMove('ArrowLeft', 1, 1, 3, 3, at(2))).toBeNull()
    expect(cellMove('ArrowLeft', 1, 1, 3, 3, at(0))).toEqual({ row: 1, column: 0, caret: 'end' })
    expect(cellMove('ArrowRight', 1, 1, 3, 3, at(2))).toBeNull()
    expect(cellMove('ArrowRight', 1, 1, 3, 3, at(5))).toEqual({ row: 1, column: 2, caret: 'start' })
    expect(cellMove('ArrowRight', 1, 1, 3, 3, at(0, 0))).toEqual({ row: 1, column: 2, caret: 'start' })
  })
  it('stays put at the table edge or over a selection', () => {
    expect(cellMove('ArrowLeft', 0, 0, 3, 3, at(0))).toBeNull()
    expect(cellMove('ArrowRight', 0, 2, 3, 3, at(5))).toBeNull()
    expect(cellMove('ArrowLeft', 0, 1, 3, 3, { start: 0, end: 3, length: 5 })).toBeNull()
    expect(cellMove('a', 0, 1, 3, 3, at(0))).toBeNull()
  })
})
