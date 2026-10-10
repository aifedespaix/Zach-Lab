import { ChevronDown, Minus, Plus, Rows3, Copy, FilePlus, FolderOpen, FolderPlus, FolderSearch, Moon, PenLine, Redo2, Save, Search, Settings, Trash2, Undo2, X, type LucideIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { CommandButton, CommandDropdownItem, commandById } from '../commands'
import { ThemeToggle } from '../theme'
import { DensityToggle, ZoomControls } from '../view'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui'
import { OverflowToolbar } from './OverflowToolbar'
import { arrangeToolbar, type ToolbarDefinition, type ToolbarItem, type ToolbarZone } from './toolbarZones'
import { isToolbarItemLocked, visibleToolbarItems } from './toolbarVisibility'

export type SaveStatus = 'saved' | 'saving' | 'error'

/** What the bar needs to know about the open file. The file session (L6) fills it. */
export interface ToolbarFile {
  open: boolean
  name?: string
  /** Full path, shown on hover. */
  path?: string
  status?: SaveStatus
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Enregistré',
  saving: 'Enregistrement…',
  error: '⚠ Erreur de sauvegarde',
}

/** The file's name (truncated, full path on hover) and whether it is saved. */
export function FileTitle({ name, path, status }: { name: string; path?: string; status?: SaveStatus }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, minWidth: 0, maxWidth: 320 }}>
      <span
        title={path ?? name}
        style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {name}
      </span>
      {status !== undefined && (
        <span
          role="status"
          style={{ fontSize: 12, whiteSpace: 'nowrap', color: status === 'error' ? 'var(--destructive)' : 'var(--muted-foreground)' }}
        >
          {STATUS_LABEL[status]}
        </span>
      )}
    </span>
  )
}

/** The commands of the « Fichier » menu, in groups (a rule between groups); only the ones the catalogue has. */
const FILE_MENU_GROUPS: readonly (readonly { command: string; icon: LucideIcon }[])[] = [
  [
    { command: 'file.new', icon: FilePlus },
    { command: 'file.open', icon: FolderOpen },
    { command: 'tree.newFolder', icon: FolderPlus },
  ],
  [
    { command: 'file.save', icon: Save },
    { command: 'file.rename', icon: PenLine },
    { command: 'file.duplicate', icon: Copy },
  ],
  [{ command: 'file.reveal', icon: FolderSearch }],
  [
    { command: 'file.close', icon: X },
    { command: 'file.delete', icon: Trash2 },
  ],
]

function presentFileMenuGroups() {
  return FILE_MENU_GROUPS.map(group => group.filter(entry => commandById(entry.command) !== undefined)).filter(group => group.length > 0)
}

/** The entries of the menu, groups separated by a rule. */
function FileMenuEntries({ groups }: { groups: ReturnType<typeof presentFileMenuGroups> }) {
  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={group[0].command}>
          {index > 0 && <DropdownMenuSeparator />}
          {group.map(entry => (
            <CommandDropdownItem key={entry.command} command={entry.command} icon={entry.icon} />
          ))}
        </Fragment>
      ))}
    </>
  )
}

