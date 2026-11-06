import { useEffect, useState } from 'react'
import type { UpdateInfo } from '@shared/types'

/** GitHub allows 60 anonymous requests per hour: a slow poll is plenty. */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Asks the main process for a newer release at start-up, then every few hours.
 * A failed check is silent: the app must keep working offline.
 */
export function useUpdateCheck(): UpdateInfo | null {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = (): void => {
      void window.api
        .checkForUpdate()
        .then((info) => {
          if (!cancelled) setUpdate(info)
        })
        .catch(() => undefined)
    }

    check()
    const timer = setInterval(check, RECHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return update
}
