import { inviteCodeState, type InviteKind, type InviteState } from '../lib/inviteCode'

export interface UserRow {
  id: string
  username: string
  role: 'prof' | 'eleve'
  teacher: string
  invite_code: string
  created: string
}

export interface CodeRow {
  id: string
  code: string
  kind: InviteKind
  expires_at: string
  revoked: boolean
  note: string
  created: string
}

export interface CodeView extends CodeRow {
  state: InviteState
  inscrits: string[]
}

/** Nombre d'élèves par prof ; les profs eux-mêmes et les élèves sans prof ne comptent pas. */
export function teacherCounts(users: readonly UserRow[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const user of users) {
    if (user.role === 'eleve' && user.teacher !== '') counts.set(user.teacher, (counts.get(user.teacher) ?? 0) + 1)
  }
  return counts
}

/** Les codes actifs d'abord, puis du plus récent au plus ancien. */
export function summarizeCodes(codes: readonly CodeRow[], users: readonly UserRow[], nowMs: number): CodeView[] {
  return codes
    .map<CodeView>(row => {
      // Un code s'utilise à l'inscription d'un prof : ce sont eux qui le « consomment ».
      const inscrits = users.filter(user => user.role === 'prof' && user.invite_code === row.code)
      return {
        ...row,
        state: inviteCodeState(row, inscrits.length, nowMs),
        inscrits: inscrits.map(user => user.username),
      }
    })
    .sort((a, b) => {
      const rank = (view: CodeView) => (view.state === 'actif' ? 0 : 1)
      return rank(a) - rank(b) || b.created.localeCompare(a.created)
    })
}

export function filterEleves(users: readonly UserRow[], teacherId: string | 'all'): UserRow[] {
  return users.filter(user => user.role === 'eleve' && (teacherId === 'all' || user.teacher === teacherId))
}
