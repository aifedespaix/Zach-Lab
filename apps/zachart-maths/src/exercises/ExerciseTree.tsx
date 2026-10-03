import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, FilePlus, FileText, FileWarning, FolderPlus } from 'lucide-react'
import {
  Button, ConfirmDialog, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@suite/shared/ui'
import { splitPath } from './names'
import { useExerciseStore } from './useExerciseStore'

/** Ce que l'élève est en train de nommer : un champ de saisie apparaît à l'endroit concerné. */
type Naming =
  | { kind: 'new-chapter' }
  | { kind: 'rename-chapter'; chapter: string }
  | { kind: 'new-exercise'; chapter: string }
  | { kind: 'rename-exercise'; path: string }

type Deletion = { kind: 'chapter'; chapter: string; count: number } | { kind: 'exercise'; path: string; titre: string; count: number }

const DRAG_TYPE = 'application/x-zachart-exercise'

function NameField({ initial = '', label, onSubmit, onCancel }: {
  initial?: string
  label: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.select(), [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(value)
  }
  return (
    <form onSubmit={submit} style={{ padding: '2px 8px' }}>
      <input
        ref={ref}
        aria-label={label}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={onCancel}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        className="w-full rounded border bg-background px-2 py-1 text-sm"
      />
    </form>
  )
}

/** La sidebar gauche : chapitres (dossiers) et exercices (fichiers JSON) de l'élève. */
export function ExerciseTree() {
  const { tree, loaded, selected, error } = useExerciseStore()
  const store = useExerciseStore.getState()
  const [naming, setNaming] = useState<Naming | null>(null)
  const [deletion, setDeletion] = useState<Deletion | null>(null)
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const toggle = (chapter: string) =>
    setFolded(prev => {
      const next = new Set(prev)
      if (!next.delete(chapter)) next.add(chapter)
      return next
    })

  const finishNaming = (value: string) => {
    const current = naming
    setNaming(null)
    if (current === null) return
    switch (current.kind) {
      case 'new-chapter': return void store.addChapter(value)
      case 'rename-chapter': return void store.renameChapter(current.chapter, value)
      case 'new-exercise': return void store.addExercise(current.chapter, value)
      case 'rename-exercise': return void store.renameExercise(current.path, value)
    }
  }

  const confirmDeletion = () => {
    const current = deletion
    setDeletion(null)
    if (current === null) return
    void (current.kind === 'chapter' ? store.removeChapter(current.chapter) : store.removeExercise(current.path))
  }

  if (!loaded) return <p style={{ padding: 12, fontSize: 13 }}>Chargement des exercices…</p>

  return (
    <nav aria-label="Exercices" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
        <strong style={{ fontSize: 13 }}>Mes exercices</strong>
        <Button variant="ghost" size="icon-sm" aria-label="Nouveau chapitre" onClick={() => setNaming({ kind: 'new-chapter' })}>
          <FolderPlus />
        </Button>
      </div>

      {error !== null && (
        <div role="alert" style={{ margin: '0 8px', padding: 8, fontSize: 12, border: '1px solid var(--destructive)', borderRadius: 6 }}>
          {error}{' '}
          <button type="button" onClick={store.dismissError} style={{ textDecoration: 'underline' }}>Fermer</button>
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
        {naming?.kind === 'new-chapter' && (
          <NameField label="Nom du nouveau chapitre" onSubmit={finishNaming} onCancel={() => setNaming(null)} />
        )}
        {tree.length === 0 && naming === null && (
          <p style={{ padding: '4px 12px', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Aucun chapitre. Crée-en un avec le bouton ci-dessus.
          </p>
        )}

        {tree.map((chapter, ci) => {
          const open = !folded.has(chapter.name)
          return (
            <div key={chapter.name}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    onDragOver={e => {
                      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
                      e.preventDefault()
                      setDropTarget(chapter.name)
                    }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={e => {
                      const path = e.dataTransfer.getData(DRAG_TYPE)
                      setDropTarget(null)
                      if (path !== '') void store.moveExercise(path, chapter.name)
                    }}
                    style={{ outline: dropTarget === chapter.name ? '2px solid var(--ring)' : undefined }}
                  >
                    {naming?.kind === 'rename-chapter' && naming.chapter === chapter.name ? (
                      <NameField
                        initial={chapter.name}
                        label={`Nouveau nom du chapitre ${chapter.name}`}
                        onSubmit={finishNaming}
                        onCancel={() => setNaming(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggle(chapter.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '4px 8px', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {chapter.name}
                      </button>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => { setFolded(p => { const n = new Set(p); n.delete(chapter.name); return n }); setNaming({ kind: 'new-exercise', chapter: chapter.name }) }}>
                    <FilePlus /> Nouvel exercice
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => setNaming({ kind: 'rename-chapter', chapter: chapter.name })}>Renommer</ContextMenuItem>
                  <ContextMenuItem disabled={ci === 0} onSelect={() => void store.moveChapter(chapter.name, -1)}>Monter</ContextMenuItem>
                  <ContextMenuItem disabled={ci === tree.length - 1} onSelect={() => void store.moveChapter(chapter.name, 1)}>Descendre</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onSelect={() => setDeletion({ kind: 'chapter', chapter: chapter.name, count: chapter.exercises.length })}>
                    Supprimer
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              {open && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {naming?.kind === 'new-exercise' && naming.chapter === chapter.name && (
                    <li style={{ paddingLeft: 16 }}>
                      <NameField label="Titre du nouvel exercice" onSubmit={finishNaming} onCancel={() => setNaming(null)} />
                    </li>
                  )}
                  {chapter.exercises.map((exo, ei) => (
                    <li key={exo.path}>
                      {naming?.kind === 'rename-exercise' && naming.path === exo.path ? (
                        <div style={{ paddingLeft: 16 }}>
                          <NameField initial={exo.titre} label={`Nouveau titre de ${exo.titre}`} onSubmit={finishNaming} onCancel={() => setNaming(null)} />
                        </div>
                      ) : (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <button
                              type="button"
                              draggable
                              onDragStart={e => e.dataTransfer.setData(DRAG_TYPE, exo.path)}
                              aria-current={selected === exo.path ? 'true' : undefined}
                             
                              onClick={() => !exo.corrompu && store.select(exo.path)}
                              title={exo.corrompu ? 'Fichier illisible : il peut être supprimé ou déplacé, pas ouvert.' : undefined}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '4px 8px 4px 24px',
                                fontSize: 13, textAlign: 'left',
                                background: selected === exo.path ? 'var(--accent)' : undefined,
                                color: exo.corrompu ? 'var(--destructive)' : undefined,
                              }}
                            >
                              {exo.corrompu ? <FileWarning size={14} /> : <FileText size={14} />}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exo.titre}</span>
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem disabled={exo.corrompu} onSelect={() => setNaming({ kind: 'rename-exercise', path: exo.path })}>Renommer</ContextMenuItem>
                            <ContextMenuItem disabled={ei === 0} onSelect={() => void store.shiftExercise(exo.path, -1)}>Monter</ContextMenuItem>
                            <ContextMenuItem disabled={ei === chapter.exercises.length - 1} onSelect={() => void store.shiftExercise(exo.path, 1)}>Descendre</ContextMenuItem>
                            {tree.length > 1 && (
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>Déplacer vers</ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                  {tree.filter(c => c.name !== splitPath(exo.path)[0]).map(c => (
                                    <ContextMenuItem key={c.name} onSelect={() => void store.moveExercise(exo.path, c.name)}>{c.name}</ContextMenuItem>
                                  ))}
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                            )}
                            <ContextMenuSeparator />
                            <ContextMenuItem variant="destructive" onSelect={() => setDeletion({ kind: 'exercise', path: exo.path, titre: exo.titre, count: exo.exercices })}>Supprimer</ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={deletion !== null}
        title={deletion?.kind === 'chapter' ? 'Supprimer ce chapitre ?' : 'Supprimer ce fichier ?'}
        description={
          deletion === null ? '' : `${
            deletion.kind === 'chapter'
              ? `« ${deletion.chapter} » et ses ${deletion.count} fichier(s) seront effacés du disque.`
              : `« ${deletion.titre} »${deletion.count > 0 ? ` et ses ${deletion.count} exercice(s)` : ''} seront effacés du disque.`
          } Cette action est définitive.`
        }
        onCancel={() => setDeletion(null)}
        onConfirm={confirmDeletion}
      />
    </nav>
  )
}
