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
  {
    id: 'cours.search',
    label: 'Chercher un cours',
    description: 'Ouvre la recherche de cours.',
    category: 'cours',
    defaultBinding: 'Mod+Shift+F',
    allowInEditable: true,
  },
  {
    id: 'notes.toggle',
    label: 'Afficher ou masquer les notes',
    description: 'Les cours prennent toute la hauteur quand les notes sont masquées.',
    category: 'cours',
    defaultBinding: 'Mod+Shift+N',
    allowInEditable: true,
  },
  {
    id: 'view.toggleTree',
    label: 'Afficher ou masquer l’arborescence',
    description: 'Replie le panneau des exercices pour donner toute la place à la zone de travail.',
    category: 'view',
    defaultBinding: 'Mod+B',
  },
  {
    id: 'view.toggleCourses',
    label: 'Afficher ou masquer les cours',
    description: 'Replie le panneau des cours et des notes pour donner toute la place à la zone de travail.',
    category: 'view',
    defaultBinding: 'Mod+Shift+B',
  },
] as const

export type CommandId = (typeof COMMANDS)[number]['id']

defineCommandCatalog({
  categories: [
    { id: 'app', label: 'Application' },
    { id: 'view', label: 'Affichage' },
    { id: 'cours', label: 'Cours et notes' },
  ],
  commands: COMMANDS,
})
