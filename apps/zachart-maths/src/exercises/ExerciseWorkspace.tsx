import { spacing, useCompact } from './useCompact'
import { useEffect, useRef, useState } from 'react'
import { useCommand } from '@suite/shared/commands'
import { Check, ChevronLeft, ListChecks, RotateCcw, ChevronRight, Columns2, Plus, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog } from '@suite/shared/ui'
import { RecentFilesList } from '@suite/shared/shell'
import { ToCorrectBadge, ToReviewBadge } from './ToCorrectBadge'
import { CorrectionStatsBar } from './CorrectionStatsBar'
import { toggleCorrected, toggleRate } from './correction'
import { jumpToNextToCorrect } from './jumpToCorrect'
import { AnimatedLogo } from '../AnimatedLogo'
import { BlockStack } from './BlockStack'
import { FieldContextMenu } from './FieldContextMenu'
import { HighlightedTextarea, UnitHuesContext } from './HighlightedTextarea'
import { insertAtCursor, isTextField, type TextField } from './insertAtCursor'
import { isMathField, type MathfieldElement } from '../math/mathFieldElement'
import { splitPath } from './names'
import { isBlank } from './sheet'
import { Toolbar, type InsertTarget } from './Toolbar'
import type { SymbolEntry } from './toolbarCatalog'
import { useExerciseStore } from './useExerciseStore'
import { useOpenExercise } from './useOpenExercise'
import { SymbolInsertContext } from './symbolInsert'
import { assignExerciseHues } from './unitColors'
import { isSplit, mergeZones, sendBlock, splitZones, type Zone } from './zones'

const STATUS_TEXT = {
  saved: 'Enregistré',
  dirty: 'Modifications en attente…',
  saving: 'Enregistrement…',
  failed: "L'enregistrement a échoué : tes dernières modifications ne sont pas sur le disque.",
} as const

const GREEN = '#22c55e'
const ORANGE = '#f97316'

const field = 'rounded border bg-background px-2 py-1 text-sm'

