import { describe, it, expect } from 'vitest'
import { commandById } from './commands'

describe('command catalogue — recherche', () => {
  it('view.findInTree no longer has a default binding', () => {
    expect(commandById('view.findInTree')?.defaultBinding).toBeNull()
  })

  it('view.findInCards exists, view-category, no default binding', () => {
    const command = commandById('view.findInCards')
    expect(command?.category).toBe('view')
    expect(command?.defaultBinding).toBeNull()
  })

  it('app.find owns Mod+F, works while typing and during a quiz', () => {
    const command = commandById('app.find')
    expect(command?.category).toBe('app')
    expect(command?.defaultBinding).toBe('Mod+F')
    expect(command?.allowInEditable).toBe(true)
    expect(command?.allowInQuiz).toBe(true)
  })
})
