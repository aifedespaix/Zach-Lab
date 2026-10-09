import { describe, expect, it } from 'vitest'
import { readVersioned } from './versioned'

const options = {
  current: 3,
  steps: {
    1: (v: unknown) => ({ ...(v as object), version: 2, renamed: (v as { old: string }).old }),
    2: (v: unknown) => ({ ...(v as object), version: 3, extra: true }),
  },
}

describe('readVersioned', () => {
  it('applique les migrations dans l\'ordre, de la version trouvée à la courante', () => {
    const result = readVersioned({ old: 'a' }, options)
    expect(result).toMatchObject({ from: 1, migrated: true, value: { version: 3, renamed: 'a', extra: true } })
  })
  it('ne touche pas une valeur déjà à jour', () => {
    const value = { version: 3 }
    expect(readVersioned(value, options)).toEqual({ value, from: 3, migrated: false })
  })
  it('refuse une version plus récente que le code', () => {
    expect(() => readVersioned({ version: 4 }, options)).toThrow(/plus récente/)
  })
  it('signale un trou dans les migrations', () => {
    expect(() => readVersioned({ version: 1 }, { current: 3, steps: { 2: v => v } })).toThrow(/v1 à la v2/)
  })
  it('accepte une façon à soi de lire la version', () => {
    const result = readVersioned({ schema: 2 }, { current: 3, steps: { 2: v => ({ ...(v as object), schema: 3 }) }, versionOf: v => (v as { schema: number }).schema })
    expect(result.value).toEqual({ schema: 3 })
  })
})