/** La zone centrale : l'exercice ouvert, de son titre jusqu'à la réponse finale. */
export function ExerciseWorkspace() {
  const compact = useCompact(state => state.enabled)
  const { exercise, sheet, status } = useOpenExercise()
  const edit = useOpenExercise(s => s.edit)
  const editTitle = useOpenExercise(s => s.editTitle)
  const selected = useExerciseStore(s => s.selected)
  const recent = useExerciseStore(s => s.recent)
  const tree = useExerciseStore(s => s.tree)
  const lastField = useRef<TextField | MathfieldElement | null>(null)
  const [target, setTarget] = useState<InsertTarget>('none')
  const currentId = useOpenExercise(s => s.currentId)
  const [confirming, setConfirming] = useState(false)
  const enonce = useRef<HTMLTextAreaElement>(null)
  /** Vrai quand une action vient de créer un exercice : le curseur va dans son énoncé, qu'on remplit d'abord. */
  const focusEnonce = useRef(false)
  /** Le bloc qui vient de passer dans l'autre zone, et la zone où il est arrivé. */
  const [arrived, setArrived] = useState<{ zone: Zone; id: string } | null>(null)

  // Le dernier champ où l'élève a écrit reçoit les signes de la barre, même si le focus est
  // passé sur un bouton (clavier) depuis.
  const rememberField = (e: React.FocusEvent) => {
    // MathLive vit dans un shadow DOM : l'évènement y est ramené à l'élément `math-field`.
    if (isMathField(e.target)) {
      lastField.current = e.target
      setTarget('math')
    } else if (isTextField(e.target)) {
      lastField.current = e.target
      setTarget(e.target.dataset.mathRaw !== undefined ? 'raw' : 'text')
    }
  }
  const insertSymbol = (symbol: SymbolEntry) => {
    const field = lastField.current
    if (!field?.isConnected) return
    if (isMathField(field)) {
      if (typeof field.insert === 'function') field.insert(symbol.latex, { focus: true })
      else field.value += symbol.latex.replace(/#[0?]/g, '')
      // `insert` ne déclenche pas toujours `input` : le champ le dit lui-même, pour que
      // l'état de l'étape suive.
      field.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    insertAtCursor(field, field.dataset.mathRaw !== undefined ? (symbol.plain ?? symbol.latex.replace(/#[0?]/g, '')) : symbol.glyph)
    field.focus()
  }
  useCommand('correction.next', () => { jumpToNextToCorrect() })

  // Un autre exercice, d'autres champs : l'ancien champ ne doit plus recevoir de signes, et le
  // « bloc arrivé » de l'ancien n'a plus de sens.
  useEffect(() => {
    lastField.current = null
    setTarget('none')
    setArrived(null)
  }, [selected, currentId])

  // Un exercice vient d'être créé : le curseur va dans son énoncé.
  useEffect(() => {
    if (!focusEnonce.current) return
    focusEnonce.current = false
    enonce.current?.focus()
  }, [currentId])

  // Ne rien perdre si la fenêtre se ferme avant la fin du délai d'autosauvegarde.
  useEffect(() => {
    const flush = () => void useOpenExercise.getState().flush()
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  if (selected === null) {
    // Un fichier supprimé ou déplacé n'est pas proposé : on croise avec l'arbre actuel.
    const entries = new Map(tree.flatMap(c => c.exercises.map(e => [e.path, e] as const)))
    const items = recent.flatMap(r => {
      const entry = entries.get(r.path)
      return entry === undefined || entry.corrompu ? [] : [{ path: r.path, name: entry.titre, folder: splitPath(r.path)[0], openedAt: r.openedAt }]
    })
    const counts = (path: string) => entries.get(path)
    const badges = (item: { path: string }) => (
      <>
        <ToCorrectBadge count={counts(item.path)?.aCorriger ?? 0} />
        <ToReviewBadge count={counts(item.path)?.aRevoir ?? 0} />
      </>
    )
    // Les fiches qui attendent une correction passent devant, sous leur propre titre.
    const toFinish = items.filter(i => (counts(i.path)?.aCorriger ?? 0) > 0)
    const others = items.filter(i => (counts(i.path)?.aCorriger ?? 0) === 0)
    const open = (path: string) => useExerciseStore.getState().select(path)
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <AnimatedLogo mode="draw-pulse" size={140} />
        <CorrectionStatsBar tree={tree} />
        {items.length === 0
          ? <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Choisis un exercice dans la liste de gauche.</p>
          : (
            <>
              <RecentFilesList title="À finir : des exercices attendent leur correction" items={toFinish} onOpen={open} adornment={badges} />
              <RecentFilesList title="Exercices ouverts récemment" items={others} onOpen={open} adornment={badges} />
            </>
          )}
      </div>
    )
  }
  if (status === 'loading') return <p style={{ padding: 16, fontSize: 14 }}>Ouverture…</p>
  if (status === 'unreadable' || exercise === null || sheet === null) {
    return <p role="alert" style={{ padding: 16, fontSize: 14 }}>Ce fichier d'exercice est illisible.</p>
  }

  const position = sheet.exercices.findIndex(e => e.id === exercise.id) + 1
  const count = sheet.exercices.length
  const { removeCurrent } = useOpenExercise.getState()
  // Au bord, la flèche crée un exercice : pas par-dessus un exercice encore vierge.
  const blank = isBlank(exercise)
  const split = isSplit(exercise)
  const corrected = exercise.corrige === true
  const toReview = corrected && exercise.rate === true
  const accent = toReview ? ORANGE : GREEN
  // Une teinte par unité pour tout l'exercice : un champ la consulte, il ne parcourt pas l'exercice.
  const unitHues = assignExerciseHues(exercise)

  /** Avance d'un exercice ; si l'action en a créé un (au bord de la fiche), le curseur ira dans son énoncé. */
  const advance = (delta: -1 | 1) => {
    const total = () => useOpenExercise.getState().sheet?.exercices.length ?? 0
    const before = total()
    useOpenExercise.getState().step(delta)
    if (total() > before) focusEnonce.current = true
  }
  const toggleSplit = () => edit(split ? mergeZones(exercise) : splitZones())
  const send = (from: Zone, id: string) => {
    const patch = sendBlock(exercise, id, from)
    if (patch === null) return
    edit(patch)
    setArrived({ zone: from === 'a' ? 'b' : 'a', id })
  }

  const space = spacing(compact)
  const zone = { minWidth: 0, minHeight: 0, overflowY: 'auto', padding: space.zone, background: 'var(--background)' } as const

  return (
    <SymbolInsertContext value={insertSymbol}>
    <UnitHuesContext value={unitHues}>
    <section aria-label="Exercice" onFocus={rememberField} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header
        style={{
          display: 'flex', flexDirection: 'column', gap: compact ? 4 : 8, padding: space.header,
          '--field-hue': 215,
          background: 'color-mix(in oklab, #3b82f6 18%, var(--background))', borderBottom: '2px solid #3b82f6',
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input
            aria-label="Titre de l'exercice"
            value={sheet.titre}
            onChange={e => editTitle(e.target.value)}
            className={`${field} flex-1 text-base font-semibold`}
            style={{ minWidth: 200 }}
          />
          <input
            aria-label="Numéro de l'exercice (facultatif)"
            placeholder={String(position)}
            value={exercise.numero}
            onChange={e => edit({ numero: e.target.value })}
            className={field}
            style={{ width: 110 }}
          />
          <input
            aria-label="Page (facultatif)"
            placeholder="Page"
            value={exercise.page}
            onChange={e => edit({ page: e.target.value })}
            className={field}
            style={{ width: 80 }}
          />
          <div role="group" aria-label="Navigation dans la fiche" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
            <Button
              variant="ghost" size="icon-sm" aria-label="Exercice précédent"
              title={position === 1 && blank ? "Écris dans cet exercice avant d'en ajouter un avant" : 'Exercice précédent'}
              disabled={position === 1 && blank}
              onClick={() => advance(-1)}
            ><ChevronLeft /></Button>
            <span aria-live="polite" style={{ fontSize: 13, minWidth: 44, textAlign: 'center' }}>{position} / {count}</span>
            <Button
              variant="ghost" size="icon-sm" aria-label="Exercice suivant"
              title={position === count && blank ? "Écris dans cet exercice avant d'en ajouter un après" : 'Exercice suivant'}
              disabled={position === count && blank}
              onClick={() => advance(1)}
            ><ChevronRight /></Button>
            <Button
              variant="ghost" size="icon-sm" aria-label="Supprimer l'exercice" title="Supprimer l'exercice"
              disabled={count <= 1}
              onClick={() => setConfirming(true)}
            ><Trash2 /></Button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <FieldContextMenu kind="text">
            <HighlightedTextarea
              ref={enonce}
              aria-label="Énoncé de l'exercice"
              placeholder="Quelle est la question ?"
              value={exercise.enonce}
              rows={Math.max(2, exercise.enonce.split('\n').length)}
              onChange={e => edit({ enonce: e.target.value })}
              className={`${field} hue-field w-full`}
            />
          </FieldContextMenu>
          <Button
            variant={split ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-pressed={split}
            aria-label={split ? 'Réunir les zones de travail' : 'Scinder la zone de travail en deux'}
            title={split ? 'Réunir les zones de travail' : 'Scinder la zone de travail en deux'}
            onClick={toggleSplit}
          ><Columns2 /></Button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Toolbar target={target} onSymbol={insertSymbol} />
        <div
          style={{
            flex: 1, minWidth: 0, minHeight: 0, display: 'grid',
            gridTemplateColumns: split ? '1fr 1fr' : '1fr', gap: split ? 1 : 0, background: split ? 'var(--border)' : undefined,
          }}
        >
          <div role="group" aria-label={split ? 'Zone de travail de gauche' : 'Zone de travail'} style={zone}>
            <BlockStack
              value={exercise.blocs}
              onChange={blocs => edit({ blocs })}
              onSend={split ? id => send('a', id) : undefined}
              sendTo="right"
              split={split}
              onToggleSplit={toggleSplit}
              arrivedId={arrived?.zone === 'a' ? arrived.id : null}
            />
          </div>
          {split && (
            <div role="group" aria-label="Zone de travail de droite" style={zone}>
              <BlockStack
                label="Blocs de la zone de droite"
                value={exercise.blocsB ?? []}
                onChange={blocsB => edit({ blocsB })}
                onSend={id => send('b', id)}
                sendTo="left"
                split={split}
                onToggleSplit={toggleSplit}
                arrivedId={arrived?.zone === 'b' ? arrived.id : null}
              />
            </div>
          )}
        </div>
      </div>

      <footer
        aria-label="Zone de réponse"
        data-corrige={corrected ? (toReview ? 'revoir' : 'true') : undefined}
        style={{
          '--field-hue': corrected ? (toReview ? 25 : 142) : 215,
          ...(corrected
            ? { padding: space.footer, background: `color-mix(in oklab, ${accent} 18%, var(--background))`, border: `2px solid ${accent}` }
            : { padding: space.footer, background: 'color-mix(in oklab, #3b82f6 18%, var(--background))', borderTop: '2px solid #3b82f6' }),
        } as unknown as React.CSSProperties}
      >
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }} htmlFor="reponse-finale">
          Réponse
        </label>
        <FieldContextMenu kind="text">
          <HighlightedTextarea
            id="reponse-finale"
            value={exercise.reponse}
            onChange={e => edit({ reponse: e.target.value })}
            rows={2}
            className={`${field} hue-field w-full`}
          />
        </FieldContextMenu>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <p
            role={status === 'failed' ? 'alert' : 'status'}
            style={{ margin: 0, fontSize: 11, color: status === 'failed' ? 'var(--destructive)' : 'var(--muted-foreground)' }}
          >
            {status in STATUS_TEXT ? STATUS_TEXT[status as keyof typeof STATUS_TEXT] : ''}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
          <Button
            variant={corrected ? 'secondary' : 'outline'} size="sm"
            aria-pressed={corrected}
            aria-label="Exercice corrigé"
            title={corrected ? 'Corrigé : cliquer pour le remettre à corriger' : 'Marquer cet exercice comme corrigé'}
            onClick={() => edit(toggleCorrected(exercise))}
          >
            <Check />{corrected ? 'Corrigé' : 'Marquer corrigé'}
          </Button>
          {corrected && (
            <Button
              variant={toReview ? 'secondary' : 'outline'} size="sm"
              aria-pressed={toReview}
              aria-label="À revoir"
              title={toReview ? 'À revoir : cliquer pour retirer' : 'Corrigé mais raté : à revoir'}
              onClick={() => edit(toggleRate(exercise))}
            >
              <RotateCcw />À revoir
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            aria-label="Prochain exercice à corriger"
            title="Prochain exercice à corriger"
            onClick={() => { jumpToNextToCorrect() }}
          >
            <ListChecks />Prochain à corriger
          </Button>
          <Button
            variant="outline" size="sm"
            aria-label={position < count ? "Passer à l'exercice suivant" : 'Nouvel exercice'}
            title={position === count && blank ? "Écris dans cet exercice avant d'en ajouter un après" : undefined}
            disabled={position === count && blank}
            onClick={() => advance(1)}
          >
            {position < count ? <>Exercice suivant<ChevronRight /></> : <>Nouvel exercice<Plus /></>}
          </Button>
          </div>
        </div>
      </footer>
      <ConfirmDialog
        open={confirming}
        title="Supprimer cet exercice ?"
        description={`L'exercice ${exercise.numero.trim() === '' ? position : exercise.numero} sera effacé de la fiche « ${sheet.titre} ». Cette action est définitive.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); removeCurrent() }}
      />
    </section>
    </UnitHuesContext>
    </SymbolInsertContext>
  )
}
