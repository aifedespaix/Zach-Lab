import { AlertTriangle } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui'

export interface SaveFailedDialogProps {
  /** e.g. « La sauvegarde a échoué : disque plein ». */
  message: string
  /** Replaces the default explanation, for a failure that risks no change. */
  detail?: string
  /** What continuing does (« Ouvrir quand même »); `null` = nothing to continue to, a single way out. */
  continueLabel: string | null
  onCancel: () => void
  onContinue: (() => void) | null
}

/**
 * Shown when an action that would leave a change behind cannot go ahead cleanly (a flush failing
 * before switching or closing a file). The normal path never shows it: it turns a failure into a
 * decision instead of silence.
 */
export function SaveFailedDialog({ message, detail, continueLabel, onCancel, onContinue }: SaveFailedDialogProps) {
  const canContinue = continueLabel !== null && onContinue !== null
  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent role="alertdialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, color: 'var(--warning-fg)' }} />
            {message}
          </DialogTitle>
          <DialogDescription>{detail ?? 'Continuer maintenant perdra ce changement. Vous pouvez aussi annuler et réessayer.'}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant={canContinue ? 'outline' : 'default'} onClick={onCancel}>
            {canContinue ? 'Annuler' : 'Fermer ce message'}
          </Button>
          {canContinue && (
            <Button variant="destructive" onClick={onContinue}>
              {continueLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
