import { createContext, useContext, type ReactNode } from 'react'

const AppIdContext = createContext('app')

/** Tells the view hooks which app they belong to (the prefix of their storage keys). `<SuiteApp>` provides it. */
export function AppIdProvider({ id, children }: { id: string; children: ReactNode }) {
  return <AppIdContext.Provider value={id}>{children}</AppIdContext.Provider>
}

export function useAppId(): string {
  return useContext(AppIdContext)
}
