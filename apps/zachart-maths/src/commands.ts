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
    id: 'view.toggleUnitColors',
    label: 'Colorer unités et termes',
    description: 'Colore les grandeurs et leurs unités (16 km, 3 km/h) dans l’énoncé, les textes et la réponse, et les termes semblables d’une équation (3x et 5x) dans l’aide sous le bloc.',
    category: 'view',
    defaultBinding: null,
  },
  {
    id: 'view.toggleCompact',
    label: 'Mode condensé',
    description: 'Réduit les marges et les espacements de la zone centrale pour voir plus de blocs à la fois.',
    category: 'view',
    defaultBinding: null,
  },
  {
    id: 'view.zoomOut',
    label: 'Dézoomer',
    description: 'Réduit la taille de l’application de 10 % (jusqu’à 50 %).',
    category: 'view',
    defaultBinding: 'Mod+Minus',
  },
  {
    id: 'view.zoomIn',
    label: 'Zoomer',
    description: 'Agrandit l’application de 10 % (jusqu’à 150 %).',
    category: 'view',
    defaultBinding: 'Mod+Plus',
  },
  {
    id: 'view.zoomReset',
    label: 'Zoom à 100 %',
    description: 'Remet l’application à sa taille normale.',
    category: 'view',
    defaultBinding: 'Mod+0',
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
  {
    id: 'tree.newChapter',
    label: 'Nouveau chapitre',
    description: 'Crée un chapitre (un dossier) dans tes exercices.',
    category: 'tree',
    defaultBinding: null,
  },
  {
    id: 'tree.toggleAll',
    label: 'Tout replier ou déplier',
    description: 'Replie tous les chapitres, ou les déplie si tout est déjà replié.',
    category: 'tree',
    defaultBinding: null,
  },
  {
    id: 'tree.onlyToCorrect',
    label: 'Fiches à corriger seulement',
    description: 'Ne montre dans l’arborescence que les fiches qui ont encore des exercices à corriger.',
    category: 'tree',
    defaultBinding: null,
  },
  {
    id: 'correction.next',
    label: 'Prochain exercice à corriger',
    description: 'Saute à l’exercice commencé et pas encore corrigé qui suit, dans la fiche puis dans les suivantes.',
    category: 'tree',
    defaultBinding: 'Mod+Shift+J',
    allowInEditable: true,
  },
  {
    id: 'correction.toggleHide',
    label: 'Masquer les exercices corrigés du plan',
    description: 'Cache, dans le plan de la fiche, les exercices déjà corrigés.',
    category: 'tree',
    defaultBinding: null,
  },
  {
    id: 'review.open',
    label: 'Mode révision',
    description: 'Liste les exercices corrigés pour les relire, par chapitre, avec ceux à revoir.',
    category: 'tree',
    defaultBinding: null,
  },
  {
    id: 'exercise.toggleCorrected',
    label: 'Exercice corrigé',
    description: 'Marque l’exercice ouvert comme corrigé, ou le remet à corriger.',
    category: 'tree',
    defaultBinding: 'Mod+Shift+K',
    allowInEditable: true,
  },
  {
    id: 'exercise.toggleReview',
    label: 'À revoir',
    description: 'Marque un exercice corrigé comme raté, à revoir, ou retire la marque.',
    category: 'tree',
    defaultBinding: 'Mod+Shift+L',
    allowInEditable: true,
  },
  {
    id: 'exercise.previous',
    label: 'Exercice précédent',
    description: 'Passe à l’exercice d’avant dans la fiche (en crée un avant le premier).',
    category: 'tree',
    defaultBinding: 'Mod+PageUp',
    allowInEditable: true,
  },
  {
    id: 'exercise.next',
    label: 'Exercice suivant',
    description: 'Passe à l’exercice d’après dans la fiche (en crée un après le dernier).',
    category: 'tree',
    defaultBinding: 'Mod+PageDown',
    allowInEditable: true,
  },
  {
    id: 'exercise.toggleSplit',
    label: 'Scinder ou réunir la zone de travail',
    description: 'Partage la zone de travail de l’exercice en deux, ou la réunit.',
    category: 'tree',
    defaultBinding: 'Mod+Shift+S',
    allowInEditable: true,
  },
  {
    id: 'exercise.delete',
    label: 'Supprimer l’exercice',
    description: 'Demande confirmation, puis supprime l’exercice ouvert de la fiche.',
    category: 'tree',
    defaultBinding: 'Mod+Shift+Delete',
    allowInEditable: true,
  },
] as const

export type CommandId = (typeof COMMANDS)[number]['id']

defineCommandCatalog({
  categories: [
    { id: 'app', label: 'Application' },
    { id: 'view', label: 'Affichage' },
    { id: 'cours', label: 'Cours et notes' },
    { id: 'tree', label: 'Exercices' },
  ],
  commands: COMMANDS,
})
