import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Search } from 'lucide-react'
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import { TooltipProvider } from '../ui'
import { defineCommandCatalog, resetCommandCatalog } from './catalog'
import { standardCommands } from './standard'
import { createTypedCommands } from './typed'
import { useCommandRegistry } from './useCommandRegistry'

const COMMANDS = [
  ...standardCommands(['app.palette', 'file.new']),
  { id: 'card.add', label: 'Ajouter une carte', description: 'Ajoute.', category: 'file', defaultBinding: null },
] as const

const typed = createTypedCommands<typeof COMMANDS, 'sheet.new'>()

afterEach(() => {
  resetCommandCatalog()
  useCommandRegistry.setState({ registrations: {} })
})

describe('createTypedCommands', () => {
  it('type les ids : ceux du catalogue et les alias déclarés, pas les autres', () => {
    type Id = Parameters<typeof typed.runCommand>[0]
    expectTypeOf<Id>().toEqualTypeOf<'app.palette' | 'file.new' | 'card.add' | 'sheet.new'>()
    // @ts-expect-error une faute de frappe ne compile pas
    typed.runCommand('card.edt')
  })

  it('lance une commande et rend un bouton relié au catalogue', async () => {
    defineCommandCatalog({ categories: [{ id: 'file', label: 'Fichier' }], commands: COMMANDS, aliases: { 'sheet.new': 'file.new' } })
    let ran = 0
    function Host() {
      typed.useCommand('sheet.new', () => ran++)
      return (
        <TooltipProvider>
          <typed.CommandButton command="file.new" icon={Search} />
        </TooltipProvider>
      )
    }
    render(<Host />)
    await act(async () => {})
    await userEvent.setup().click(screen.getByRole('button', { name: 'Nouveau fichier' }))
    expect(ran).toBe(1)
    expect(typed.runCommand('file.new')).toBe(true)
    expect(ran).toBe(2)
  })
})
