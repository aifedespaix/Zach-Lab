import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, CopyPlus, FilePlus, FileText, FileWarning, FolderPlus, PanelLeftClose,
} from 'lucide-react'
import { runCommand, useCommand } from '@suite/shared/commands'
import { PanelSearch } from '@suite/shared/shell'
import { beginTreeDrag, consumeSwallowedClick, TreeDragGhost, useTreeDragStore } from '@suite/shared/tree'
import {
  ConfirmDialog, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@suite/shared/ui'
import { splitPath } from './names'
import { filterChapters } from './treeSearch'
import { useExerciseStore } from './useExerciseStore'

/** Ce que l'élève est en train de nommer : un champ de saisie apparaît à l'endroit concerné. */
type Naming =
  | { kind: 'new-chapter' }
  | { kind: 'rename-chapter'; chapter: string }
  | { kind: 'new-exercise'; chapter: string }
  | { kind: 'rename-exercise'; path: string }

type Deletion = { kind: 'chapter'; chapter: string; count: number } | { kind: 'exercise'; path: string; titre: string; count: number }

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
  const [search, setSearch] = useState('')
  // La cible de dépôt vient du moteur partagé : une ligne ne s'abonne qu'à ce qui la concerne.
  const dropTarget = useTreeDragStore(s => s.targetPath)
  const dragging = useTreeDragStore(s => s.source?.path ?? null)
  // Les poignées du moteur sont fixées à l'appui et vivent tout le geste : elles lisent l'état
  // replié du moment, pas celui du rendu qui les a créées.
  const foldedRef = useRef(folded)
  foldedRef.current = folded

  const startDrag = (e: React.PointerEvent<HTMLElement>, exo: { path: string; titre: string }) =>
    beginTreeDrag(e, { path: exo.path, name: exo.titre, kind: 'file' }, {
      // Un fichier ne se dépose que sur un AUTRE chapitre.
      canDrop: (source, target) => target !== splitPath(source.path)[0],
      isExpanded: target => !foldedRef.current.has(target),
      expand: target => setFolded(prev => { const next = new Set(prev); next.delete(target); return next }),
      onDrop: (source, target) => void useExerciseStore.getState().moveExercise(source.path, target),
    })

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

  useCommand('tree.newChapter', () => setNaming({ kind: 'new-chapter' }))
  useCommand('tree.toggleAll', () =>
    setFolded(prev => {
      // Seuls les chapitres qui existent comptent : `folded` garde les noms d'anciens chapitres.
      const allFolded = tree.length > 0 && tree.every(c => prev.has(c.name))
      return allFolded ? new Set() : new Set(tree.map(c => c.name))
    }),
  )

  const view = useMemo(() => filterChapters(tree, search), [tree, search])

  if (!loaded) return <p style={{ padding: 12, fontSize: 13 }}>Chargement des exercices…</p>

  return (
    <nav aria-label="Exercices" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '8px 12px' }}>
        <strong style={{ fontSize: 13 }}>Mes exercices</strong>
      </div>
      <div style={{ padding: '0 12px 8px' }}>
        <PanelSearch value={search} onChange={setSearch} ariaLabel="Rechercher un exercice" placeholder="Rechercher un exercice…" />
      </div>

      {error !== null && (
        <div role="alert" style={{ margin: '0 8px', padding: 8, fontSize: 12, border: '1px solid var(--destructive)', borderRadius: 6 }}>
          {error}{' '}
          <button type="button" onClick={store.dismissError} style={{ textDecoration: 'underline' }}>Fermer</button>
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div data-testid="arbre-vide" style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
        {naming?.kind === 'new-chapter' && (
          <NameField label="Nom du nouveau chapitre" onSubmit={finishNaming} onCancel={() => setNaming(null)} />
        )}
        {tree.length === 0 && naming === null && (
          <p style={{ padding: '4px 12px', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Aucun chapitre. Crée-en un avec le bouton en bas du panneau.
          </p>
        )}

        {search.trim() !== '' && view.chapters.length === 0 && (
          <p role="status" style={{ padding: '4px 12px', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Aucun résultat pour « {search.trim()} ».
          </p>
        )}

        {view.chapters.map((chapter, ci) => {
          const open = view.forcedOpen.has(chapter.name) || !folded.has(chapter.name)
          return (
            <div key={chapter.name} data-drop-folder={chapter.name}>
              <ContextMenu>
                <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>
                  <div
                    data-tree-row={chapter.name}
                    data-tree-kind="folder"
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
                  <ContextMenuItem onSelect={() => toggle(chapter.name)}>{open ? 'Replier' : 'Déplier'}</ContextMenuItem>
                  <ContextMenuSeparator />
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
                          <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>
                            <button
                              type="button"
                              data-tree-row={exo.path}
                              data-tree-kind="file"
                              onPointerDown={e => startDrag(e, exo)}
                              aria-current={selected === exo.path ? 'true' : undefined}
                              onClick={() => {
                                // Le clic qui suit la fin d'un vrai glisser n'ouvre pas le fichier : il vient de bouger.
                                if (consumeSwallowedClick()) return
                                if (!exo.corrompu) store.select(exo.path)
                              }}
                              title={exo.corrompu ? 'Fichier illisible : il peut être supprimé ou déplacé, pas ouvert.' : undefined}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '4px 8px 4px 24px',
                                fontSize: 13, textAlign: 'left',
                                background: selected === exo.path ? 'var(--accent)' : undefined,
                                color: exo.corrompu ? 'var(--destructive)' : undefined,
                                opacity: dragging === exo.path ? 0.5 : undefined,
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
                            <ContextMenuItem disabled={exo.corrompu} onSelect={() => void store.duplicateExercise(exo.path)}><CopyPlus /> Dupliquer</ContextMenuItem>
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
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setNaming({ kind: 'new-chapter' })}><FolderPlus /> Nouveau chapitre</ContextMenuItem>
          <ContextMenuItem disabled={tree.length === 0} onSelect={() => setFolded(new Set(tree.map(c => c.name)))}>
            <ChevronsDownUp /> Tout replier
          </ContextMenuItem>
          <ContextMenuItem disabled={folded.size === 0} onSelect={() => setFolded(new Set())}><ChevronsUpDown /> Tout déplier</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void runCommand('view.toggleTree')}><PanelLeftClose /> Ranger le panneau</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <TreeDragGhost
        describeTarget={chapter => `Déplacer dans « ${chapter} »`}
        refusal="Déposer sur un chapitre"
        icon={() => <FileText size={14} />}
      />

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
