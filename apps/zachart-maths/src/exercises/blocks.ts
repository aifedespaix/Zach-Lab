/**
 * Les blocs de la zone de travail : une pile verticale que l'élève remplit de haut en bas.
 *
 * Un bloc de type inconnu (écrit par une version plus récente) est conservé tel quel dans
 * le fichier, déplaçable et supprimable, mais pas modifiable.
 */
export interface TextBlock { id: string; type: 'texte'; contenu: string }
export interface CalcBlock { id: string; type: 'calcul'; expression: string; resultat: string }
export interface TableBlock { id: string; type: 'tableau'; cellules: string[][] }
/**
 * Une résolution pas à pas. `action` de l'étape *i* est ce que l'élève a fait pour passer de
 * l'étape *i − 1* à celle-ci (« − 5 des deux côtés ») ; celle de la première étape reste vide.
 */
export interface EquationStep { id: string; action: string; latex: string }
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

export const newStep = (): EquationStep => ({ id: crypto.randomUUID(), action: '', latex: '' })

export function newBlock(type: BlockType): KnownBlock {
  const id = crypto.randomUUID()
  switch (type) {
    case 'texte': return { id, type, contenu: '' }
    case 'calcul': return { id, type, expression: '', resultat: '' }
    case 'tableau': return { id, type, cellules: [['', ''], ['', '']] }
    case 'equation': return { id, type, etapes: [newStep()] }
  }
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')

/** Rend un tableau rectangulaire d'au moins 1×1, borné, quoi que contienne le fichier. */
function normalizeCells(raw: unknown): string[][] {
  const rows = (Array.isArray(raw) ? raw : []).slice(0, MAX_TABLE).map(r => (Array.isArray(r) ? r.map(str) : []))
  const width = Math.min(MAX_TABLE, Math.max(1, ...rows.map(r => r.length)))
  const grid = rows.map(r => Array.from({ length: width }, (_, i) => r[i] ?? ''))
  return grid.length > 0 ? grid : [Array(width).fill('')]
}

/** Au moins une étape, des identifiants uniques, et pas d'action sur la première. */
function normalizeSteps(raw: unknown): EquationStep[] {
  const seen = new Set<string>()
  const steps = (Array.isArray(raw) ? raw : []).flatMap((item): EquationStep[] => {
    if (typeof item !== 'object' || item === null) return []
    const r = item as Record<string, unknown>
    let id = typeof r.id === 'string' && r.id !== '' ? r.id : crypto.randomUUID()
    if (seen.has(id)) id = crypto.randomUUID()
    seen.add(id)
    return [{ id, action: str(r.action), latex: str(r.latex) }]
  })
  if (steps.length === 0) return [newStep()]
  steps[0] = { ...steps[0], action: '' }
  return steps
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
      case 'calcul': blocks.push({ id, type: 'calcul', expression: str(b.expression), resultat: str(b.resultat) }); break
      case 'tableau': blocks.push({ id, type: 'tableau', cellules: normalizeCells(b.cellules) }); break
      case 'equation': blocks.push({ id, type: 'equation', etapes: normalizeSteps(b.etapes) }); break
      default: blocks.push({ ...b, id, type: b.type })
    }
  }
  return blocks
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
