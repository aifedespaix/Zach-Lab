export type TextField = HTMLInputElement | HTMLTextAreaElement

export const isTextField = (el: unknown): el is TextField =>
  (el instanceof HTMLInputElement && ['text', 'search', ''].includes(el.type)) || el instanceof HTMLTextAreaElement

/**
 * Écrit `text` à la position du curseur de `field` (ou à la place de la sélection) et laisse
 * le curseur juste après.
 *
 * `setRangeText` modifie le champ sans passer par le setter `value` que React surveille ; l'évènement
 * `input` qui suit est donc vu comme un vrai changement et déclenche `onChange`. Écrire
 * `field.value = …` puis l'évènement ne marcherait pas : React compare à la valeur qu'il connaît.
 */
export function insertAtCursor(field: TextField, text: string): void {
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? start
  field.setRangeText(text, start, end, 'end')
  field.dispatchEvent(new Event('input', { bubbles: true }))
}
