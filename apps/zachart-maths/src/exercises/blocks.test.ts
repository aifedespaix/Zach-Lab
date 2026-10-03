import { describe, expect, it } from 'vitest'
import {
  addBlock, addColumn, addRow, insertBlockAfter, moveBlock, newBlock, parseBlocks, removeBlock, removeColumn, removeRow, setCell, splitAtEquals, updateBlock,
  convertBlock, duplicateBlock, type Block, type EquationBlock, type KnownBlock, type TableBlock,
} from './blocks'

const ids = (blocks: { id: string }[]) => blocks.map(b => b.id)

describe('parseBlocks', () => {
  it('complète les blocs connus et écarte ce qui n\'est pas un bloc', () => {
    const blocks = parseBlocks([{ id: 'a', type: 'texte' }, 'oups', null, { id: 'b' }, { type: 'calcul', expression: 4 }])
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ id: 'a', type: 'texte', contenu: '' })
    expect(blocks[1]).toMatchObject({ type: 'calcul', lignes: [{ latex: '' }] })
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

describe('duplicateBlock', () => {
  it('copie le bloc juste après lui avec de nouveaux ids, étapes comprises', () => {
    const eq: Block = { id: 'q', type: 'equation', etapes: [{ id: 's', left: 'x', right: '1', operation: '' }] }
    const { blocks, added } = duplicateBlock([eq], 'q')
    expect(blocks).toHaveLength(2)
    expect(added.id).not.toBe('q')
    expect((added as EquationBlock).etapes[0]).toMatchObject({ left: 'x', right: '1' })
    expect((added as EquationBlock).etapes[0].id).not.toBe('s')
  })
  it('copie un bloc de type inconnu tel quel, hors son id', () => {
    const u: Block = { id: 'u', type: 'futur', extra: { n: 1 } }
    const { added } = duplicateBlock([u], 'u')
    expect(added).toMatchObject({ type: 'futur', extra: { n: 1 } })
    expect(added.id).not.toBe('u')
  })
})

describe('convertBlock', () => {
  const calc: KnownBlock = { id: 'c', type: 'calcul', lignes: [{ id: 'l1', latex: '3×4' }, { id: 'l2', latex: '12' }] }
  it("garde l'id et le contenu lisible d'un type à l'autre", () => {
    expect(convertBlock(calc, 'texte')).toEqual({ id: 'c', type: 'texte', contenu: '3×4\n12' })
    expect(convertBlock({ id: 't', type: 'texte', contenu: '2x = 8' }, 'calcul')).toEqual({ id: 't', type: 'calcul', lignes: [{ id: expect.any(String), latex: '2x = 8' }] })
    const eq = convertBlock({ id: 't', type: 'texte', contenu: '2x+5=11\nx=3' }, 'equation') as EquationBlock
    expect(eq.etapes.map(s => [s.left, s.right])).toEqual([['2x+5', '11'], ['x', '3']])
  })
  it("vers le même type ou un contenu vide : un bloc valide, jamais d'exception", () => {
    expect(convertBlock(calc, 'calcul')).toEqual(calc)
    expect((convertBlock({ id: 't', type: 'texte', contenu: '' }, 'equation') as EquationBlock).etapes).toHaveLength(1)
    expect((convertBlock({ id: 't', type: 'texte', contenu: '' }, 'tableau') as TableBlock).cellules.length).toBeGreaterThan(0)
  })
})

describe('migration du Calcul', () => {
  const lignes = (b: unknown) => (b as { lignes: { id: string; latex: string }[] }).lignes
  it('relit un ancien { expression, resultat } comme deux lignes', () => {
    const [b] = parseBlocks([{ id: 'c', type: 'calcul', expression: '3×4', resultat: '12' }])
    expect(lignes(b).map(l => l.latex)).toEqual(['3×4', '12'])
  })
  it('ignore un resultat vide', () => {
    expect(lignes(parseBlocks([{ id: 'c', type: 'calcul', expression: '3×4', resultat: '' }])[0])).toHaveLength(1)
  })
  it('garde toujours une ligne', () => {
    expect(lignes(parseBlocks([{ id: 'c', type: 'calcul', lignes: [] }])[0])).toHaveLength(1)
  })
  it("relit des lignes, leur donne un id, ignore ce qui n'est pas une chaîne", () => {
    const l = lignes(parseBlocks([{ type: 'calcul', lignes: [{ latex: 'a' }, { id: 'x', latex: 5 }, 'oups'] }])[0])
    expect(l.map(x => x.latex)).toEqual(['a', '', ''])
    expect(l.every(x => x.id !== '')).toBe(true)
  })
  it('conserve un bloc de type inconnu tel quel', () => {
    const raw = { id: 'z', type: 'futur', x: 1 }
    expect(parseBlocks([raw])[0]).toMatchObject(raw)
  })
})
