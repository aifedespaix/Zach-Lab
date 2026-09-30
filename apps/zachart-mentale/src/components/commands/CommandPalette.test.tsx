import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  CommandPalette,
  commandList,
  rankCommandsBySearch,
  useCommandRegistry,
  useShortcutSettingsStore,
} from '@suite/shared/commands'

function publish(id: string, run: () => void, enabled = true) {
  act(() => useCommandRegistry.getState().register(id as never, { run, enabled }))
}

/** The palette's ranking, run on the app's real catalogue: ids, best match first. */
function ranked(query: string): string[] {
  return rankCommandsBySearch(query, commandList())
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.command.id)
}

describe('classement de la palette sur le vrai catalogue', () => {
  it('met un nom exact avant un mot noyé dans une explication', () => {
    // « Renommer » existe pour un fichier ET pour une carte : les deux passent en tête.
    expect(ranked('renommer').slice(0, 2).sort()).toEqual(['edit.rename', 'file.rename'])
    // « confirmation » n'apparaît que dans l'explication de la suppression.
    expect(ranked('confirmation')).toContain('edit.delete')
  })

  it('ignore les accents et la casse, parce que personne ne les tape dans une barre de recherche', () => {
    expect(ranked('creer une carte')).toContain('card.addFloating')
    expect(ranked('CRÉER UNE CARTE')).toContain('card.addFloating')
  })

  it('tolère une faute de frappe et un pluriel', () => {
    expect(ranked('annuller')).toContain('edit.undo')
    expect(ranked('raccourci')[0]).toBeDefined()
  })

  it('ne renvoie rien plutôt qu\'une correspondance faible', () => {
    expect(ranked('xyzzy')).toEqual([])
  })

  it('liste tout le catalogue pour une requête vide', () => {
    expect(ranked('')).toHaveLength(commandList().length)
  })
})

describe('CommandPalette', () => {
  beforeEach(() => {
    useCommandRegistry.setState({ registrations: {} })
    useShortcutSettingsStore.getState().resetAll()
  })

  it('shows each action with its category and its current shortcut', async () => {
    const user = userEvent.setup()
    render(<CommandPalette open onOpenChange={() => {}} />)

    await user.type(screen.getByLabelText('Rechercher une commande'), 'annuler')
    const option = screen.getByRole('option', { name: /Annuler/ })
    expect(option).toHaveTextContent('Édition')
    expect(option).toHaveTextContent('Ctrl + Z')
  })

  it('runs the highlighted action on Entrée and closes', async () => {
    const user = userEvent.setup()
    const undo = vi.fn()
    const onOpenChange = vi.fn()
    publish('edit.undo', undo)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<CommandPalette open onOpenChange={onOpenChange} />)
      await user.type(screen.getByLabelText('Rechercher une commande'), 'annuler')
      await user.keyboard('{Enter}')
      expect(onOpenChange).toHaveBeenCalledWith(false)
      // Deferred by a tick so the closing dialog cannot steal focus from
      // whatever the command opens.
      act(() => vi.runAllTimers())
      expect(undo).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('lists an unavailable action, greyed, rather than hiding it', async () => {
    // « Coller la carte » missing looks like a missing feature; greyed out, it
    // says the clipboard is empty.
    const user = userEvent.setup()
    const paste = vi.fn()
    publish('edit.paste', paste, false)
    render(<CommandPalette open onOpenChange={() => {}} />)

    await user.type(screen.getByLabelText('Rechercher une commande'), 'coller')
    expect(screen.getByRole('option', { name: /Coller la carte/ })).toBeDisabled()
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    render(<CommandPalette open onOpenChange={() => {}} />)
    await user.type(screen.getByLabelText('Rechercher une commande'), 'xyzzy')
    expect(screen.getByText(/Aucune commande ne correspond/)).toBeInTheDocument()
  })
})
