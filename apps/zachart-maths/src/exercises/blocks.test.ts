import { describe, expect, it } from 'vitest'
import {
  addBlock, addColumn, addRow, insertBlockAfter, moveBlock, newBlock, parseBlocks, removeBlock, removeColumn, removeRow, setCell, splitAtEquals, updateBlock,
  type Block, type EquationBlock,
} from './blocks'

const ids = (blocks: { id: string }[]) => blocks.map(b => b.id)

describe('parseBlocks', () => {
  it('complète les blocs connus et écarte ce qui n\'est pas un bloc', () => {
    const blocks = parseBlocks([{ id: 'a', type: 'texte' }, 'oups', null, { id: 'b' }, { type: 'calcul', expression: 4 }])
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ id: 'a', type: 'texte', contenu: '' })
    expect(blocks[1]).toMatchObject({ type: 'calcul', expression: '', resultat: '' })
    expect(blocks[1].id).not.toBe('')
  })

  it('garde un bloc inconnu avec tous ses champs', () => {
    expect(parseBlocks([{ id: 'e', type: 'schema', etapes: [1, 2] }])).toEqual([{ id: 'e', type: 'schema', etapes: [1, 2] }])
  })

  it('rend un tableau rectangulaire, jamais vide', () => {
    const [t] = parseBlocks([{ id: 't', type: 'tableau', cellules: [['a'], ['b', 'c', 3]] }])
    expect(t).toMatchObject({ cellules: [['a', '', ''], ['b', 'c', '']] })
    const [empty] = parseBlocks([{ id: 'v', type: 'tableau', cellules: 'x' }])
    expect(empty).toMatchObject({ cellules: [['']] })
  })
})

describe('parseBlocks : équation', () => {
  const read = (etapes: unknown) => (parseBlocks([{ id: 'q', type: 'equation', etapes }])[0] as EquationBlock).etapes

  it('garde au moins une étape et des identifiants uniques', () => {
    expect(read('x')).toMatchObject([{ left: '', right: '', operation: '' }])
    const steps = read([{ id: 's', left: '2x', right: '4' }, { id: 's', left: 'x', right: '2' }, 7])
    expect(steps).toHaveLength(2)
    expect(steps[0]).toEqual({ id: 's', left: '2x', right: '4', operation: '' })
    expect(steps[1].id).not.toBe('s')
  })
  it('découpe un ancien latex sur le premier = et décale les actions', () => {
    expect(read([
      { id: 'a', action: '', latex: '2x+5=11' },
      { id: 'b', action: '− 5 des deux côtés', latex: '2x=6' },
    ])).toEqual([
      { id: 'a', left: '2x+5', right: '11', operation: '− 5 des deux côtés' },
      { id: 'b', left: '2x', right: '6', operation: '' },
    ])
  })
  it('un latex sans = tombe à gauche, un latex vide donne deux membres vides', () => {
    expect(read([{ id: 'a', latex: 'x+1' }])[0]).toMatchObject({ left: 'x+1', right: '' })
    expect(read([{ id: 'a', latex: '' }])[0]).toMatchObject({ left: '', right: '' })
  })
  it('plusieurs = : tout ce qui suit le premier reste dans le membre droit', () => {
    expect(read([{ id: 'a', latex: 'a=b=c' }])[0]).toMatchObject({ left: 'a', right: 'b=c' })
  })
  it('lit le nouveau format tel quel', () => {
    expect(read([{ id: 'a', left: 'x', right: '3', operation: 'ok' }])[0]).toEqual({ id: 'a', left: 'x', right: '3', operation: 'ok' })
  })
})

describe('splitAtEquals / insertBlockAfter', () => {
  it('splitAtEquals coupe au premier =', () => {
    expect(splitAtEquals(' 3x = 9 ')).toEqual({ left: '3x', right: '9' })
  })
  it("insère après le bloc visé, ou à la fin si l'id est inconnu", () => {
    const base = [{ id: '1', type: 'texte', contenu: '' }, { id: '2', type: 'texte', contenu: '' }] as Block[]
    const r = insertBlockAfter(base, '1', 'calcul')
    expect(r.blocks.map(b => b.id)).toEqual(['1', r.added.id, '2'])
    const appended = insertBlockAfter(base, 'zz', 'calcul').blocks
    expect(appended[appended.length - 1].type).toBe('calcul')
  })
})

describe('pile', () => {
  const stack = ['texte', 'calcul', 'tableau'].map(t => ({ ...newBlock(t as 'texte'), id: t, type: t })) as ReturnType<typeof parseBlocks>

  it('ajoute à la fin', () => {
    const next = addBlock(stack, 'texte')
    expect(next).toHaveLength(4)
    expect(next[3].type).toBe('texte')
    expect(stack).toHaveLength(3)
  })

  it('déplace d\'un cran et ne sort pas de la pile', () => {
    expect(ids(moveBlock(stack, 'calcul', -1))).toEqual(['calcul', 'texte', 'tableau'])
    expect(ids(moveBlock(stack, 'calcul', 1))).toEqual(['texte', 'tableau', 'calcul'])
    expect(ids(moveBlock(stack, 'texte', -1))).toEqual(['texte', 'calcul', 'tableau'])
    expect(ids(moveBlock(stack, 'tableau', 1))).toEqual(['texte', 'calcul', 'tableau'])
    expect(ids(moveBlock(stack, 'absent', 1))).toEqual(['texte', 'calcul', 'tableau'])
  })

  it('supprime et modifie un bloc sans toucher aux autres', () => {
    expect(ids(removeBlock(stack, 'calcul'))).toEqual(['texte', 'tableau'])
    const next = updateBlock(stack, 'texte', { contenu: 'bonjour' })
    expect(next[0]).toMatchObject({ contenu: 'bonjour' })
    expect(next[1]).toBe(stack[1])
  })
})

describe('tableau', () => {
  const grid = [['a', 'b'], ['c', 'd']]
  it('modifie une cellule sans muter l\'original', () => {
    expect(setCell(grid, 1, 0, 'X')).toEqual([['a', 'b'], ['X', 'd']])
    expect(grid[1][0]).toBe('c')
  })
  it('ajoute et retire lignes et colonnes', () => {
    expect(addRow(grid)).toEqual([['a', 'b'], ['c', 'd'], ['', '']])
    expect(addColumn(grid)).toEqual([['a', 'b', ''], ['c', 'd', '']])
    expect(removeRow(grid, 0)).toEqual([['c', 'd']])
    expect(removeColumn(grid, 1)).toEqual([['a'], ['c']])
  })
  it('garde au moins une ligne et une colonne, et borne la taille', () => {
    expect(removeRow([['a']], 0)).toEqual([['a']])
    expect(removeColumn([['a']], 0)).toEqual([['a']])
    let big = grid
    for (let i = 0; i < 30; i++) big = addColumn(addRow(big))
    expect(big).toHaveLength(12)
    expect(big[0]).toHaveLength(12)
  })
})
