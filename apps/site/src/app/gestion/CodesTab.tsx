import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Badge, Button, EmptyState, Field, inputClass } from '@/ui/primitives'
import { formatCode, type InviteState } from '../lib/inviteCode'
import { createCode, deleteCode, revokeCode } from './api'
import { summarizeCodes, type CodeRow, type UserRow } from './summaries'
import { TwoStepButton } from './TwoStepButton'
import { InlineError, ResponsiveRows, SecretNotice, formatDate, useRunner } from './parts'

const STATES: Record<InviteState, { label: string; tone: 'ok' | 'neutral' | 'warn' | 'danger' }> = {
  actif: { label: 'Actif', tone: 'ok' },
  utilise: { label: 'Utilisé', tone: 'neutral' },
  expire: { label: 'Expiré', tone: 'warn' },
  revoque: { label: 'Révoqué', tone: 'danger' },
}

export function CodesTab({ users, codes, reload }: { users: UserRow[]; codes: CodeRow[]; reload: () => Promise<void> }) {
  const { error, run, fail } = useRunner(reload)
  const [kind, setKind] = useState<'unique' | 'duree'>('unique')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const views = summarizeCodes(codes, users, Date.now())

  const submit = async () => {
    // Validé ici, avant tout appel : un 400 serait pris par createCode pour un code en double.
    if (kind === 'duree') {
      if (expiresAt === '') return fail('Choisissez une date d’expiration.')
      if (Date.parse(expiresAt) <= Date.now()) return fail('La date d’expiration est déjà passée.')
    }
    let code: string | null = null
    const ok = await run(async () => { code = (await createCode({ kind, expiresAt, note })).code })
    if (ok) {
      setCreated(code)
      setNote('')
    }
  }
  const link = created === null ? '' : `${window.location.origin}/inscription/?code=${created}`
  // Le presse-papiers est absent hors contexte sûr (http) : le lien reste sélectionnable à la main.
  const copy = () => { void navigator.clipboard?.writeText(link) }

  return (
    <div className="space-y-4">
      <form className="space-y-3 rounded-2xl border border-ink-850 bg-ink-900 p-4" onSubmit={e => { e.preventDefault(); void submit() }}>
        <h2 className="text-sm font-semibold">Créer un code d’inscription</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Type">
            <select className={inputClass} value={kind} onChange={e => setKind(e.target.value as 'unique' | 'duree')}>
              <option value="unique">Usage unique</option>
              <option value="duree">Durée</option>
            </select>
          </Field>
          {kind === 'duree' && (
            <Field label="Expire le">
              <input className={inputClass} type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </Field>
          )}
          <Field label="Note"><input className={inputClass} value={note} onChange={e => setNote(e.target.value)} /></Field>
        </div>
        <Button type="submit" tone="primary">Créer le code</Button>
      </form>
      <InlineError message={error} />
      {created !== null && (
        <SecretNotice>
          <p className="text-2xl font-semibold tracking-widest">{formatCode(created)}</p>
          <p className="break-all text-ink-300">{link}</p>
          <Button onClick={copy}>Copier</Button>
          <p className="text-ink-500">Notez-le : il ne sera plus affiché.</p>
        </SecretNotice>
      )}
      {views.length === 0 ? (
        <EmptyState icon={<KeyRound size={40} />} title="Aucun code d’inscription" hint="Créez-en un pour inviter un professeur." />
      ) : (
        <ResponsiveRows
          items={views}
          rowKey={v => v.id}
          headers={['Code', 'État', 'Type', 'Échéance', 'Note', 'Inscrits']}
          cells={v => [
            <code key="c">{formatCode(v.code)}</code>,
            <Badge key="s" tone={STATES[v.state].tone}>{STATES[v.state].label}</Badge>,
            v.kind === 'duree' ? 'Durée' : 'Usage unique',
            v.kind === 'duree' ? formatDate(v.expires_at, true) : '—',
            v.note === '' ? '—' : v.note,
            v.inscrits.length === 0 ? '—' : v.inscrits.join(', '),
          ]}
          actions={v => (
            <>
              {v.state === 'actif' && <TwoStepButton label="Révoquer" onConfirm={() => void run(() => revokeCode(v.id))} />}
              <TwoStepButton label="Supprimer" onConfirm={() => void run(() => deleteCode(v.id))} />
            </>
          )}
        />
      )}
    </div>
  )
}
