import { readStored, writeStored } from '@suite/shared/storage'

const KEY = 'zachart-mentale:description-narrow'

/**
 * Whether the card-description dialog remembered its NARROW width. `false` is
 * the roomy default it has always opened in. Read at each call, so the first
 * paint is already the chosen width.
 */
export const loadDescriptionNarrow = (): boolean => readStored(KEY) === 'true'

export const saveDescriptionNarrow = (value: boolean): void => {
  writeStored(KEY, String(value))
}
