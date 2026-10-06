import { describe, expect, it } from 'vitest'
import { cellKeyAction, cellMove } from './tableNav'

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

describe('cellKeyAction', () => {
  const full = [['a', 'b'], ['c', 'd']]
  const empty = [['a', 'b'], ['', '']]
  const act = (key: string, row: number, column: number, cells = full, opts: { shift?: boolean; repeat?: boolean; canAdd?: boolean } = {}) =>
    cellKeyAction(key, opts.shift ?? false, opts.repeat ?? false, row, column, cells, opts.canAdd ?? true)

  it('Tab : natif partout, sauf la dernière case qui mène au « + »', () => {
    expect(act('Tab', 0, 0)).toBeNull()
    expect(act('Tab', 1, 1)).toEqual({ kind: 'focusAddRow' })
    expect(act('Tab', 1, 1, full, { shift: true })).toBeNull()
    expect(act('Tab', 1, 1, full, { canAdd: false })).toBeNull()
  })
  it('Entrée : case suivante, ligne suivante au bout, nouvelle ligne à la fin', () => {
    expect(act('Enter', 0, 0)).toEqual({ kind: 'move', to: { row: 0, column: 1, caret: 'end' } })
    expect(act('Enter', 0, 1)).toEqual({ kind: 'move', to: { row: 1, column: 0, caret: 'end' } })
    expect(act('Enter', 1, 1)).toEqual({ kind: 'addRow' })
    expect(act('Enter', 1, 1, full, { canAdd: false })).toBeNull()
  })
  it('Retour arrière : seulement dans une case vide', () => {
    expect(act('Backspace', 1, 1)).toBeNull()
    expect(act('Backspace', 1, 1, [['a', 'b'], ['c', '']])).toEqual({ kind: 'move', to: { row: 1, column: 0, caret: 'end' } })
    expect(act('Backspace', 0, 0, [['', 'b'], ['c', 'd']])).toBeNull()
  })
  it('Retour arrière dans la première case : ligne vide supprimée, sinon fin de la ligne précédente', () => {
    expect(act('Backspace', 1, 0, empty)).toEqual({ kind: 'removeRow', row: 1, to: { row: 0, column: 1, caret: 'end' } })
    expect(act('Backspace', 1, 0, [['a', 'b'], ['', 'd']])).toEqual({ kind: 'move', to: { row: 0, column: 1, caret: 'end' } })
    expect(act('Backspace', 1, 0, empty, { repeat: true })).toEqual({ kind: 'move', to: { row: 0, column: 1, caret: 'end' } })
  })
})
