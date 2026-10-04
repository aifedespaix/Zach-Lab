/**
 * Le contenu de la barre d'outils verticale, en données : une famille = une couleur.
 * Retirer ou ajouter un signe ne touche que ce fichier.
 *
 * Les signes sont du texte brut, valable dans tous les champs (texte, calcul, cellule,
 * réponse). Les structures qui demandent du LaTeX (fraction, racine, indice) sont celles du
 * bloc Équation, au lot 5.
 */
export interface SymbolEntry {
  glyph: string
  label: string
  /** Ce que reçoit un champ de formule. `#0` = la sélection, `#?` = l'arrêt suivant (syntaxe MathLive). */
  latex: string
  /** Le même fragment en LaTeX littéral, pour le champ brut où ces jetons s'écriraient tels quels. */
  plain?: string
  /** Sans équivalent en texte brut (fraction, indice…) : réservé aux champs de formule. */
  mathOnly?: boolean
}

export interface SymbolFamily {
  name: string
  /** Teinte HSL (0–360), mélangée au fond : lisible en clair comme en sombre. */
  hue: number
  symbols: readonly SymbolEntry[]
}

export const SYMBOL_FAMILIES: readonly SymbolFamily[] = [
  {
    name: 'Structures',
    hue: 320,
    symbols: [
      { glyph: '⅟', label: 'Fraction', latex: '\\frac{#0}{#?}', plain: '\\frac{}{}', mathOnly: true },
      { glyph: 'xⁿ', label: 'Puissance', latex: '#0^{#?}', plain: '^{}', mathOnly: true },
      { glyph: 'xₙ', label: 'Indice', latex: '#0_{#?}', plain: '_{}', mathOnly: true },
      { glyph: '( )', label: 'Parenthèses', latex: '\\left(#0\\right)', plain: '\\left(\\right)', mathOnly: true },
    ],
  },
  {
    name: 'Opérations',
    hue: 8,
    symbols: [
      { glyph: '+', label: 'Plus', latex: '+' },
      { glyph: '−', label: 'Moins', latex: '-' },
      { glyph: '×', label: 'Multiplié par', latex: '\\times ' },
      { glyph: '÷', label: 'Divisé par', latex: '\\div ' },
      { glyph: '±', label: 'Plus ou moins', latex: '\\pm ' },
      { glyph: '·', label: 'Point multiplicatif', latex: '\\cdot ' },
    ],
  },
  {
    name: 'Comparaisons',
    hue: 38,
    symbols: [
      { glyph: '=', label: 'Égal', latex: '=' },
      { glyph: '≠', label: 'Différent de', latex: '\\neq ' },
      { glyph: '<', label: 'Inférieur à', latex: '<' },
      { glyph: '>', label: 'Supérieur à', latex: '>' },
      { glyph: '≤', label: 'Inférieur ou égal', latex: '\\leq ' },
      { glyph: '≥', label: 'Supérieur ou égal', latex: '\\geq ' },
      { glyph: '≈', label: 'Environ égal à', latex: '\\approx ' },
    ],
  },
  {
    name: 'Nombres',
    hue: 140,
    symbols: [
      { glyph: '²', label: 'Au carré', latex: '^{2}' },
      { glyph: '³', label: 'Au cube', latex: '^{3}' },
      { glyph: '√', label: 'Racine carrée', latex: '\\sqrt{#0}', plain: '\\sqrt{}' },
      { glyph: 'π', label: 'Pi', latex: '\\pi ' },
      { glyph: '∞', label: 'Infini', latex: '\\infty ' },
      { glyph: '°', label: 'Degré', latex: '^{\\circ}' },
      { glyph: '%', label: 'Pourcentage', latex: '\\%' },
    ],
  },
  {
    name: 'Ensembles et logique',
    hue: 200,
    symbols: [
      { glyph: '∈', label: 'Appartient à', latex: '\\in ' },
      { glyph: '∉', label: "N'appartient pas à", latex: '\\notin ' },
      { glyph: '∪', label: 'Union', latex: '\\cup ' },
      { glyph: '∩', label: 'Intersection', latex: '\\cap ' },
      { glyph: '∅', label: 'Ensemble vide', latex: '\\varnothing ' },
      { glyph: '⇒', label: 'Donc, implique', latex: '\\Rightarrow ' },
      { glyph: '⇔', label: 'Équivalent à', latex: '\\Leftrightarrow ' },
    ],
  },
  {
    name: 'Lettres grecques',
    hue: 270,
    symbols: [
      { glyph: 'α', label: 'Alpha', latex: '\\alpha ' },
      { glyph: 'β', label: 'Bêta', latex: '\\beta ' },
      { glyph: 'θ', label: 'Thêta', latex: '\\theta ' },
      { glyph: 'Δ', label: 'Delta', latex: '\\Delta ' },
      { glyph: 'Σ', label: 'Sigma', latex: '\\Sigma ' },
    ],
  },
]

export const toneOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 24%, var(--background))`
export const borderOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 55%, var(--background))`

/** Le fond d'une cellule d'en-tête de tableau : un cran plus soutenu que `toneOf`, pour qu'on voie d'où la colonne tient sa couleur. */
export const headerToneOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 42%, var(--background))`
