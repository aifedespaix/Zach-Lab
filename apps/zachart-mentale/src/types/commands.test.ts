import { describe, it, expect } from 'vitest'
import { commandById, commandList, conflictsIn, resolveBindings } from '@suite/shared/commands'
import './commands'

describe('command catalogue — recherche', () => {
  it('view.findInTree no longer has a default binding', () => {
    expect(commandById('view.findInTree')?.defaultBinding).toBeNull()
  })

  it('view.findInCards exists, view-category, no default binding', () => {
    const command = commandById('view.findInCards')
    expect(command?.category).toBe('view')
    expect(command?.defaultBinding).toBeNull()
  })

  it('app.find owns Mod+F, works while typing and while suspended (quiz)', () => {
    const command = commandById('app.find')
    expect(command?.category).toBe('app')
    expect(command?.defaultBinding).toBe('Mod+F')
    expect(command?.allowInEditable).toBe(true)
    expect(command?.allowWhenSuspended).toBe(true)
  })
})

describe('command catalogue — cohérence', () => {
  it('is registered with the shared framework as soon as the module is loaded', () => {
    expect(commandList().length).toBeGreaterThan(0)
    expect(commandById('file.new')?.label).toBe('Nouvelle carte mentale')
  })

  it('ships no two defaults on one key', () => {
    // A default that shadows another default would make one of the two dead on
    // a fresh install, which no user could diagnose.
    expect([...conflictsIn(resolveBindings({})).keys()]).toEqual([])
  })

  it('gives every command a category the settings panel can show', () => {
    const shown = new Set(['file', 'edit', 'card', 'navigation', 'view', 'app'])
    for (const command of commandList()) expect(shown.has(command.category), command.id).toBe(true)
  })

  it('lets a shipped real binding win over another command’s alias', () => {
    expect(resolveBindings({ 'card.openFiche': 'Mod+Y' })['card.openFiche']).toBe('Mod+Y')
  })
})
