# 08 — Architecture cible

> Esquisses d'API : elles fixent l'**intention** (qui possède quoi), pas la signature finale. Le lot qui
> implémente un module a le droit d'ajuster les types, pas les responsabilités. Toute entorse est notée
> dans le journal de `07-decisions-ux.md`.

## Principes

1. **Trois façons seulement de varier** : *config* (données), *slots* (rendu), *ports* (E/S). Pas de
   branche `if (app === …)`.
2. **Composition d'abord** : hook « headless » (logique) + composants composés (rendu) plutôt qu'un composant
   à 40 props. L'app peut reprendre le hook et refaire le rendu.
3. **L'app déclare, le commun orchestre** : catalogue de commandes, sections de panneau, zones de barre,
   panneaux de réglages, adaptateurs de fichiers — tout est un enregistrement déclaratif.
4. **Un module = une entrée publique** (`@suite/shared/<module>`) ; `boundary.test.ts` continue de
   l'imposer. Pas de dépendance circulaire entre modules (ordre ci-dessous).
5. **Évolutivité** : ajouter une app = copier `base`, changer `app.config.ts`, remplacer la zone de travail.
   Ajouter une fonctionnalité commune = un module + son entrée dans `describeAppContract`.

## Modules de `@suite/shared` (existants ★ et à créer ＋)

