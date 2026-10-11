import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui'

export interface NewFileDialogProps {
  open: boolean
  title: string
  /** Une phrase qui dit ce que la création fait ; facultative. */
  description?: string
  /** Le libellé du champ nom, dit par l'app (« Nom de la fiche », « Nom de la carte »…). */
  nameLabel: string
  namePlaceholder?: string
  /** Champs propres à l'app (dossier, chapitre…), posés sous le nom. Leur état reste à l'app. */
  children?: ReactNode
  /** Le nom est-il assez complet pour créer (en plus du nom non vide, vérifié ici) ? */
  canCreate?: boolean
  createLabel?: string
  /**
   * Crée le fichier avec le nom saisi. Une erreur reste affichée sur place : la fenêtre ne se
   * ferme pas, l'utilisateur peut corriger. Quand elle réussit, l'app ferme le dialogue.
   */
  onCreate: (name: string) => Promise<void>
  onCancel: () => void
}

/**
 * La fenêtre « Nouveau fichier » : un nom, les champs de l'app, puis Créer / Annuler.
 * Le formulaire est neuf à chaque ouverture ; Entrée crée ; l'action ne part pas deux fois.
 */
export function NewFileDialog({
  open,
  title,
  description,
  nameLabel,
  namePlaceholder,
  children,
  canCreate = true,
  createLabel = 'Créer',
  onCreate,
  onCancel,
}: NewFileDialogProps) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // À chaque ouverture : un formulaire neuf, aucune erreur de la fois précédente.
  useEffect(() => {
    if (!open) return
    setName('')
    setError(null)
  }, [open])

  const valid = name.trim() !== '' && canCreate && !creating

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!valid) return
    setCreating(true)
    setError(null)
    try {
      await onCreate(name.trim())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !creating) onCancel() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" onOpenAutoFocus={event => { event.preventDefault(); nameRef.current?.focus() }}>
        <form onSubmit={submit} style={{ display: 'contents' }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
            {nameLabel}
            <input
              ref={nameRef}
              aria-label={nameLabel}
              placeholder={namePlaceholder}
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm font-normal"
            />
          </label>
          {children}
          {error && (
            <p role="alert" style={{ margin: 0, color: 'var(--warning-fg)' }}>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={creating}>Annuler</Button>
            <Button type="submit" disabled={!valid}>{creating ? 'Création…' : createLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
