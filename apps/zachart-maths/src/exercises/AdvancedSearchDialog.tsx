import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FileText, ListChecks, Search } from 'lucide-react'
import { create } from 'zustand'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@suite/shared/ui'
import { loadSearchEntries, queryWords, searchEntries, fold, type SearchEntry, type SearchScope } from './librarySearch'
import { useExerciseStore } from './useExerciseStore'
import { goToExercise } from './useOpenExercise'

interface AdvancedSearchStore {
  open: boolean
  setOpen(open: boolean): void
}

/** La fenêtre de recherche avancée est-elle ouverte ? Le bouton du panneau et la commande la pilotent. */
export const useAdvancedSearch = create<AdvancedSearchStore>(set => ({ open: false, setOpen: open => set({ open }) }))

const SCOPES: readonly { value: SearchScope; label: string }[] = [
  { value: 'tout', label: 'Tout' },
  { value: 'exercice', label: 'Exercices' },
  { value: 'fiche', label: 'Fiches' },
]

/** Surligne les mots cherchés dans un extrait (accents et casse ignorés). */
function highlight(text: string, words: string[]): ReactNode {
  if (words.length === 0) return text
  const folded = fold(text)
  const parts: ReactNode[] = []
  let at = 0
  while (at < text.length) {
    let best = -1
    let length = 0
    for (const w of words) {
      const i = folded.indexOf(w, at)
      if (i >= 0 && (best < 0 || i < best)) { best = i; length = w.length }
    }
    if (best < 0) break
    parts.push(text.slice(at, best), <mark key={best} style={{ background: 'color-mix(in oklab, var(--primary) 30%, transparent)', color: 'inherit', borderRadius: 2 }}>{text.slice(best, best + length)}</mark>)
    at = best + length
  }
  parts.push(text.slice(at))
  return parts
}

/** Recherche avancée : un mot-clé, dans tous les exercices et toutes les fiches, énoncés, réponses, notes et travail compris. */
export function AdvancedSearchDialog() {
  const open = useAdvancedSearch(s => s.open)
  const setOpen = useAdvancedSearch(s => s.setOpen)
  const fs = useExerciseStore(s => s.fs)
  const [entries, setEntries] = useState<SearchEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('tout')
  const [chapter, setChapter] = useState('')
  const [active, setActive] = useState(0)

  // La bibliothèque est relue à chaque ouverture : ce qu'on vient d'écrire doit être trouvable.
  useEffect(() => {
    if (!open || fs === null) return
    let current = true
    setEntries(null)
    void loadSearchEntries(fs).then(loaded => { if (current) setEntries(loaded) }).catch(() => { if (current) setEntries([]) })
    return () => { current = false }
  }, [open, fs])

  const chapters = useMemo(() => [...new Set((entries ?? []).map(e => e.chapter))], [entries])
  const results = useMemo(() => (entries === null ? [] : searchEntries(entries, query, scope, chapter)), [entries, query, scope, chapter])
  const words = useMemo(() => queryWords(query), [query])
  useEffect(() => setActive(0), [results])

  const choose = (entry: SearchEntry) => {
    setOpen(false)
    if (entry.exerciseId !== undefined) goToExercise(entry.path, entry.exerciseId)
    else useExerciseStore.getState().select(entry.path)
  }

  const typed = query.trim() !== ''
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl" style={{ gridTemplateRows: 'auto auto auto minmax(0, 1fr)', maxHeight: '85vh' }}>
        <DialogHeader>
          <DialogTitle>Recherche avancée</DialogTitle>
          <DialogDescription>Cherche un mot dans tous tes exercices et toutes tes fiches : énoncés, réponses, notes et travail.</DialogDescription>
        </DialogHeader>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
          <input
            autoFocus
            type="text"
            aria-label="Mots à chercher"
            placeholder="Théorème, fraction, 3x + 2, p.45…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown' && results.length > 0) { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && results[active] !== undefined) { e.preventDefault(); choose(results[active].entry) }
            }}
            className="w-full rounded-md border bg-background py-2 pr-3 pl-9 text-sm"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
          <div role="group" aria-label="Chercher dans" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {SCOPES.map(s => (
              <button
                key={s.value}
                type="button"
                aria-pressed={scope === s.value}
                onClick={() => setScope(s.value)}
                className="px-2.5 py-1 hover:bg-accent aria-pressed:bg-secondary aria-pressed:font-semibold"
              >
                {s.label}
              </button>
            ))}
          </div>
          <select aria-label="Chapitre" value={chapter} onChange={e => setChapter(e.target.value)} className="rounded border bg-background px-2 py-1 text-sm">
            <option value="">Tous les chapitres</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {typed && entries !== null && (
            <span role="status" style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }}>
              {results.length === 0 ? 'Aucun résultat' : `${results.length} résultat${results.length > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div role="region" aria-label="Résultats" style={{ minHeight: 120, overflowY: 'auto' }}>
          {entries === null ? (
            <p style={{ fontSize: 13 }}>Chargement…</p>
          ) : !typed ? (
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Tape un ou plusieurs mots : les fautes de frappe et les pluriels sont tolérés.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map(({ entry, where, snippet }, i) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    data-active={i === active ? 'true' : undefined}
                    onClick={() => choose(entry)}
                    onMouseMove={() => setActive(i)}
                    className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-sm hover:bg-accent data-[active=true]:bg-accent"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {entry.kind === 'fiche' ? <FileText size={14} aria-label="Fiche" /> : <ListChecks size={14} aria-label="Exercice" />}
                      {entry.label !== undefined && <strong>{entry.label}</strong>}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: entry.kind === 'fiche' ? 600 : undefined }}>
                        {highlight(entry.title, words)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{entry.chapter} · {entry.sheetTitle}</span>
                    </span>
                    {snippet !== '' && snippet !== entry.title && (
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingLeft: 20 }}>
                        <em style={{ fontStyle: 'normal', fontWeight: 600 }}>{where} : </em>{highlight(snippet, words)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
