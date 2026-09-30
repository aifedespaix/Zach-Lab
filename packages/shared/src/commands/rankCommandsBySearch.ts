import { createSearchIndex, type SearchIndex } from '../search'
import { categoryLabel, type CommandDefinition } from './catalog'

/**
 * Ranks the commands that match a query. A LOWER score is a better match, and a
 * command that does not match is simply absent from the result.
 */
export type CommandRanker = (
  query: string,
  commands: readonly CommandDefinition[],
) => { command: CommandDefinition; score: number }[]

const FIELDS = ['label', 'description', 'category']

// One index per list of commands: the palette ranks on every keystroke, and
// rebuilding the index each time would be most of the cost. Keyed by the list
// itself, so registering another catalogue simply gets its own index (and the
// old one goes with the old list).
const indexes = new WeakMap<readonly CommandDefinition[], SearchIndex>()

function indexFor(commands: readonly CommandDefinition[]): SearchIndex {
  let index = indexes.get(commands)
  if (index === undefined) {
    index = createSearchIndex(FIELDS)
    for (const command of commands) {
      index.add({
        id: command.id,
        label: command.label,
        description: command.description,
        category: categoryLabel(command.category),
      })
    }
    indexes.set(commands, index)
  }
  return index
}

/**
 * The palette's default ranking: the suite's full-text search over the label,
 * the description and the category.
 *
 * Accents and case do not matter, « supprimer » finds « suppression », and a
 * typo still lands on the right action. The label counts three times the
 * description, so typing « supp » puts « Supprimer la carte » above a command
 * that merely mentions suppression in its explanation.
 */
export const rankCommandsBySearch: CommandRanker = (query, commands) => {
  // A palette that has just been opened lists everything, in catalogue order.
  if (query.trim() === '') return commands.map(command => ({ command, score: 0 }))

  const byId = new Map(commands.map(command => [command.id, command]))
  return indexFor(commands)
    .search(query, { limit: commands.length, boost: { label: 3 } })
    .flatMap(hit => {
      const command = byId.get(hit.id)
      // The search engine scores HIGHER = better; the palette sorts lower first.
      return command === undefined ? [] : [{ command, score: -hit.score }]
    })
}
