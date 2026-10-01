import { defineCommandCatalog } from '@suite/shared/commands'

/**
 * What this app can do, declared once: the toolbar, the palette and the
 * shortcuts panel all read it. Add your app's actions here — a `category` must
 * be one of `categories` below — and register their handlers with `useCommand`.
 */
export const COMMANDS = [
  {
    id: 'app.palette',
    label: 'Palette de commandes',
    description: 'Cherche une action par son nom et la lance.',
    category: 'app',
    defaultBinding: 'Mod+K',
    allowInEditable: true,
  },
  {
    id: 'app.settings',
    label: 'Paramètres',
    description: 'Ouvre la fenêtre des paramètres.',
    category: 'app',
    defaultBinding: 'Mod+Comma',
  },
  {
    id: 'app.toggleTheme',
    label: 'Basculer le thème',
    description: 'Passe du thème clair au thème sombre, et inversement.',
    category: 'app',
    defaultBinding: null,
  },
] as const

export type CommandId = (typeof COMMANDS)[number]['id']

defineCommandCatalog({
  categories: [{ id: 'app', label: 'Application' }],
  commands: COMMANDS,
})
