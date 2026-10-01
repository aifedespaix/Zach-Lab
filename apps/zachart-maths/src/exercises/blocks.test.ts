import { describe, expect, it } from 'vitest'
import {
  addBlock, addColumn, addRow, moveBlock, newBlock, parseBlocks, removeBlock, removeColumn, removeRow, setCell, updateBlock,
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
  it('garde au moins une étape, des identifiants uniques, et pas d\'action sur la première', () => {
    const [empty] = parseBlocks([{ id: 'q', type: 'equation', etapes: 'x' }])
    expect(empty).toMatchObject({ etapes: [{ action: '', latex: '' }] })
    const [eq] = parseBlocks([{ id: 'q', type: 'equation', etapes: [
      { id: 's', action: 'oups', latex: '2x=4' }, { id: 's', action: '÷ 2', latex: 'x=2' }, 7,
    ] }]) as { etapes: { id: string; action: string; latex: string }[] }[]
    expect(eq.etapes).toHaveLength(2)
    expect(eq.etapes[0]).toEqual({ id: 's', action: '', latex: '2x=4' })
    expect(eq.etapes[1]).toMatchObject({ action: '÷ 2', latex: 'x=2' })
    expect(eq.etapes[1].id).not.toBe('s')
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