Ordre = sens des dépendances (un module n'importe que ceux au-dessus de lui).

| Module | Rôle | Contenu |
|---|---|---|
| ★ `lib` | utilitaires | `utils`, `relativeTime` |
| ＋ `storage` | préférences et config | `createPersisted*`, `appStorage(id)`, `readJsonConfig`/`writeJsonConfig`, `readVersioned` |
| ★ `ui` | primitives | button, dialog, menus, tooltip/`Hint`, `ConfirmDialog` ; ＋ `NameDialog` |
| ★ `theme` | thème | store, transition circulaire ; ＋ `ThemeToggle` |
| ★ `commands` | commandes | catalogue, raccourcis, palette ; ＋ `aliases`, `createTypedCommands`, ids standard |
| ＋ `history` | annuler/rétablir | `createHistoryStore<T>` (limite, regroupement), commandes `edit.undo/redo` |
| ★ `shell` | cadre | `AppShell`, panneaux, `OverflowToolbar` ; ＋ `ToolbarZones`, `StatusBanner`, `HomeScreen`, `AnimatedMark`, `AppBoot`, `PanelSections`, `PanelToggles` |
| ＋ `view` | affichage | `useUiZoom`, `ZoomControls`, `useDensity`, police |
| ★ `tree` | arbre | moteur de DnD ; ＋ `FileTree`, `TreeAdapter`, commandes `tree.*` |
| ＋ `files` | cycle de vie | `useFileSession<T>`, `DocumentPort<T>`, `useAutosave`, garde, titre de fenêtre, ouvrir-avec, dépôt, récents, session, dialogues d'échec |
| ★ `settings` | réglages | dialogue ; ＋ `standardSettings()` |
| ★ `update` | mises à jour | |
| ＋ `text` | texte | correcteur orthographique, `FieldContextMenu`, `insertAtCursor` |
| ★ `math` `equation` `search` | contenus | inchangés |
| ＋ `app` | assemblage | `defineApp`, `<SuiteApp>` |
| ＋ `testing` | tests | `describeAppContract`, `renderApp`, `memoryFs`, faux `TreeAdapter` |

## L'assemblage : `defineApp` + `<SuiteApp>`

```ts
// apps/<app>/src/app.config.ts — la seule chose qui différencie base d'une vraie app, avec la zone de travail
export const app = defineApp({
  id: 'zachart-maths',                       // préfixe des clés de stockage, titre de fenêtre
  name: "Zach'Math",
  mark: MathsMark,                           // logo animé (M)
  boot: { floorMs: 1300 },
  commands: COMMANDS,                        // catalogue, aliases inclus
  panels: {
    left:  { storage: { min: 180, max: 520, fallback: 240 }, railLabel: <TreeRailLabel />, … },
    right: { storage: { min: 300, max: 640, fallback: 400 }, sections: SECTIONS },
  },
  toolbar: { items: [ …items posés dans des zones… ] },
  settings: standardSettings({ appearance: { font: true, density: true, zoom: true } }).with(ownPanels),
})
```

```tsx
// apps/base/src/App.tsx — c'est tout
export default function App() {
  return (
    <SuiteApp app={app} left={<FileTree adapter={textFiles} config={…} />}>
      <TextDocument />
    </SuiteApp>
  )
}
```

`<SuiteApp>` fait le câblage dupliqué aujourd'hui : `useThemeDomSync`, `useGlobalShortcuts`, initialisation
des raccourcis, `useAppUpdater`, `TooltipProvider`, palette, réglages, bannières, écran de chargement,
`useUiZoom`, titre de fenêtre, enregistrement des commandes `app.* edit.* view.*` standard. Les commandes
dont la logique dépend du document (`file.new`, `edit.undo`…) sont enregistrées par `useFileSession` /
`createHistoryStore` quand l'app les monte.

## Les ports (ce que l'app branche)

```ts
// Fichier ouvert
interface DocumentPort<T> {
  read(path: string): Promise<T | null>          // null = le fichier n'existe plus
  write(path: string, doc: T): Promise<void>
  validate?(raw: T): { ok: true } | { ok: false; issues: unknown[] }
  repair?(raw: T): T                              // active la réparation (copie)
  create?(input: unknown): Promise<string>        // chemin du fichier créé
}

// Arbre
interface TreeAdapter {
  list(): Promise<TreeNode[]>                     // { id, path, name, kind: 'folder'|'file', status? , meta? }
  create(kind: 'folder' | 'file', parent: string | null, name: string): Promise<string>
  rename(path: string, name: string): Promise<string>
  move(path: string, toFolder: string | null): Promise<string>
  duplicate(path: string): Promise<string>
  remove(path: string): Promise<void>
  reorder?(path: string, delta: -1 | 1): Promise<void>   // présent ⇒ Monter/Descendre + ordre manuel
  canDrop?(source: TreeNode, target: TreeNode): boolean
}

// Système de fichiers (Tauri en prod, mémoire en test) — déjà le patron d'ExerciseFs
interface Fs { readText; writeText; exists; list; mkdir; remove; rename; copy; stat }
```

## Les slots et la config de l'arbre

```ts
<FileTree
  adapter={…}
  config={{ maxFolderDepth: 1, roots: 'single', labels: { folder: 'chapitre', file: 'fiche' },
            storageKey: 'tree-state', search: { index: buildIndex } }}
  slots={{ badges, rowMenu, filters, footerActions, emptyState, railLabel }}
/>
```

## `ToolbarZones` (extrait)

```ts
type ToolbarZone = 'file' | 'edit' | 'title' | 'app' | 'panels' | 'view' | 'system'
interface ToolbarItem { id: string; zone: ToolbarZone; node: ReactNode; menu?: ReactNode; priority: number }
// Le commun ajoute lui-même : file (new/close/menu Fichier), edit (undo/redo), title, panels (pastilles),
// view (zoom, densité), system (palette, thème, réglages). L'app ajoute zone 'app' (et peut masquer un item standard).
```

## Ce qui reste, par app, après le chantier

| | Reste propre à l'app |
|---|---|
| **base** | `app.config.ts` (≈ 40 l.), `TextDocument` (≈ 60 l.), `App.tsx` (≈ 15 l.) |
| **Maths** | blocs et éditeurs, exercices/fiches, correction, cours/notes/calculatrice, unités/termes, adaptateur de fiches |
| **Mentale** | canvas React Flow, cartes/fiches, quiz, synchro PocketBase + admin, import/export, adaptateur de cartes |

## Garde-fous techniques ajoutés

- `boundary.test.ts` (shared) : existant ; étendu pour interdire `localStorage` hors `storage` (après L2).
- Test « chaque app déclare ses ids de commande dans les espaces standard ou dans un espace à elle ».
- Test « aucun alias de commande n’a disparu ».
- `describeAppContract` dans la CI de chaque app (script `test`).
- `scripts/measure-sharing.mjs` : part des lignes exécutées par `base` venant de `shared` ; rapport dans `suivi.md`.
