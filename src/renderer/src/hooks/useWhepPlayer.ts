import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { RECONNECT_WINDOW_MS, retryDelay } from '../lib/backoff'
import {
  INITIAL_LATENCY_STATE,
  VIDEO_MIN_BUFFER_MS,
  nextLatencyState,
  nextPlaybackRate
} from '../lib/latency'
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
  /**
   * Called once the reconnection window is over without the stream coming
   * back. The caller should return the tile to its stopped state.
   */
  onUnavailable?: () => void
}

type UseWhepPlayerResult = {
  status: WhepStatus
  error: WhepError | null
  stats: StreamStats | null
  retry: () => void
}

const STATS_INTERVAL_MS = 2000

/** Drift correction runs more often than the stats, but stays cheap. */
const TUNING_INTERVAL_MS = 500

export function useWhepPlayer({
  url,
  active,
  iceServers,
  videoRef,
  onUnavailable
}: UseWhepPlayerOptions): UseWhepPlayerResult {
  const [status, setStatus] = useState<WhepStatus>('idle')
  const [error, setError] = useState<WhepError | null>(null)
  const [stats, setStats] = useState<StreamStats | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  const iceKey = JSON.stringify(iceServers)
  const iceRef = useRef(iceServers)
  const onUnavailableRef = useRef(onUnavailable)

  useEffect(() => {
    iceRef.current = iceServers
  }, [iceServers])

  useEffect(() => {
    onUnavailableRef.current = onUnavailable
  }, [onUnavailable])

  useEffect(() => {
    if (!active) {
      const video = videoRef.current
      if (video) video.srcObject = null
      return
    }

    let cancelled = false
    let finished = false
    let session: WhepSession | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined
    let statsTimer: ReturnType<typeof setInterval> | undefined
    let tuningTimer: ReturnType<typeof setInterval> | undefined
    let attempt = 0
    let recovering = false
    let latencyState = INITIAL_LATENCY_STATE
    let appliedLatencyMs = VIDEO_MIN_BUFFER_MS
    const videoElement = videoRef.current

    const stopStats = (): void => {
      if (statsTimer) {
        clearInterval(statsTimer)
        statsTimer = undefined
      }
    }

    /**
     * Keeps the accumulated latency bounded: a temporary speed-up drains the
     * backlog after a hiccup or a slow decode, without changing the jitter
     * buffer target. The rate is reset as soon as the backlog is gone.
     */
    const tunePlayout = (): void => {
      if (!videoElement) return

      if (videoElement.paused || videoElement.readyState < 2) {
        if (videoElement.playbackRate !== 1) videoElement.playbackRate = 1
        return
      }

      const buffered = videoElement.buffered
      if (buffered.length === 0) return

      const ahead = buffered.end(buffered.length - 1) - videoElement.currentTime
      const rate = nextPlaybackRate(ahead, videoElement.playbackRate)
      if (rate !== videoElement.playbackRate) videoElement.playbackRate = rate
    }

    const startTuning = (): void => {
      stopTuning()
      tuningTimer = setInterval(tunePlayout, TUNING_INTERVAL_MS)
    }

    const stopTuning = (): void => {
      if (tuningTimer) {
        clearInterval(tuningTimer)
        tuningTimer = undefined
      }

      if (videoElement && videoElement.playbackRate !== 1) videoElement.playbackRate = 1
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

          // Adaptive safety net: raise the video buffer only while the network
          // jitters, and drop back to the minimum as soon as it is calm.
          latencyState = nextLatencyState(latencyState, value.jitterMs)
          if (latencyState.targetMs !== appliedLatencyMs) {
            appliedLatencyMs = latencyState.targetMs
            current.setVideoLatencyTarget(appliedLatencyMs)
          }
        })
      }, STATS_INTERVAL_MS)
    }

    const clearDeadline = (): void => {
      if (deadlineTimer) {
        clearTimeout(deadlineTimer)
        deadlineTimer = undefined
      }
    }

    const giveUp = (): void => {
      if (cancelled || finished) return
      finished = true

      clearDeadline()
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = undefined
      }

      stopStats()
      stopTuning()
      setStats(null)

      const current = session
      session = null
      if (current) void current.close()

      setStatus('error')
      onUnavailableRef.current?.()
    }

    // The window starts as soon as playback is requested and restarts after a
    // drop. It is only cancelled once media is actually flowing again.
    const beginRecovery = (): void => {
      if (cancelled || finished || recovering) return
      recovering = true
      deadlineTimer = setTimeout(giveUp, RECONNECT_WINDOW_MS)
    }

    const endRecovery = (): void => {
      recovering = false
      attempt = 0
      clearDeadline()
    }

    const scheduleRetry = (): void => {
      if (cancelled || finished) return

      beginRecovery()
      if (retryTimer) clearTimeout(retryTimer)
      const delay = retryDelay(attempt)
      attempt += 1
      setStatus('disconnected')
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        void connect()
      }, delay)
    }

    const connect = async (): Promise<void> => {
      if (cancelled || finished) return

      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = undefined
      }

      stopStats()
      stopTuning()
      setStats(null)

      latencyState = INITIAL_LATENCY_STATE
      appliedLatencyMs = VIDEO_MIN_BUFFER_MS

      const previous = session
      session = null
      if (previous) void previous.close()

      const next = new WhepSession({
        iceServers: iceRef.current,
        onStatus: (value) => {
          if (cancelled || finished) return

          if (value === 'live') endRecovery()
          setStatus(value)
        },
        onTrack: (stream) => {
          if (!videoElement) return

          if (videoElement.srcObject !== stream) videoElement.srcObject = stream
          void videoElement.play().catch(() => undefined)
        },
        onDrop: () => {
          if (cancelled || finished) return
          // The session may already have been replaced by a retry.
          if (session !== next) return

          session = null
          void next.close()
          stopStats()
          stopTuning()
          scheduleRetry()
        },
        onError: (value) => {
          if (!cancelled && !finished) setError(value)
        }
      })

      session = next

      try {
        await next.start(url)
        if (cancelled || finished) return
        if (session !== next) return

        setError(null)
        startStats()
        startTuning()
      } catch (failure) {
        if (cancelled || finished) return

        // A drop may have closed this session while start() was in flight and
        // already scheduled the next attempt.
        if (session !== next) return

        const whepError = toWhepError(failure)
        setError(whepError)

        session = null
        void next.close()

        // 4xx responses (including the 404 returned when a stream is no longer
        // published) are treated as transient here: a restarted stream must be
        // allowed to come back during the reconnection window.
        scheduleRetry()
      }
    }

    beginRecovery()
    void connect()

    return () => {
      cancelled = true

      if (retryTimer) clearTimeout(retryTimer)
      clearDeadline()
      stopStats()
      stopTuning()

      void session?.close()
      session = null

      if (videoElement) videoElement.srcObject = null
    }
  }, [active, url, iceKey, retryToken, videoRef])

  const retry = useCallback(() => setRetryToken((value) => value + 1), [])

  return { status, error, stats, retry }
}
