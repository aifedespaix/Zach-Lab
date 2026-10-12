import { readStored, writeStored } from '@suite/shared/storage'

const KEY = 'zachart-mentale:show-unreadable-files'

/** Whether the file sidebar shows files it cannot open (hidden by default). Read at each call, like the other toggles. */
export const loadShowUnreadableFiles = (): boolean => readStored(KEY) === 'true'

export const saveShowUnreadableFiles = (value: boolean): void => {
  writeStored(KEY, String(value))
}
