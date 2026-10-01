import type { BlockType } from './blocks'

/**
 * Le contenu de la barre d'outils verticale, en données : une famille = une couleur.
 * Retirer ou ajouter un signe ne touche que ce fichier.
 *
 * Les signes sont du texte brut, valable dans tous les champs (texte, calcul, cellule,
 * réponse). Les structures qui demandent du LaTeX (fraction, racine, indice) sont celles du
 * bloc Équation, au lot 5.
 */
export interface SymbolEntry { glyph: string; label: string }

export interface SymbolFamily {
  name: string
  /** Teinte HSL (0–360), mélangée au fond : lisible en clair comme en sombre. */
  hue: number
  symbols: readonly SymbolEntry[]
}

export interface ActionEntry { type: BlockType; label: string }

export const SYMBOL_FAMILIES: readonly SymbolFamily[] = [
  {
    name: 'Opérations',
    hue: 8,
    symbols: [
      { glyph: '+', label: 'Plus' },
      { glyph: '−', label: 'Moins' },
      { glyph: '×', label: 'Multiplié par' },
      { glyph: '÷', label: 'Divisé par' },
      { glyph: '±', label: 'Plus ou moins' },
      { glyph: '·', label: 'Point multiplicatif' },
    ],
  },
  {
    name: 'Comparaisons',
    hue: 38,
    symbols: [
      { glyph: '=', label: 'Égal' },
      { glyph: '≠', label: 'Différent de' },
      { glyph: '<', label: 'Inférieur à' },
      { glyph: '>', label: 'Supérieur à' },
      { glyph: '≤', label: 'Inférieur ou égal' },
      { glyph: '≥', label: 'Supérieur ou égal' },
      { glyph: '≈', label: 'Environ égal à' },
    ],
  },
  {
    name: 'Nombres',
    hue: 140,
    symbols: [
      { glyph: '²', label: 'Au carré' },
      { glyph: '³', label: 'Au cube' },
      { glyph: '√', label: 'Racine carrée' },
      { glyph: 'π', label: 'Pi' },
      { glyph: '∞', label: 'Infini' },
      { glyph: '°', label: 'Degré' },
      { glyph: '%', label: 'Pourcentage' },
    ],
  },
  {
    name: 'Ensembles et logique',
    hue: 200,
    symbols: [
      { glyph: '∈', label: 'Appartient à' },
      { glyph: '∉', label: "N'appartient pas à" },
      { glyph: '∪', label: 'Union' },
      { glyph: '∩', label: 'Intersection' },
      { glyph: '∅', label: 'Ensemble vide' },
      { glyph: '⇒', label: 'Donc, implique' },
      { glyph: '⇔', label: 'Équivalent à' },
    ],
  },
  {
    name: 'Lettres grecques',
    hue: 270,
    symbols: [
      { glyph: 'α', label: 'Alpha' },
      { glyph: 'β', label: 'Bêta' },
      { glyph: 'θ', label: 'Thêta' },
      { glyph: 'Δ', label: 'Delta' },
      { glyph: 'Σ', label: 'Sigma' },
    ],
  },
]

/** Les actions : elles agissent sur la pile de blocs, pas sur un champ. */
export const ACTIONS: { name: string; hue: number; actions: readonly ActionEntry[] } = {
  name: 'Ajouter un bloc',
  hue: 330,
  actions: [
    { type: 'texte', label: 'Texte' },
    { type: 'calcul', label: 'Calcul' },
    { type: 'tableau', label: 'Tableau' },
  ],
}

export const toneOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 24%, var(--background))`
export const borderOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 55%, var(--background))`