/** « Fichier » menu: every action on the file itself, with its name and its shortcut. */
export function FileMenu({ groups = presentFileMenuGroups() }: { groups?: ReturnType<typeof presentFileMenuGroups> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Fichier
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <FileMenuEntries groups={groups} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A file menu is worth its button from three actions up (D02). */
const FILE_MENU_MIN_ACTIONS = 3

function standardItems(file: ToolbarFile | undefined): ToolbarItem[] {
  const has = (command: string) => commandById(command) !== undefined
  const items: ToolbarItem[] = []
  const add = (item: ToolbarItem | false) => {
    if (item) items.push(item)
  }
  const open = file?.open ?? false
  const slot = open ? 'file.close' : 'file.new'

  add(
    has(slot) && {
      id: 'file.newOrClose',
      zone: 'file',
      // « Fermer » is the one solid dark button of the bar, the same everywhere; « Nouveau » stays a ghost.
      node: <CommandButton command={slot} icon={open ? X : FilePlus} variant={open ? 'default' : 'ghost'} size="icon-sm" />,
      menu: <CommandDropdownItem command={slot} icon={open ? X : FilePlus} />,
    },
  )
  const groups = presentFileMenuGroups()
  add(
    groups.flat().length >= FILE_MENU_MIN_ACTIONS && {
      id: 'file.menu',
      zone: 'file',
      node: <FileMenu groups={groups} />,
      menu: <FileMenuEntries groups={groups} />,
    },
  )
  add(
    has('edit.undo') && {
      id: 'edit.undo',
      zone: 'edit',
      node: <CommandButton command="edit.undo" icon={Undo2} variant="ghost" size="icon-sm" />,
      menu: <CommandDropdownItem command="edit.undo" icon={Undo2} />,
    },
  )
  add(
    has('edit.redo') && {
      id: 'edit.redo',
      zone: 'edit',
      node: <CommandButton command="edit.redo" icon={Redo2} variant="ghost" size="icon-sm" />,
      menu: <CommandDropdownItem command="edit.redo" icon={Redo2} />,
    },
  )
  add(
    open &&
      file?.name !== undefined && {
        id: 'title',
        zone: 'title',
        node: <FileTitle name={file.name} path={file.path} status={file.status} />,
      },
  )
  add(
    has('view.zoomIn') && {
      id: 'view.zoom',
      zone: 'view',
      node: <ZoomControls />,
      menu: (
        <>
          <CommandDropdownItem command="view.zoomOut" icon={Minus} />
          <CommandDropdownItem command="view.zoomIn" icon={Plus} />
          <CommandDropdownItem command="view.zoomReset" />
        </>
      ),
      priority: 20,
    },
  )
  add(
    has('view.toggleDensity') && {
      id: 'view.density',
      zone: 'view',
      node: <DensityToggle />,
      menu: <CommandDropdownItem command="view.toggleDensity" icon={Rows3} />,
      priority: 20,
    },
  )
  add(
    has('app.palette') && {
      id: 'app.palette',
      zone: 'system',
      node: <CommandButton command="app.palette" icon={Search} variant="ghost" size="icon-sm" />,
      menu: <CommandDropdownItem command="app.palette" icon={Search} />,
    },
  )
  add(
    has('app.toggleTheme') && {
      id: 'app.toggleTheme',
      zone: 'system',
      node: <ThemeToggle label={commandById('app.toggleTheme')?.label} />,
      menu: <CommandDropdownItem command="app.toggleTheme" icon={Moon} />,
    },
  )
  add(
    has('app.settings') && {
      id: 'app.settings',
      zone: 'system',
      node: <CommandButton command="app.settings" icon={Settings} variant="ghost" size="icon-sm" />,
      menu: <CommandDropdownItem command="app.settings" icon={Settings} />,
    },
  )
  return items
}

/**
 * The top bar of every app: the suite's items (new/close, « Fichier », undo/redo, the file's title,
 * palette, theme, settings) and the app's own, in the fixed order of the zones, on an
 * `OverflowToolbar` so nothing ever overflows. An item the catalogue has no command for is not drawn.
 */
export function AppToolbar({
  toolbar,
  file,
  hidden: userHidden,
}: {
  toolbar?: ToolbarDefinition
  file?: ToolbarFile
  /** Ids the user turned off (« Boutons de la barre »); a locked item stays. They remain commands. */
  hidden?: ReadonlySet<string>
}): ReactNode {
  const hidden = new Set<string>(toolbar?.hide ?? [])
  const drawn = [...standardItems(file).filter(item => !hidden.has(item.id)), ...(toolbar?.items ?? [])]
  const items = arrangeToolbar(userHidden === undefined ? drawn : visibleToolbarItems(drawn, userHidden))
  return (
    <OverflowToolbar
      items={items.map(item => ({ id: item.id, node: item.node, menu: item.menu ?? null, priority: item.priority }))}
    />
  )
}

/** One row of the « Boutons de la barre » panel. */
export interface ToolbarEntry {
  id: string
  zone: ToolbarZone
  label: string
  /** The command of the same id, for its shortcut; `undefined` for an item that is not one. */
  command?: string
  icon?: LucideIcon
  locked: boolean
}

const STANDARD_LABELS: Record<string, string> = {
  'file.newOrClose': 'Nouveau / Fermer',
  'file.menu': 'Menu « Fichier »',
  'view.zoom': 'Zoom',
  'view.density': 'Densité',
}

const STANDARD_ICONS: Record<string, LucideIcon> = {
  'file.newOrClose': FilePlus,
  'edit.undo': Undo2,
  'edit.redo': Redo2,
  'view.zoom': Plus,
  'view.density': Rows3,
  'app.palette': Search,
  'app.toggleTheme': Moon,
  'app.settings': Settings,
}

/**
 * What the user can switch on the bar: the suite's items (the catalogue has their command) and the
 * app's, by zone order. The title is not one: it is the file's name, not a button.
 */
export function toolbarEntries(toolbar?: ToolbarDefinition): ToolbarEntry[] {
  const hidden = new Set<string>(toolbar?.hide ?? [])
  const items = [...standardItems(undefined).filter(item => !hidden.has(item.id)), ...(toolbar?.items ?? [])]
  return arrangeToolbar(items)
    .filter(item => item.id !== 'title')
    .map(item => {
      const command = commandById(item.id)
      return {
        id: item.id,
        zone: item.zone,
        label: item.label ?? STANDARD_LABELS[item.id] ?? command?.label ?? item.id,
        command: command === undefined ? undefined : item.id,
        icon: item.icon ?? STANDARD_ICONS[item.id],
        locked: isToolbarItemLocked(item.id),
      }
    })
}
