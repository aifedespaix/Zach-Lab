import nspell from 'nspell'
import aff from '@dictionary-fr/index.aff?raw'
import dic from '@dictionary-fr/index.dic?raw'

/** Les corrections d'un mot, ou `null` s'il est juste. Lent à construire (le dictionnaire français pèse plus d'1 Mo) : à faire hors du fil principal. */
export function createChecker(): (word: string) => string[] | null {
  const dictionary = nspell(aff, dic)
  return word => (dictionary.correct(word) ? null : dictionary.suggest(word).slice(0, 5))
}
