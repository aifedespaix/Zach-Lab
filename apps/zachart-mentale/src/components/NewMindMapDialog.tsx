import { useState } from 'react'
import type { FileTreeNode, RootFolder } from '../types/workspace'
import { useWorkspaceStore, describeError } from '../state/useWorkspaceStore'
import { createMindMapFile } from '../persistence/fileOps'
import { mindMapExists } from '../persistence/fileStore'
import { sanitizeFileName, separatorOf, parentDirOf, mindMapFileNameFor } from '../persistence/paths'
import { NewFileDialog } from '@suite/shared/files'
import { FolderPicker, type FolderNode } from '@suite/shared/ui'

export interface FolderOption {
  path: string
  name: string
  /** Nesting level, only used to indent the option's label. */
  depth: number
  /** Every folder from the root down to this one — what has to be expanded for it to be visible. */
  trail: string[]
}

function folderDisplayName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

/**
 * Every folder of the workspace, flattened depth-first so a `<select>` can
 * offer them in tree order. The header has no folder under the cursor the way
 * a sidebar row does, so the destination has to be an explicit choice.
 */
export function folderOptions(rootFolders: RootFolder[]): FolderOption[] {
  const options: FolderOption[] = []

  function walk(nodes: FileTreeNode[], depth: number, trail: string[]): void {
    for (const node of nodes) {
      if (node.type !== 'folder') continue
      const nodeTrail = [...trail, node.path]
      options.push({ path: node.path, name: node.name, depth, trail: nodeTrail })
      walk(node.children, depth + 1, nodeTrail)
    }
  }

  for (const root of rootFolders) {
    options.push({ path: root.path, name: folderDisplayName(root.path), depth: 0, trail: [root.path] })
    walk(root.tree, 1, [root.path])
  }
  return options
}

/** The workspace's folders as the picker's tree (files left out). */
export function folderNodes(rootFolders: RootFolder[]): FolderNode[] {
  const walk = (nodes: FileTreeNode[]): FolderNode[] =>
    nodes.flatMap(node => (node.type === 'folder' ? [{ value: node.path, name: node.name, children: walk(node.children) }] : []))
  return rootFolders.map(root => ({ value: root.path, name: folderDisplayName(root.path), children: walk(root.tree) }))
}

interface NewMindMapDialogProps {
  onClose: () => void
  /** Opened through the app's normal file-switch path, so the guard still runs. */
  onCreated: (path: string) => void
}

/**
 * "Nouvelle carte mentale" from the header: pick a folder, name the map, get it
 * created and opened. The sidebar offers the same thing per folder row; this is
 * the version reachable when the sidebar is collapsed, or when the folder you
 * want is buried a few levels down.
 */
export function NewMindMapDialog({ onClose, onCreated }: NewMindMapDialogProps) {
  const rootFolders = useWorkspaceStore(s => s.rootFolders)
  const currentFilePath = useWorkspaceStore(s => s.currentFilePath)
  const refreshFolder = useWorkspaceStore(s => s.refreshFolder)
  const expandPaths = useWorkspaceStore(s => s.expandPaths)

  // Computed once, on mount: the dialog is mounted fresh each time it opens,
  // and recomputing on every keystroke would fight the user's own selection.
  const [options] = useState(() => folderOptions(rootFolders))
  const [folders] = useState(() => folderNodes(rootFolders))
  const [folder, setFolder] = useState(() => {
    const beside = currentFilePath === null ? null : parentDirOf(currentFilePath)
    // The folder of the open map is where the next one most likely belongs —
    // but only if it is actually one of the workspace's folders.
    if (beside !== null && options.some(option => option.path === beside)) return beside
    return options[0]?.path ?? ''
  })

  async function handleCreate(name: string) {
    const fileName = mindMapFileNameFor(name)
    // `createMindMapFile` writes unconditionally, so an existing map of the
    // same name would be replaced by an empty one. Refused here instead: the
    // header offers no undo, and a chapter overwritten by « Nouveau chapitre »
    // is not something the user could get back.
    if (await mindMapExists(`${folder}${separatorOf(folder)}${fileName}`)) {
      throw new Error(`« ${fileName} » existe déjà dans ce dossier. Choisissez un autre nom.`)
    }
    let path: string
    try {
      path = await createMindMapFile(folder, name)
    } catch (caught) {
      // Kept open on failure: a read-only folder or an illegal name is
      // something the user can still fix from this same dialog.
      throw new Error(`Impossible de créer la carte mentale « ${sanitizeFileName(name)} » : ${describeError(caught)}`)
    }
    await refreshFolder(folder)
    // So the new map is visible in the tree, not just on the canvas: it may
    // well have landed inside folders the user has never expanded.
    expandPaths(options.find(option => option.path === folder)?.trail ?? [folder])
    onCreated(path)
    onClose()
  }

  return (
    <NewFileDialog
      open
      title="Nouvelle carte mentale"
      description={options.length === 0 ? 'Aucun dossier configuré. Ajoutez d’abord un dossier depuis la barre latérale.' : undefined}
      nameLabel="Nom de la nouvelle carte mentale"
      namePlaceholder="Chapitre 1"
      canCreate={folder !== ''}
      onCreate={handleCreate}
      onCancel={onClose}
    >
      {options.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontWeight: 500 }}>Dossier</span>
          <FolderPicker
            ariaLabel="Dossier de destination"
            folders={folders}
            value={folder}
            onChange={setFolder}
            placeholder="Taper pour filtrer les dossiers…"
          />
        </label>
      )}
    </NewFileDialog>
  )
}
