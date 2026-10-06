import { createChecker } from './spellCore'

// Le dictionnaire se construit en plusieurs secondes : dans un worker, l'interface ne gèle pas.
const check = createChecker()

self.onmessage = (event: MessageEvent<{ id: number; word: string }>) => {
  const { id, word } = event.data
  self.postMessage({ id, suggestions: check(word) })
}
