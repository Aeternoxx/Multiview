import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  getAvailability,
  setAvailability,
  subscribeAvailability,
  type Availability
} from '../lib/availability'
import { probeStreamCached } from '../lib/probe'

type UseStreamAvailabilityOptions = {
  url: string
  enabled: boolean
  iceServers: RTCIceServer[]
}

const OFFLINE_INTERVAL_MS = 30_000
const ONLINE_INTERVAL_MS = 60_000
const HIDDEN_INTERVAL_MS = 15_000

/**
 * Background availability check for stopped streams. Polling continues while
 * the stream is available too: a stream that stops being broadcast while idle
 * must be reported as unavailable instead of staying "online" forever.
 */
export function useStreamAvailability({
  url,
  enabled,
  iceServers
}: UseStreamAvailabilityOptions): Availability {
  const availability = useSyncExternalStore(
    subscribeAvailability,
    () => getAvailability(url),
    () => 'checking' as Availability
  )

  const iceKey = JSON.stringify(iceServers)
  const iceRef = useRef(iceServers)

  useEffect(() => {
    iceRef.current = iceServers
  }, [iceServers])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = (delay: number): void => {
      if (cancelled) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void check()
      }, delay)
    }

    const check = async (): Promise<void> => {
      if (cancelled) return

      if (document.hidden) {
        schedule(HIDDEN_INTERVAL_MS)
        return
      }

      const online = await probeStreamCached(url, iceRef.current)
      if (cancelled) return

      setAvailability(url, online ? 'online' : 'offline')
      schedule(online ? ONLINE_INTERVAL_MS : OFFLINE_INTERVAL_MS)
    }

    const onVisibilityChange = (): void => {
      if (document.hidden) return
      schedule(0)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    // Small stagger so a grid of tiles does not probe all at once on startup.
    schedule(600 + Math.random() * 1200)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [url, enabled, iceKey])

  return availability
}
