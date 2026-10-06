import { describe, expect, it } from 'vitest'
import { canRemoveRect, cellKeyAction, cellMove, clearRect, crossProduct, deleteShortcut, insertShortcut, removeRect, pasteGrid, rectOf, rectToTsv } from './tableNav'

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

describe('cellKeyAction — Maj+Entrée et Ctrl+Entrée', () => {
  const cells = [['a', 'b'], ['c', 'd']]
  it('Maj+Entrée recule', () => {
    expect(cellKeyAction('Enter', true, false, 0, 1, cells, true)).toEqual({ kind: 'move', to: { row: 0, column: 0, caret: 'end' } })
    expect(cellKeyAction('Enter', true, false, 1, 0, cells, true)).toEqual({ kind: 'move', to: { row: 0, column: 1, caret: 'end' } })
    expect(cellKeyAction('Enter', true, false, 0, 0, cells, true)).toBeNull()
  })
  it('Ctrl+Entrée ajoute une colonne après la case', () => {
    expect(cellKeyAction('Enter', false, false, 1, 0, cells, true, { mod: true, canAddColumn: true })).toEqual({ kind: 'addColumn', after: 0 })
    expect(cellKeyAction('Enter', false, false, 1, 0, cells, true, { mod: true, canAddColumn: false })).toBeNull()
  })
})

describe('sélection, collage, produit en croix', () => {
  const cells = [['1', '2', '3'], ['4', '5', '6']]
  it('rectangle : vider et copier', () => {
    const rect = rectOf({ row: 1, column: 1 }, { row: 0, column: 0 })
    expect(clearRect(cells, rect)).toEqual([['', '', '3'], ['', '', '6']])
    expect(rectToTsv(cells, rect)).toBe('1\t2\n4\t5')
  })
  it('collage : une valeur seule reste au champ, une grille agrandit le tableau (borné)', () => {
    expect(pasteGrid(cells, 0, 0, '12', 12)).toBeNull()
    expect(pasteGrid(cells, 1, 2, 'a\tb\nc\td\r\n', 12)).toEqual([['1', '2', '3', ''], ['4', '5', 'a', 'b'], ['', '', 'c', 'd']])
    expect(pasteGrid(cells, 0, 0, 'x\ty\nz\tw', 2)).toEqual([['x', 'y'], ['z', 'w']])
  })
  it('produit en croix : trois coins numériques', () => {
    expect(crossProduct([['10', '20'], ['4', '']], 1, 1)).toEqual({ value: '8', formula: '4 × 20 ÷ 10 = 8' })
    expect(crossProduct([['10', '20'], ['4', '']], 0, 0)).toBeNull()
    expect(crossProduct([['10', '20'], ['x', '']], 1, 1)).toBeNull()
    expect(crossProduct([['0', '20'], ['4', '']], 1, 1)).toBeNull()
    expect(crossProduct([['3', '10'], ['', '5']], 1, 0)?.value).toBe('1,5')
  })
})

describe('insertShortcut', () => {
  const key = (name: string, extra = {}) => ({ key: name, ctrlKey: true, metaKey: false, altKey: true, shiftKey: false, ...extra })
  it('Ctrl+Alt+flèche insère de ce côté de la case', () => {
    expect(insertShortcut(key('ArrowUp'))).toEqual({ axis: 'row', side: 'before' })
    expect(insertShortcut(key('ArrowDown'))).toEqual({ axis: 'row', side: 'after' })
    expect(insertShortcut(key('ArrowLeft'))).toEqual({ axis: 'column', side: 'before' })
    expect(insertShortcut(key('ArrowRight', { ctrlKey: false, metaKey: true }))).toEqual({ axis: 'column', side: 'after' })
  })
  it("ne vole ni Alt seul, ni Ctrl seul, ni Maj, ni une autre touche", () => {
    expect(insertShortcut(key('ArrowUp', { ctrlKey: false }))).toBeNull()
    expect(insertShortcut(key('ArrowUp', { altKey: false }))).toBeNull()
    expect(insertShortcut(key('ArrowUp', { shiftKey: true }))).toBeNull()
    expect(insertShortcut(key('a'))).toBeNull()
  })
})

describe('removeRect', () => {
  const grid = [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]
  const rect = { top: 0, bottom: 1, left: 1, right: 1 }
  it('retire les lignes couvertes', () => {
    expect(removeRect(grid, rect, { rows: true, columns: false })).toEqual([['g', 'h', 'i']])
  })
  it('retire les colonnes couvertes', () => {
    expect(removeRect(grid, rect, { rows: false, columns: true })).toEqual([['a', 'c'], ['d', 'f'], ['g', 'i']])
  })
  it('retire les deux', () => {
    expect(removeRect(grid, rect, { rows: true, columns: true })).toEqual([['g', 'i']])
  })
  it('garde un axe entièrement couvert', () => {
    const all = { top: 0, bottom: 2, left: 0, right: 0 }
    expect(removeRect(grid, all, { rows: true, columns: true })).toEqual([['b', 'c'], ['e', 'f'], ['h', 'i']])
    expect(canRemoveRect(grid, all)).toEqual({ rows: false, columns: true })
  })
})

describe('deleteShortcut', () => {
  const key = (k: string, o: object = {}) => ({ key: k, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...o })
  it('Ctrl+Suppr : colonnes ; Ctrl+Maj+Suppr : lignes ; avec Alt+Maj : les deux', () => {
    expect(deleteShortcut(key('Delete'))).toEqual({ rows: false, columns: true })
    expect(deleteShortcut(key('Delete', { shiftKey: true }))).toEqual({ rows: true, columns: false })
    expect(deleteShortcut(key('Delete', { shiftKey: true, altKey: true }))).toEqual({ rows: true, columns: true })
  })
  it('ignore Suppr seul et Ctrl+Alt+Suppr', () => {
    expect(deleteShortcut(key('Delete', { ctrlKey: false }))).toBeNull()
    expect(deleteShortcut(key('Delete', { altKey: true }))).toBeNull()
    expect(deleteShortcut(key('a'))).toBeNull()
  })
})
