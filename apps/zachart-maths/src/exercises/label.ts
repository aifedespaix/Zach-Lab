/**
 * Le numéro d'un exercice (« 3 », « 1a », « B ») ou sa page, décalés d'un cran.
 * `null` quand il n'y a pas de cran possible : on ne casse pas ce que l'élève a écrit.
 *
 * - un nombre au bout : « 3 » → « 4 », « Ex 9 » → « Ex 10 » (jamais sous 0) ;
 * - sinon une lettre SEULE au bout (pas la fin d'un mot) : « 1a » → « 1b », « a » → « b »,
 *   « A » → « B », en gardant la casse ; pas de passage de « z » à « aa » ni de « a » à rien.
 */
export function bumpLabel(value: string, delta: -1 | 1): string | null {
  const text = value.trim()
  const number = /^(.*?)(\d+)$/.exec(text)
  if (number !== null) {
    const next = Number(number[2]) + delta
    return next < 0 ? null : `${number[1]}${next}`
  }
  const letter = /^(.*?)(?<![A-Za-z])([A-Za-z])$/.exec(text)
  if (letter !== null) {
    const code = letter[2].charCodeAt(0) + delta
    const lower = letter[2] === letter[2].toLowerCase()
    const [first, last] = lower ? [97, 122] : [65, 90]
    return code < first || code > last ? null : `${letter[1]}${String.fromCharCode(code)}`
  }
  return null
}
