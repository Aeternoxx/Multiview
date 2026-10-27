import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { MAX_CONNECT_ATTEMPTS, retryDelay } from '../lib/backoff'
import {
  WhepSession,
  toWhepError,
  type StreamStats,
  type WhepError,
  type WhepStatus
} from '../lib/whep'

type UseWhepPlayerOptions = {
  url: string
  active: boolean
  iceServers: RTCIceServer[]
  videoRef: RefObject<HTMLVideoElement | null>
}

type UseWhepPlayerResult = {
  status: WhepStatus
  error: WhepError | null
  stats: StreamStats | null
  retry: () => void
}

const STATS_INTERVAL_MS = 2000

export function useWhepPlayer({
  url,
  active,
  iceServers,
  videoRef
}: UseWhepPlayerOptions): UseWhepPlayerResult {
  const [status, setStatus] = useState<WhepStatus>('idle')
  const [error, setError] = useState<WhepError | null>(null)
  const [stats, setStats] = useState<StreamStats | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  const iceKey = JSON.stringify(iceServers)
  const iceRef = useRef(iceServers)

  useEffect(() => {
    iceRef.current = iceServers
  }, [iceServers])

  useEffect(() => {
    if (!active) {
      const video = videoRef.current
      if (video) video.srcObject = null
      return
    }

    let cancelled = false
    let session: WhepSession | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let statsTimer: ReturnType<typeof setInterval> | undefined
    let attempt = 0
    const videoElement = videoRef.current

    const stopStats = (): void => {
      if (statsTimer) {
        clearInterval(statsTimer)
        statsTimer = undefined
      }
    }

    const startStats = (): void => {
      stopStats()
      let ticks = 0

      statsTimer = setInterval(() => {
        ticks += 1
        if (!session) return

        const current = session
        void current.collectStats().then((value) => {
          if (cancelled || !value) return
          // The first snapshot only primes the bitrate computation.
          if (ticks > 1) setStats(value)
        })
      }, STATS_INTERVAL_MS)
    }

    const scheduleRetry = (): void => {
      if (cancelled) return

      if (attempt >= MAX_CONNECT_ATTEMPTS) {
        setStatus('error')
        return
      }

      const delay = retryDelay(attempt)
      attempt += 1
      setStatus('disconnected')
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        void connect()
      }, delay)
    }

    const connect = async (): Promise<void> => {
      if (cancelled) return

      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = undefined
      }

      stopStats()
      setStats(null)

      const previous = session
      session = null
      if (previous) void previous.close()

      const next = new WhepSession({
        iceServers: iceRef.current,
        onStatus: (value) => {
          if (!cancelled) setStatus(value)
        },
        onTrack: (stream) => {
          if (!videoElement) return

          if (videoElement.srcObject !== stream) videoElement.srcObject = stream
          void videoElement.play().catch(() => undefined)
        },
        onDrop: () => {
          if (cancelled) return

          void next.close()
          if (session === next) session = null
          stopStats()
          scheduleRetry()
        },
        onError: (value) => {
          if (!cancelled) setError(value)
        }
      })

      session = next

      try {
        await next.start(url)
        if (cancelled) return

        attempt = 0
        setError(null)
        startStats()
      } catch (failure) {
        if (cancelled) return

        const whepError = toWhepError(failure)
        setError(whepError)

        void next.close()
        if (session === next) session = null

        const permanent =
          whepError.code === 'http' &&
          whepError.status !== undefined &&
          whepError.status >= 400 &&
          whepError.status < 500

        if (permanent) {
          setStatus('error')
          return
        }

        scheduleRetry()
      }
    }

    void connect()

    return () => {
      cancelled = true

      if (retryTimer) clearTimeout(retryTimer)
      stopStats()

      void session?.close()
      session = null

      if (videoElement) videoElement.srcObject = null
    }
  }, [active, url, iceKey, retryToken, videoRef])

  const retry = useCallback(() => setRetryToken((value) => value + 1), [])

  return { status, error, stats, retry }
}
