import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commandById, commandList, runCommand, useCommandRegistry } from '../commands'

/**
 * Les commandes que toute app de la suite expose, par leur identifiant canonique.
 * `commandIds` permet à une app d'en désigner une autre sous un alias historique.
 */
export const CONTRACT_COMMANDS = ['app.palette', 'app.settings', 'app.toggleTheme'] as const

/** Les ids standard (L1) : l'id canonique doit répondre, directement ou par un alias du catalogue. */
export const STANDARD_CONTRACT_COMMANDS = ['app.palette', 'app.settings', 'app.toggleTheme'] as const
export type ContractCommand = (typeof CONTRACT_COMMANDS)[number]

export interface AppContractOptions {
  /** Nom affiché dans la suite de tests. */
  name: string
  /** Appelé avant chaque vérification : vider `localStorage`, remettre les stores à zéro… */
  reset?: () => void | Promise<void>
  /** Id réel d'une commande du contrat, quand l'app a gardé un ancien nom. */
  commandIds?: Partial<Record<ContractCommand, string>>
  /**
   * Commandes du catalogue que l'app n'enregistre volontairement pas à l'ouverture
   * (elles dépendent d'un fichier ouvert, d'une sélection…) : la liste est explicite.
   */
  unregisteredCommands?: readonly string[]
  /**
   * Lots dont l'app a déjà adopté les vérifications (chantier 3). Les autres restent
   * `skip` avec leur numéro : `base` les active toutes, Maths et Mentale au fil de leur migration.
   */
  adoptedLots?: readonly string[]
  /** Touches qui ouvrent la palette (syntaxe user-event). Défaut : Ctrl+K. */
  paletteKeys?: string
}

/**
 * Vérifications des lots suivants : listées ici, déclarées `todo` avec leur numéro,
 * et remplacées par une vraie vérification par le lot concerné (voir `chantier/lots/`).
 */
export const PLANNED_CHECKS: readonly { lot: string; check: string }[] = [
  { lot: 'L1', check: 'la palette liste aussi app.toggleTheme dans toutes les apps' },
  { lot: 'L2', check: 'les clés de stockage de l\'app sont préfixées et relues avec leurs alias' },
  { lot: 'L5', check: 'le zoom 50→150 % par pas de 10 et le mode condensé sont disponibles' },
  { lot: 'L6', check: 'fermer / nouveau / annuler / rétablir sont présents et activés selon l\'état' },
  { lot: 'L7', check: 'les panneaux latéraux se replient au raccourci et mémorisent leur état' },
  { lot: 'L8', check: 'l\'arbre de fichiers crée, renomme, déplace et supprime' },
  { lot: 'L9', check: 'les blocs de contenu s\'éditent et s\'enregistrent' },
]

/**
 * Le test de conformité commun à toutes les apps de la suite : une app qui le
 * passe a le socle attendu (catalogue, palette, réglages, thème). Chaque lot du
 * chantier « Harmonie » y ajoute ses vérifications.
 *
 * `renderApp` renvoie l'app à monter ; l'appelant a déjà posé ses `vi.mock`
 * (Tauri n'existe pas sous jsdom).
 */
