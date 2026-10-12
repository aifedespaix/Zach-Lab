import { describe, expect, it, vi } from 'vitest'

/**
 * The shared command framework knows no command until the app registers its
 * catalogue, and `types/commands.ts` does that as a SIDE EFFECT of being loaded.
 * Every other import of that file in the app is `import type` — erased at build
 * time — so nothing but an explicit value import in the app's own graph makes it
 * run. The test setup imports it for every test, which is exactly what hid this
 * once: the whole suite was green while the real app started with an empty
 * catalogue (no shortcut, an empty palette, toolbar buttons that render nothing).
 *
 * So this test forgets what the setup did and loads the app the way production
 * does.
 */
describe('registration of the command catalogue', () => {
  it('happens as soon as the app is loaded, not only under the test setup', async () => {
    vi.resetModules()
    await import('./App')
    const { commandList, commandById } = await import('@suite/shared/commands')

    expect(commandList().length).toBeGreaterThan(0)
    expect(commandById('file.new')).toBeDefined()
    // Importe l'application entière à neuf : lent par nature, et proche du délai par défaut sous charge.
  }, 20_000)
})

describe('ids standard et alias des commandes renommées', () => {
  it('l’ancien identifiant résout vers le standard (les raccourcis enregistrés restent valables)', async () => {
    await import('./types/commands')
    const { commandById, isCommandId } = await import('@suite/shared/commands')

    expect(commandById('file.newFolder')?.id).toBe('tree.newFolder')
    expect(commandById('file.refresh')?.id).toBe('tree.refresh')
    expect(isCommandId('tree.refresh')).toBe(true)
  })
})
