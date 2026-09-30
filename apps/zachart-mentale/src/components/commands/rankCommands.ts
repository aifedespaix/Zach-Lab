import { categoryLabel, type CommandDefinition, type CommandRanker } from '@suite/shared/commands'
import { rankedScore } from '../../search/textSearch'

/**
 * Ranks a command against a query. `null` means "no match".
 *
 * A hit on the LABEL outranks one on the description or the category, and an
 * earlier hit outranks a later one, so typing "supp" puts « Supprimer la
 * carte » above a command that merely mentions suppression in its explanation.
 */
export function scoreCommand(command: CommandDefinition, query: string): number | null {
  return rankedScore(command.label, `${command.description} ${categoryLabel(command.category)}`, query)
}

/** The palette's ranking: the app's own text search, plugged into the shared palette. */
export const rankCommands: CommandRanker = (query, commands) =>
  commands.flatMap(command => {
    const score = scoreCommand(command, query)
    return score === null ? [] : [{ command, score }]
  })
