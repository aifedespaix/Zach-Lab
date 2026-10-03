/**
 * Les blocs de la zone de travail : une pile verticale que l'élève remplit de haut en bas.
 *
 * Un bloc de type inconnu (écrit par une version plus récente) est conservé tel quel dans
 * le fichier, déplaçable et supprimable, mais pas modifiable.
 */
export interface TextBlock { id: string; type: 'texte'; contenu: string }
export interface CalcLine { id: string; latex: string }
/** Un calcul : une liste de lignes (sous-blocs), chacune une formule. */
export interface CalcBlock { id: string; type: 'calcul'; lignes: CalcLine[] }
export interface TableBlock { id: string; type: 'tableau'; cellules: string[][] }
/**
 * Une résolution pas à pas, comme dans Zachar't Mentale : chaque étape a deux membres LaTeX
 * (`left = right`) et `operation` est ce que l'élève fait POUR PASSER à l'étape suivante
 * (« − 5 des deux côtés »), écrit entre les deux étapes.
 */
export interface EquationStep { id: string; left: string; right: string; operation: string }
export interface EquationBlock { id: string; type: 'equation'; etapes: EquationStep[] }
export interface UnknownBlock { id: string; type: string; [key: string]: unknown }

export type KnownBlock = TextBlock | CalcBlock | TableBlock | EquationBlock
export type Block = KnownBlock | UnknownBlock
export type BlockType = KnownBlock['type']

export const BLOCK_TYPES: readonly { type: BlockType; label: string }[] = [
  { type: 'texte', label: 'Texte' },
  { type: 'calcul', label: 'Calcul' },
  { type: 'tableau', label: 'Tableau' },
  { type: 'equation', label: 'Équation' },
]

export const isKnown = (block: Block): block is KnownBlock => BLOCK_TYPES.some(t => t.type === block.type)

const MAX_TABLE = 12

export const newCalcLine = (): CalcLine => ({ id: crypto.randomUUID(), latex: '' })

export const newStep = (): EquationStep => ({ id: crypto.randomUUID(), left: '', right: '', operation: '' })

