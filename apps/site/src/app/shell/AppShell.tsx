import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { logout, type PageId, type Session } from '../session/session'
import { navFor } from './nav'

function label(session: Session): string {
  return session.kind === 'admin' ? session.email : session.username
}

/** Barre latérale à partir de `md`, barre du bas en dessous (le pouce n'atteint pas le haut). */
export function AppShell({ session, page, title, children }: { session: Session; page: PageId; title: string; children: ReactNode }) {
  const items = navFor(session)
  const signOut = () => {
    logout()
    window.location.replace('/login/')
  }
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-850 bg-ink-950 p-4 md:flex">
        <p className="mb-6 text-sm font-semibold">Zachar’t</p>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navigation principale">
          {items.map(item => (
            <a
              key={item.id}
              href={item.href}
              aria-current={item.id === page ? 'page' : undefined}
              className={`tap flex items-center rounded-xl px-3 text-sm transition-colors ${
                item.id === page ? 'bg-ink-850 text-ink-100' : 'text-ink-300 hover:bg-ink-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-ink-850 pt-3">
          <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{label(session)}</span>
          <button type="button" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter"
            className="tap grid w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-850 hover:text-ink-100">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top flex items-center gap-3 border-b border-ink-850 px-4 pb-2 md:px-8">
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
          <span className="truncate text-xs text-ink-500 md:hidden">{label(session)}</span>
          <button type="button" onClick={signOut} aria-label="Se déconnecter"
            className="tap grid w-10 shrink-0 place-items-center rounded-xl text-ink-500 hover:bg-ink-850 md:hidden">
            <LogOut size={18} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
        <nav className="safe-bottom flex border-t border-ink-850 bg-ink-950 md:hidden" aria-label="Navigation principale">
          {items.map(item => (
            <a key={item.id} href={item.href} aria-current={item.id === page ? 'page' : undefined}
              className={`tap flex flex-1 items-center justify-center pt-2 text-[11px] ${item.id === page ? 'text-accent' : 'text-ink-500'}`}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
