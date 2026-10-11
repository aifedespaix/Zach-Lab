import { AlertTriangle } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui'

export interface UnreadableFileDialogProps {
  /**
   * La phrase sur laquelle l'utilisateur décide. L'app la fournit : c'est le texte
   * qu'elle veut figer par un test, pas une règle du commun.
   */
  message: string
  /** Le fichier qui n'a pas passé la validation, nommé pour qu'on sache de quoi il s'agit. */
  fileName: string
  /** Où ira la copie réparée, nommée d'avance : rien n'est écrasé. */
  repairedFileName: string
  /** Les problèmes, déjà résumés en phrases par l'app (une par ligne). */
  issueLines: readonly string[]
  /** Vrai pendant l'écriture de la copie : l'action ne peut pas partir deux fois. */
  repairing: boolean
  /** Un échec de réparation, affiché sur place plutôt que de fermer le dialogue. */
  error: string | null
  /** Ce que fait la réparation, en une phrase de plus (« les cartes valides gardent leur place… »). */
  repairDetail?: string
  repairLabel?: string
  onCancel: () => void
  onRepair: () => void
}

/**
 * Un fichier ouvert mais invalide : on propose d'en écrire une copie réparée, l'original reste intact.
 * Même gabarit que la modale de Mentale « carte corrompue » ; c'est l'app qui apporte le texte exact.
 */
export function UnreadableFileDialog({
  message,
  fileName,
  repairedFileName,
  issueLines,
  repairing,
  error,
  repairDetail,
  repairLabel = 'Créer une copie réparée',
  onCancel,
  onRepair,
}: UnreadableFileDialogProps) {
  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{message}</DialogTitle>
          <DialogDescription>
            <span style={{ display: 'block' }}>
              Fichier concerné : <strong>{fileName}</strong>
            </span>
            <span style={{ display: 'block', marginTop: 8 }}>
              L’original ne sera pas modifié. La réparation écrit une copie nommée{' '}
              <strong>{repairedFileName}</strong>
              {repairDetail ? ` : ${repairDetail}` : ''}.
            </span>
          </DialogDescription>
        </DialogHeader>

        {issueLines.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--muted-foreground)' }}>
            {issueLines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {error && (
          <p
            role="alert"
            style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: 0, fontSize: 13, color: 'var(--warning-fg)' }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={repairing}>
            Annuler
          </Button>
          {/* Focus visible sur l'action (et non sur « Annuler », par défaut de Radix) : Entrée déclenche ce qu'on voit. */}
          <Button autoFocus onClick={onRepair} disabled={repairing}>
            {repairing ? 'Réparation…' : repairLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
