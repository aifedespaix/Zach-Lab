import { describe, expect, it } from 'bun:test'
import { measure, resolveImport } from './measure-sharing.mjs'

describe('measure-sharing', () => {
  it('compte du code de shared et de l\'app pour base, et la part est un pourcentage', () => {
    const result = measure('apps/base')
    expect(result.totals.shared).toBeGreaterThan(0)
    expect(result.totals.app).toBeGreaterThan(0)
    expect(result.percent).toBeGreaterThan(0)
    expect(result.percent).toBeLessThan(100)
  })

  it('exclut les tests de la mesure', () => {
    const result = measure('apps/base')
    expect(result.files.app).toBeLessThan(10)
  })

  it('ignore un paquet npm et résout une entrée publique de shared', () => {
    expect(resolveImport('react', '/x/a.ts', '/x')).toBeNull()
    expect(resolveImport('@suite/shared/commands', '/x/a.ts', '/x')).toMatch(/packages\/shared\/src\/commands\/index\.ts$/)
  })
})
