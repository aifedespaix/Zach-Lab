import { FileJson, Folder } from 'lucide-react'
import { TreeDragGhost as SharedTreeDragGhost } from '@suite/shared/tree'
import { lastSegment } from './treeFilter'

/**
 * What follows the cursor during a sidebar drag: the shared ghost, with this app's wording and
 * icons. The second line says where the row would land — the destination folder's name — or a
 * plain refusal when the pointer is not over a valid one.
 */
export function TreeDragGhost() {
  return (
    <SharedTreeDragGhost
      describeTarget={targetPath => `Déplacer dans « ${lastSegment(targetPath)} »`}
      refusal="Déposer sur un dossier"
      icon={kind => (kind === 'folder' ? <Folder size={14} /> : <FileJson size={14} />)}
    />
  )
}
