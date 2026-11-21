import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/types'

/**
 * Mirrors the update state owned by the main process: the polling, the download
 * and the install all happen there. A `null` state means this build cannot
 * auto-update (dev, mac or a zip copy), so the UI shows no pill at all.
 */
export function useUpdate(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null)

  useEffect(() => {
    let mounted = true

    const unsubscribe = window.api.onUpdateState((next) => {
      if (mounted) setState(next)
    })

    // Late mounts and offline start-ups: the main process already has a check
    // in flight, this one only asks for the current state.
    void window.api
      .checkForUpdate()
      .then((next) => {
        if (mounted) setState(next)
      })
      .catch(() => undefined)

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return state
}
