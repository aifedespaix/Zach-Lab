import type { CommandCategoryDef, CommandDefinition } from './catalog'

/**
 * The vocabulary every app of the suite shares: one id, one meaning, one
 * default key. An app picks the ones it has with `standardCommands([...])` and
 * adds its own beside them; it may reword a standard command (label,
 * description) or move its default key, never give its id another meaning.
 *
 * Ids are plain data here so a student's customised shortcut survives an app
 * adopting them: an app that used to call `sheet.new` what is now `file.new`
 * declares the old id in the catalogue's `aliases`.
 */
const DEFINITIONS = {
  // ── Application ───────────────────────────────────────────────────────────
  'app.palette': {
    label: 'Palette de commandes',
    description: 'Cherche une action par son nom et la lance.',
    category: 'app',
    defaultBinding: 'Mod+K',
    allowInEditable: true,
  },
  'app.settings': {
    label: 'Paramètres',
    description: 'Ouvre la fenêtre des paramètres.',
    category: 'app',
    defaultBinding: 'Mod+Comma',
  },
  'app.shortcuts': {
    label: 'Raccourcis clavier',
    description: 'Ouvre la liste des raccourcis, pour les consulter ou les modifier.',
    category: 'app',
    defaultBinding: 'F1',
  },
  'app.toggleTheme': {
    label: 'Basculer le thème',
    description: 'Passe du thème clair au thème sombre, et inversement.',
    category: 'app',
    defaultBinding: 'Mod+Shift+T',
  },
  // ── Fichier ───────────────────────────────────────────────────────────────
  'file.new': {
    label: 'Nouveau fichier',
    description: 'Crée un fichier et l’ouvre.',
    category: 'file',
    defaultBinding: 'Mod+N',
  },
  'file.open': {
    label: 'Ouvrir',
    description: 'Choisit un fichier à ouvrir.',
    category: 'file',
    defaultBinding: 'Mod+O',
  },
  'file.save': {
    label: 'Enregistrer maintenant',
    description: 'Écrit immédiatement le fichier sur le disque, sans attendre la sauvegarde automatique.',
    category: 'file',
    defaultBinding: 'Mod+S',
    allowInEditable: true,
  },
  'file.rename': {
    label: 'Renommer',
    description: 'Renomme le fichier ouvert.',
    category: 'file',
    defaultBinding: 'Mod+Shift+R',
  },
  'file.duplicate': {
    label: 'Dupliquer',
    description: 'Copie le fichier ouvert à côté de l’original, sous un nouveau nom.',
    category: 'file',
    defaultBinding: 'Mod+Shift+S',
  },
  'file.delete': {
    label: 'Supprimer',
    description: 'Supprime le fichier ouvert du disque, après confirmation.',
    category: 'file',
    defaultBinding: null,
    destructive: true,
  },
  'file.reveal': {
    label: 'Afficher dans l’explorateur',
    description: 'Ouvre le dossier du fichier et le sélectionne.',
    category: 'file',
    defaultBinding: 'Mod+Shift+E',
  },
  'file.close': {
    label: 'Fermer',
    description: 'Ferme le fichier ouvert et revient à l’accueil.',
    category: 'file',
    defaultBinding: 'Mod+W',
  },
  // ── Édition ───────────────────────────────────────────────────────────────
  'edit.undo': {
    label: 'Annuler',
    description: 'Annule la dernière modification.',
    category: 'edit',
    defaultBinding: 'Mod+Z',
    allowInEditable: true,
  },
  'edit.redo': {
    label: 'Rétablir',
    description: 'Rétablit la modification qui vient d’être annulée.',
    category: 'edit',
    defaultBinding: 'Mod+Shift+Z',
    allowInEditable: true,
  },
  // ── Affichage ─────────────────────────────────────────────────────────────
  'view.toggleLeftPanel': {
    label: 'Afficher ou masquer le panneau de gauche',
    description: 'Replie le panneau de gauche pour donner toute la place à la zone de travail.',
    category: 'view',
    defaultBinding: 'Mod+B',
  },
  'view.toggleRightPanel': {
    label: 'Afficher ou masquer le panneau de droite',
    description: 'Replie le panneau de droite pour donner toute la place à la zone de travail.',
    category: 'view',
    defaultBinding: 'Mod+Shift+B',
  },
  'view.zoomOut': {
    label: 'Dézoomer',
    description: 'Réduit la taille de l’application de 10 % (jusqu’à 50 %).',
    category: 'view',
    defaultBinding: 'Mod+Minus',
  },
  'view.zoomIn': {
    label: 'Zoomer',
    description: 'Agrandit l’application de 10 % (jusqu’à 150 %).',
    category: 'view',
    defaultBinding: 'Mod+Plus',
  },
  'view.zoomReset': {
    label: 'Zoom à 100 %',
    description: 'Remet l’application à sa taille normale.',
    category: 'view',
    defaultBinding: 'Mod+0',
  },
  'view.toggleDensity': {
    label: 'Mode condensé',
    description: 'Réduit les marges et les espacements pour voir plus de contenu à la fois.',
    category: 'view',
    defaultBinding: null,
  },
  // ── Arborescence ──────────────────────────────────────────────────────────
  'tree.newFolder': {
    label: 'Nouveau dossier',
    description: 'Crée un dossier dans l’arborescence.',
    category: 'tree',
    defaultBinding: null,
  },
  'tree.newFile': {
    label: 'Nouveau fichier ici',
    description: 'Crée un fichier dans le dossier choisi de l’arborescence.',
    category: 'tree',
    defaultBinding: null,
  },
  'tree.collapseAll': {
    label: 'Tout replier',
    description: 'Replie tous les dossiers de l’arborescence.',
    category: 'tree',
    defaultBinding: null,
  },
  'tree.refresh': {
    label: 'Actualiser l’arborescence',
    description: 'Relit les dossiers, pour voir les fichiers ajoutés en dehors de l’app.',
    category: 'tree',
    defaultBinding: 'F5',
  },
  'tree.focusSearch': {
    label: 'Rechercher dans l’arborescence',
    description: 'Place le curseur dans le champ de recherche de l’arborescence.',
    category: 'tree',
    defaultBinding: null,
  },
} as const satisfies Record<string, Omit<CommandDefinition, 'id'>>

