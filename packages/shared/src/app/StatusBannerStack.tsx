import { StatusBanner } from '../shell'
import { useAppStatusStore } from './useAppStatus'

/** The banners of `useAppStatus`, in the order they were pushed. */
export function StatusBannerStack() {
  const entries = useAppStatusStore(state => state.entries)
  const remove = useAppStatusStore(state => state.remove)
  return (
    <>
      {entries.map(entry => (
        <StatusBanner
          key={entry.id}
          kind={entry.kind}
          action={entry.action}
          dismissLabel={entry.dismissLabel}
          onDismiss={
            entry.dismiss === undefined
              ? undefined
              : () => {
                  entry.dismiss?.()
                  remove(entry.id)
                }
          }
        >
          {entry.text}
        </StatusBanner>
      ))}
    </>
  )
}
