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
    name: 'Géométrie',
    hue: 175,
    symbols: [
      { glyph: '(AB)', label: 'Droite', latex: '\\left(#0\\right)', plain: '\\left(\\right)', mathOnly: true },
      { glyph: '[AB]', label: 'Segment', latex: '\\left[#0\\right]', plain: '\\left[\\right]', mathOnly: true },
      { glyph: '[AB)', label: 'Demi-droite', latex: '\\left[#0\\right)', plain: '\\left[\\right)', mathOnly: true },
      { glyph: '⟂', label: 'Perpendiculaire à', latex: '\\perp ' },
      { glyph: '∥', label: 'Parallèle à', latex: '\\parallel ' },
      { glyph: '△', label: 'Triangle', latex: '\\triangle ' },
      { glyph: '≅', label: 'Isométrique à (figures égales)', latex: '\\cong ' },
      { glyph: '∼', label: 'Semblable à', latex: '\\sim ' },
      { glyph: '𝒞', label: 'Cercle', latex: '\\mathcal{C}' },
    ],
  },
  {
    name: 'Angles et arcs',
    hue: 235,
    symbols: [
      { glyph: '∠', label: 'Angle', latex: '\\angle ' },
      { glyph: 'ABĈ', label: 'Angle ABC (chapeau)', latex: '\\widehat{#0}', plain: '\\widehat{}', mathOnly: true },
      { glyph: '⌒', label: 'Arc de cercle', latex: '\\overset{\\frown}{#0}', plain: '\\overset{\\frown}{}', mathOnly: true },
      { glyph: '′', label: 'Prime : minute d’angle, point image (A′)', latex: '^{\\prime}' },
      { glyph: '″', label: 'Seconde d’angle', latex: '^{\\prime\\prime}' },
      { glyph: 'rad', label: 'Radian', latex: '\\text{ rad}' },
      { glyph: 'sin', label: 'Sinus', latex: '\\sin ' },
      { glyph: 'cos', label: 'Cosinus', latex: '\\cos ' },
      { glyph: 'tan', label: 'Tangente', latex: '\\tan ' },
    ],
  },
  {
    name: 'Vecteurs',
    hue: 100,
    symbols: [
      { glyph: 'AB⃗', label: 'Vecteur AB', latex: '\\overrightarrow{#0}', plain: '\\overrightarrow{}', mathOnly: true },
      { glyph: 'u⃗', label: 'Vecteur u', latex: '\\vec{#0}', plain: '\\vec{}', mathOnly: true },
      { glyph: '0⃗', label: 'Vecteur nul', latex: '\\vec{0}', mathOnly: true },
      { glyph: '‖ ‖', label: 'Norme', latex: '\\left\\|#0\\right\\|', plain: '\\left\\|\\right\\|', mathOnly: true },
      { glyph: '(x;y)', label: 'Coordonnées (colonne)', latex: '\\begin{pmatrix}#0\\\\#?\\end{pmatrix}', plain: '\\begin{pmatrix} \\\\ \\end{pmatrix}', mathOnly: true },
      { glyph: 'AB̅', label: 'Mesure algébrique', latex: '\\overline{#0}', plain: '\\overline{}', mathOnly: true },
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

/**
 * Le fond d'une zone teintée (barre d'outils, carte de bloc, boutons d'ajout). Le pourcentage est lu dans
 * `--tone-pct` : le mode « couleurs légères » le met à 0 sur la racine, et les fonds disparaissent sans
 * que les bordures (`borderOf`) changent.
 */
export const toneOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) var(--tone-pct, 24%), var(--background))`

/** Une teinte qui PORTE une information (unité, terme, cours) : elle ne s'efface pas avec les couleurs légères. */
export const infoToneOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 24%, var(--background))`
export const borderOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 55%, var(--background))`

/** Le fond d'une cellule d'en-tête de tableau : un cran plus soutenu que `toneOf`, pour qu'on voie d'où la colonne tient sa couleur. */
export const headerToneOf = (hue: number) => `color-mix(in oklab, hsl(${hue} 75% 50%) 42%, var(--background))`
