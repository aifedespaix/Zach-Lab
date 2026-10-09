import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui'
import type { OpenFailure } from './useFileSession'

/**
 * A file that did not open: gone, unreadable, or not shaped like a document. The previous file is
 * still the open one. `onRepair` (the port's `repair`, the app writes the copy) is offered for an
 * invalid file only.
 */
export function UnreadableFileDialog({ failure, onClose, onRepair }: { failure: OpenFailure; onClose: () => void; onRepair?: () => void }) {
  const name = failure.path.split(/[\\/]/).pop() ?? failure.path
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent role="alertdialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{`Impossible d’ouvrir ${name}`}</DialogTitle>
          <DialogDescription>{failure.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant={onRepair !== undefined && failure.kind === 'invalid' ? 'outline' : 'default'} onClick={onClose}>
            Fermer
          </Button>
          {onRepair !== undefined && failure.kind === 'invalid' && <Button onClick={onRepair}>Réparer une copie</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
