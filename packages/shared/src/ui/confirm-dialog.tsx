import type { ReactNode } from 'react'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  /** Le texte du bouton destructif. */
  confirmLabel?: string
  onConfirm: () => void
  /** « Annuler », Échap et un clic hors du dialogue. */
  onCancel: () => void
}

/** Demande confirmation avant une action qu'on ne peut pas défaire (suppression). */
export function ConfirmDialog({ open, title, description, confirmLabel = 'Supprimer', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