export function describeAppContract(renderApp: () => ReactElement, options: AppContractOptions): void {
  const id = (command: ContractCommand) => options.commandIds?.[command] ?? command

  describe(`contrat d'app — ${options.name}`, () => {
    beforeEach(async () => {
      await options.reset?.()
      document.documentElement.classList.remove('dark')
    })
    afterEach(async () => {
      await act(async () => {})
    })

    it('se monte sans erreur', async () => {
      const { container } = render(renderApp())
      await act(async () => {})
      expect(container).not.toBeEmptyDOMElement()
    })

    it.each(CONTRACT_COMMANDS)('le catalogue expose %s', command => {
      expect(commandById(id(command))).toBeDefined()
    })

    const lot = (name: string) => ((options.adoptedLots ?? []).includes(name) ? it : it.skip)

    lot('L1').each(STANDARD_CONTRACT_COMMANDS)('L1 — ids standard : %s répond sous son id canonique', command => {
      // Une app non migrée peut garder un ancien id : l'alias du catalogue doit alors le résoudre.
      expect(commandById(command)).toBeDefined()
    })

    lot('L1')('L1 — toutes les commandes du catalogue ont un gestionnaire une fois l\'app montée', async () => {
      render(renderApp())
      await act(async () => {})
      const registered = useCommandRegistry.getState().registrations
      const orphans = commandList()
        .map(command => command.id)
        .filter(commandId => registered[commandId] === undefined && !(options.unregisteredCommands ?? []).includes(commandId))
      expect(orphans).toEqual([])
    })

    lot('L3')('L3 — l\'écran de chargement apparaît puis disparaît après le plancher', async () => {
      render(renderApp())
      expect(screen.getByRole('status', { name: 'Chargement de l’application' })).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('status', { name: 'Chargement de l’application' })).not.toBeInTheDocument(), {
        timeout: 4000,
      })
    })

    lot('L3')('L3 — app.toggleTheme bascule le thème sombre', async () => {
      render(renderApp())
      await act(async () => {})
      expect(document.documentElement).not.toHaveClass('dark')
      act(() => {
        runCommand(id('app.toggleTheme'))
      })
      await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
    })

    lot('L3')('L3 — les réglages ont les panneaux Raccourcis et Mises à jour', async () => {
      render(renderApp())
      await act(async () => {})
      act(() => {
        runCommand(id('app.settings'))
      })
      const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
      const tabs = within(dialog).getAllByRole('tab').map(tab => tab.textContent ?? '')
      expect(tabs.some(label => label.startsWith('Raccourcis'))).toBe(true)
      expect(tabs.some(label => label.startsWith('Mises à jour'))).toBe(true)
    })

    // Zones de la barre du haut (L4), de gauche à droite : l'ordre est celui de la suite.
    const BAR_ORDER = ['file.new', 'file.close', 'edit.undo', 'edit.redo', 'app.palette', 'app.toggleTheme', 'app.settings']
    const barButtons = () =>
      BAR_ORDER.flatMap(command => {
        const definition = commandById(command)
        if (definition === undefined) return []
        const button = screen.queryAllByRole('button').find(b => b.getAttribute('aria-label') === definition.label)
        return button === undefined ? [] : [{ command, button }]
      })

    lot('L4')('L4 — les zones de la barre du haut sont dans l\'ordre imposé', async () => {
      render(renderApp())
      await act(async () => {})
      const found = barButtons()
      expect(found.map(f => f.command)).toContain('app.settings')
      for (let i = 1; i < found.length; i++) {
        const before = found[i - 1].button.compareDocumentPosition(found[i].button)
        expect(before & Node.DOCUMENT_POSITION_FOLLOWING, `${found[i - 1].command} avant ${found[i].command}`).toBeTruthy()
      }
    })

    lot('L4')('L4 — Fermer est dans la zone fichier, avant Annuler (si l\'app a ces commandes)', async () => {
      render(renderApp())
      await act(async () => {})
      const close = commandById('file.close')
      const undo = commandById('edit.undo')
      if (close === undefined || undo === undefined) return
      // Fermer n'est sur la barre que quand un fichier est ouvert : Nouveau tient la même place.
      const slot = screen.queryAllByRole('button').find(b => [close.label, commandById('file.new')?.label].includes(b.getAttribute('aria-label') ?? ''))
      const undoButton = screen.getByRole('button', { name: undo.label })
      expect(slot).toBeDefined()
      expect(slot!.compareDocumentPosition(undoButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    lot('L4')('L4 — app.shortcuts ouvre l\'onglet Raccourcis des réglages', async () => {
      render(renderApp())
      await act(async () => {})
      if (commandById(id('app.shortcuts' as ContractCommand)) === undefined) return
      act(() => {
        runCommand(id('app.shortcuts' as ContractCommand))
      })
      const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
      const selected = within(dialog).getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')
      expect(selected?.textContent ?? '').toMatch(/^Raccourcis/)
    })

    it('la palette s\'ouvre au raccourci et liste les paramètres', async () => {
      const user = userEvent.setup()
      render(renderApp())
      await act(async () => {})
      await user.keyboard(options.paletteKeys ?? '{Control>}k{/Control}')
      const dialog = await screen.findByRole('dialog', { name: 'Palette de commandes' })
      // La liste peut être tronquée : on cherche chaque commande par son libellé.
      const search = within(dialog).getByLabelText('Rechercher une commande')
      // `app.toggleTheme` n'est pas exigé ici : Mentale ne l'enregistre qu'avec sa barre d'outils (L1/L4).
      for (const command of ['app.settings'] as const) {
        const label = commandById(id(command))!.label
        await user.clear(search)
        await user.type(search, label)
        expect(await within(dialog).findByRole('option', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')) })).toBeInTheDocument()
      }
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    describe('vérifications des lots suivants', () => {
      for (const { lot, check } of PLANNED_CHECKS) it.todo(`${lot} — ${check}`)
    })
  })
}
