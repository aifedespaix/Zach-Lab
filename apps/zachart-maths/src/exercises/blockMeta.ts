import { Equal, Sigma, Table2, Type, type LucideIcon } from 'lucide-react'
import type { BlockType } from './blocks'

/** Ce qui distingue un type de bloc à l'écran : son libellé, son icône (celles de Mentale) et sa teinte. */
export const BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon; hue: number }> = {
  texte: { label: 'Texte', icon: Type, hue: 215 },
  calcul: { label: 'Calcul', icon: Sigma, hue: 30 },
  tableau: { label: 'Tableau', icon: Table2, hue: 280 },
  equation: { label: 'Équation', icon: Equal, hue: 150 },
}
