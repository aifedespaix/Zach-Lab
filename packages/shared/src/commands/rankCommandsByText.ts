import { categoryLabel, type CommandDefinition } from './catalog'

/**
 * Ranks the commands that match a query. A LOWER score is a better match, and a
 * command that does not match is simply absent from the result.
 */
export type CommandRanker = (
  query: string,
  commands: readonly CommandDefinition[],
) => { command: CommandDefinition; score: number }[]

/** Accent- and case-insensitive, so « Créer » is found by typing "creer". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * The palette's default ranking: a plain substring match.
 *
 * A hit on the LABEL outranks one on the description or the category, and an
 * earlier hit outranks a later one, so typing "supp" puts « Supprimer la
 * carte » above a command that merely mentions suppression in its explanation.
 * The query is text, never a pattern: `(` or `.*` must not throw.
 */
export const rankCommandsByText: CommandRanker = (query, commands) => {
  const needle = fold(query.trim())
  if (needle === '') return commands.map(command => ({ command, score: 0 }))

  return commands.flatMap(command => {
    const inLabel = fold(command.label).indexOf(needle)
    if (inLabel >= 0) return [{ command, score: inLabel }]
    const rest = fold(`${command.description} ${categoryLabel(command.category)}`)
    const inRest = rest.indexOf(needle)
    // 1000: past any position a label hit can reach, so the label always wins.
    return inRest >= 0 ? [{ command, score: 1000 + inRest }] : []
  })
}
