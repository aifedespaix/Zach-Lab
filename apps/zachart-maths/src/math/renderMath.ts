import katex from 'katex'

/**
 * Au-delà, une formule n'est pas composée du tout : KaTeX est synchrone et sans borne
 * (`'x+'.repeat(100000)` met plus de 20 s), et l'entrée peut venir d'un fichier partagé
 * plutôt que du clavier.
 */
const MAX_LATEX_LENGTH = 5000

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Affiché à la place de la composition : une formule illisible n'est jamais un trou blanc. */
const fallbackMarkup = (latex: string, reason: string) =>
  `<code class="katex-fallback" title="${escapeHtml(reason)}" style="white-space:pre-wrap;word-break:break-word">${escapeHtml(latex)}</code>`

/**
 * Une formule LaTeX en balisage KaTeX, injecté avec `dangerouslySetInnerHTML`.
 *
 * Sans danger parce que KaTeX échappe ce qu'il émet et, avec `trust: false`, refuse liens,
 * ressources embarquées et `\html*`. Le try/catch est nécessaire en plus de `throwOnError:
 * false` : KaTeX ne renvoie ainsi que les `ParseError`, et une imbrication profonde lève une
 * `RangeError` qui, dans un rendu React, démonterait toute la page. `maxSize` borne les
 * `\rule` et `\kern` démesurés.
 */
export function renderMathToHtml(latex: string, display = false): string {
  if (latex.trim() === '') return ''
  if (latex.length > MAX_LATEX_LENGTH) return fallbackMarkup(latex.slice(0, 200) + '…', 'Formule trop longue pour être affichée')
  try {
    return katex.renderToString(latex, { displayMode: display, throwOnError: false, trust: false, strict: false, maxSize: 10 })
  } catch (error) {
    return fallbackMarkup(latex, error instanceof Error ? error.message : 'Formule illisible')
  }
}