export type StandardCommandId = keyof typeof DEFINITIONS

/** What an app may change on a standard command: the wording and the default key, never the meaning. */
export type StandardCommandOverride = Partial<Pick<CommandDefinition, 'label' | 'description' | 'defaultBinding'>>

/** Every standard id, in catalogue order. */
export const STANDARD_COMMAND_IDS = Object.keys(DEFINITIONS) as readonly StandardCommandId[]

export function isStandardCommandId(id: string): id is StandardCommandId {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, id)
}

/** The standard categories, in display order. An app appends its own after them. */
export const STANDARD_CATEGORIES: readonly CommandCategoryDef[] = [
  { id: 'app', label: 'Application' },
  { id: 'file', label: 'Fichier' },
  { id: 'edit', label: 'Édition' },
  { id: 'view', label: 'Affichage' },
  { id: 'tree', label: 'Arborescence' },
  { id: 'panel', label: 'Panneaux' },
]

/**
 * The definitions of the standard commands an app uses, in the order given.
 *
 * `overrides` rewords or rebinds one of them. Throws on an id that is not
 * standard: a typo must not become a command that silently does not exist.
 */
export function standardCommands<const I extends StandardCommandId>(
  ids: readonly I[],
  overrides: Partial<Record<I, StandardCommandOverride>> = {},
): readonly (CommandDefinition & { readonly id: I })[] {
  return ids.map(id => {
    if (!isStandardCommandId(id)) throw new Error(`Commande standard inconnue : « ${id} »`)
    return { id, ...DEFINITIONS[id], ...overrides[id] } as CommandDefinition & { readonly id: I }
  })
}