export function newBlock(type: BlockType): KnownBlock {
  const id = crypto.randomUUID()
  switch (type) {
    case 'texte': return { id, type, contenu: '' }
    case 'calcul': return { id, type, lignes: [newCalcLine()] }
    case 'tableau': return { id, type, cellules: [['', ''], ['', '']] }
    case 'equation': return { id, type, etapes: [newStep()] }
  }
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * `lignes` quand il existe ; sinon un ancien `{ expression, resultat }` devient deux lignes (un
 * résultat vide est ignoré). Jamais vide.
 */
function normalizeCalcLines(b: Record<string, unknown>): CalcLine[] {
  if (Array.isArray(b.lignes)) {
    const lines = b.lignes.map(l => {
      const o = typeof l === 'object' && l !== null ? (l as Record<string, unknown>) : {}
      return { id: typeof o.id === 'string' && o.id !== '' ? o.id : crypto.randomUUID(), latex: str(o.latex) }
    })
    return lines.length > 0 ? lines : [newCalcLine()]
  }
  return [str(b.expression), str(b.resultat)]
    .filter((latex, i) => i === 0 || latex !== '')
    .map(latex => ({ id: crypto.randomUUID(), latex }))
}

/** Rend un tableau rectangulaire d'au moins 1×1, borné, quoi que contienne le fichier. */
function normalizeCells(raw: unknown): string[][] {
  const rows = (Array.isArray(raw) ? raw : []).slice(0, MAX_TABLE).map(r => (Array.isArray(r) ? r.map(str) : []))
  const width = Math.min(MAX_TABLE, Math.max(1, ...rows.map(r => r.length)))
  const grid = rows.map(r => Array.from({ length: width }, (_, i) => r[i] ?? ''))
  return grid.length > 0 ? grid : [Array(width).fill('')]
}

/** Coupe au premier `=` ; sans `=`, tout est à gauche. Sert à relire les anciennes fiches (une ligne LaTeX par étape). */
export function splitAtEquals(latex: string): { left: string; right: string } {
  const i = latex.indexOf('=')
  return i < 0
    ? { left: latex.trim(), right: '' }
    : { left: latex.slice(0, i).trim(), right: latex.slice(i + 1).trim() }
}

type Raw = Record<string, unknown>
/** Une étape de l'ancien format : `latex` seul, sans membres. */
const isLegacyStep = (r: Raw) => !('left' in r) && !('right' in r)

/**
 * Au moins une étape, des identifiants uniques. Une étape de l'ancien format (`latex`, `action`
 * AVANT l'étape) est découpée sur son premier `=`, et son `action` devient l'`operation` de
 * l'étape précédente. Rien n'est écrit ici : la fiche ne change sur le disque qu'à l'édition.
 */
function normalizeSteps(raw: unknown): EquationStep[] {
  const items = (Array.isArray(raw) ? raw : []).filter((x): x is Raw => typeof x === 'object' && x !== null)
  const seen = new Set<string>()
  const steps = items.map((r, i): EquationStep => {
    let id = typeof r.id === 'string' && r.id !== '' ? r.id : crypto.randomUUID()
    if (seen.has(id)) id = crypto.randomUUID()
    seen.add(id)
    if (!isLegacyStep(r)) return { id, left: str(r.left), right: str(r.right), operation: str(r.operation) }
    const next = items[i + 1]
    return { id, ...splitAtEquals(str(r.latex)), operation: next !== undefined && isLegacyStep(next) ? str(next.action) : '' }
  })
  return steps.length === 0 ? [newStep()] : steps
}

/**
 * Lit les blocs d'un fichier. Un élément qui n'est pas un objet à `type` texte est écarté ;
 * un bloc connu est complété, un bloc inconnu garde tous ses champs.
 */
export function parseBlocks(raw: readonly unknown[]): Block[] {
  const blocks: Block[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const b = item as Record<string, unknown>
    if (typeof b.type !== 'string') continue
    const id = typeof b.id === 'string' && b.id !== '' ? b.id : crypto.randomUUID()
    switch (b.type) {
      case 'texte': blocks.push({ id, type: 'texte', contenu: str(b.contenu) }); break
      case 'calcul': blocks.push({ id, type: 'calcul', lignes: normalizeCalcLines(b) }); break
      case 'tableau': blocks.push({ id, type: 'tableau', cellules: normalizeCells(b.cellules) }); break
      case 'equation': blocks.push({ id, type: 'equation', etapes: normalizeSteps(b.etapes) }); break
      default: blocks.push({ ...b, id, type: b.type })
    }
  }
  return blocks
}

/** Insère un bloc juste après `id` (à la fin si `id` est inconnu) ; `added` est le bloc créé. */
export function insertBlockAfter(blocks: readonly Block[], id: string, type: BlockType): { blocks: Block[]; added: KnownBlock } {
  const added = newBlock(type)
  const at = blocks.findIndex(b => b.id === id)
  const next = [...blocks]
  next.splice(at < 0 ? next.length : at + 1, 0, added)
  return { blocks: next, added }
}

export const addBlock = (blocks: readonly Block[], type: BlockType): Block[] => [...blocks, newBlock(type)]

export const removeBlock = (blocks: readonly Block[], id: string): Block[] => blocks.filter(b => b.id !== id)

/** Déplace d'un cran ; sans effet aux extrémités. */
export function moveBlock(blocks: readonly Block[], id: string, delta: -1 | 1): Block[] {
  const from = blocks.findIndex(b => b.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= blocks.length) return [...blocks]
  const next = [...blocks]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export const updateBlock = (blocks: readonly Block[], id: string, patch: Partial<KnownBlock>): Block[] =>
  blocks.map(b => (b.id === id ? ({ ...b, ...patch } as Block) : b))

export const canGrow = (cells: readonly string[][], axis: 'row' | 'col') =>
  axis === 'row' ? cells.length < MAX_TABLE : cells[0].length < MAX_TABLE

export const setCell = (cells: readonly string[][], r: number, c: number, value: string): string[][] =>
  cells.map((row, i) => (i === r ? row.map((v, j) => (j === c ? value : v)) : [...row]))

export function addRow(cells: readonly string[][]): string[][] {
  if (!canGrow(cells, 'row')) return cells.map(r => [...r])
  return [...cells.map(r => [...r]), Array(cells[0].length).fill('')]
}

export function addColumn(cells: readonly string[][]): string[][] {
  if (!canGrow(cells, 'col')) return cells.map(r => [...r])
  return cells.map(r => [...r, ''])
}

/** Garde toujours au moins une ligne. */
export const removeRow = (cells: readonly string[][], r: number): string[][] =>
  cells.length <= 1 ? cells.map(row => [...row]) : cells.filter((_, i) => i !== r).map(row => [...row])

/** Garde toujours au moins une colonne. */
export const removeColumn = (cells: readonly string[][], c: number): string[][] =>
  cells[0].length <= 1 ? cells.map(row => [...row]) : cells.map(row => row.filter((_, j) => j !== c))

/** Le contenu d'un bloc en texte brut : ce qu'on garde en le convertissant vers un autre type. */
export function blockToPlain(block: KnownBlock): string {
  switch (block.type) {
    case 'texte': return block.contenu
    case 'calcul': return block.lignes.map(l => l.latex).join('\n')
    case 'tableau': return block.cellules.map(row => row.join('\t')).join('\n')
    case 'equation': return block.etapes.map(s => `${s.left} = ${s.right}`).join('\n')
  }
}

/** Change le type d'un bloc en gardant son id et ce qu'il disait. Vers le même type : le bloc tel quel. */
export function convertBlock(block: KnownBlock, to: BlockType): KnownBlock {
  if (block.type === to) return block
  const plain = blockToPlain(block)
  const lines = plain.split('\n').filter(l => l.trim() !== '')
  switch (to) {
    case 'texte': return { id: block.id, type: 'texte', contenu: plain }
    case 'calcul': return { id: block.id, type: 'calcul', lignes: (lines.length > 0 ? lines : ['']).map(latex => ({ id: crypto.randomUUID(), latex })) }
    case 'equation': {
      const etapes = lines.map(l => ({ id: crypto.randomUUID(), ...splitAtEquals(l), operation: '' }))
      return { id: block.id, type: 'equation', etapes: etapes.length > 0 ? etapes : [newStep()] }
    }
    case 'tableau': return { id: block.id, type: 'tableau', cellules: normalizeCells(plain.split('\n').map(l => l.split('\t'))) }
  }
}

/** Copie un bloc juste après lui, avec de nouveaux ids (le sien et ceux de ses étapes). */
export function duplicateBlock(blocks: readonly Block[], id: string): { blocks: Block[]; added: Block } {
  const at = blocks.findIndex(b => b.id === id)
  if (at < 0) return { blocks: [...blocks], added: blocks[0] }
  const copy = structuredClone(blocks[at]) as Block
  copy.id = crypto.randomUUID()
  if (copy.type === 'equation') {
    const eq = copy as EquationBlock
    eq.etapes = eq.etapes.map(s => ({ ...s, id: crypto.randomUUID() }))
  }
  const next = [...blocks]
  next.splice(at + 1, 0, copy)
  return { blocks: next, added: copy }
}
