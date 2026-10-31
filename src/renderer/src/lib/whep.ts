import { AUDIO_BUFFER_MS, VIDEO_MIN_BUFFER_MS, bufferDeltaMs, type BufferSample } from './latency'

export type WhepStatus =
  'idle' | 'connecting' | 'negotiating' | 'waiting' | 'live' | 'disconnected' | 'error'

export type WhepErrorCode = 'http' | 'timeout' | 'network' | 'protocol' | 'unknown'

export class WhepError extends Error {
  readonly code: WhepErrorCode
  readonly status?: number

  constructor(code: WhepErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'WhepError'
    this.code = code
    this.status = status
  }
}

export type StreamStats = {
  bitrateKbps: number | null
  fps: number | null
  width: number | null
  height: number | null
  droppedFrames: number | null
  jitterMs: number | null
  /** Average time media currently waits in the jitter buffer before playout. */
  bufferMs: number | null
}

export type WhepSessionOptions = {
  iceServers?: RTCIceServer[]
  connectTimeoutMs?: number
  onStatus?: (status: WhepStatus) => void
  onTrack?: (stream: MediaStream) => void
  onDrop?: () => void
  onError?: (error: WhepError) => void
}

type LowLatencyReceiver = RTCRtpReceiver & {
  playoutDelayHint?: number
  jitterBufferTarget?: number
}

type InboundVideoStats = {
  type: string
  kind?: string
  bytesReceived?: number
  framesPerSecond?: number
  frameWidth?: number
  frameHeight?: number
  framesDropped?: number
  jitter?: number
  jitterBufferDelay?: number
  jitterBufferEmittedCount?: number
}

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000
const DROP_GRACE_MS = 4_000

/** Resolve gathering shortly after the last candidate instead of waiting 4 s. */
const ICE_IDLE_MS = 400
const ICE_MAX_MS = 4_000

/**
 * Minimal WHEP client: one recvonly peer connection, an explicit timeout and a
 * proper teardown that releases the server-side session (DELETE on Location).
 */
export class WhepSession {
  private readonly pc: RTCPeerConnection
  private readonly media = new MediaStream()
  private readonly options: WhepSessionOptions
  private resourceUrl: string | null = null
  private abortController: AbortController | null = null
  private dropTimer: ReturnType<typeof setTimeout> | undefined
  private closed = false
  private videoReceiver: RTCRtpReceiver | null = null
  private videoTargetMs = VIDEO_MIN_BUFFER_MS

  private lastBytes = 0
  private lastStatsAt = 0
  private lastBuffer: BufferSample | null = null

  constructor(options: WhepSessionOptions = {}) {
    this.options = options
    this.pc = new RTCPeerConnection({ iceServers: options.iceServers ?? [] })
    this.pc.addTransceiver('video', { direction: 'recvonly' })
    this.pc.addTransceiver('audio', { direction: 'recvonly' })

    this.pc.ontrack = (event) => {
      if (this.closed) return

      if (event.track.kind === 'video') {
        this.videoReceiver = event.receiver
        this.videoTargetMs = VIDEO_MIN_BUFFER_MS
        applyLowLatency(event.receiver, VIDEO_MIN_BUFFER_MS)
      } else {
        applyLowLatency(event.receiver, AUDIO_BUFFER_MS)
      }

      this.media.addTrack(event.track)
      this.options.onTrack?.(this.media)
    }

    this.pc.onconnectionstatechange = () => this.handleConnectionState()
  }

  private handleConnectionState(): void {
    if (this.closed) return

    switch (this.pc.connectionState) {
      case 'connected':
        if (this.dropTimer) {
          clearTimeout(this.dropTimer)
          this.dropTimer = undefined
        }
        this.options.onStatus?.('live')
        break

      case 'disconnected':
        this.options.onStatus?.('disconnected')
        if (this.dropTimer) clearTimeout(this.dropTimer)
        this.dropTimer = setTimeout(() => {
          if (!this.closed) this.options.onDrop?.()
        }, DROP_GRACE_MS)
        break

      case 'failed':
        this.options.onDrop?.()
        break

      default:
        break
    }
  }

  async start(url: string): Promise<void> {
    if (this.closed) throw new WhepError('unknown', 'session closed')

    this.options.onStatus?.('connecting')
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    await this.waitForIce()

    if (this.closed) return
    this.options.onStatus?.('negotiating')

    const controller = new AbortController()
    this.abortController = controller
    const timeoutMs = this.options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS
    const timeout = setTimeout(() => {
      controller.abort(new DOMException('timeout', 'TimeoutError'))
    }, timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: this.pc.localDescription?.sdp,
        cache: 'no-store',
        signal: controller.signal
      })
    } catch (error) {
      throw toWhepError(error)
    } finally {
      clearTimeout(timeout)
    }

    if (this.closed) return

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      const error = new WhepError(
        'http',
        details.trim().slice(0, 300) || response.statusText || 'HTTP error',
        response.status
      )
      this.options.onError?.(error)
      throw error
    }

    const answer = await response.text()
    const location = response.headers.get('Location')

    if (location) {
      try {
        this.resourceUrl = new URL(location, url).toString()
      } catch {
        this.resourceUrl = null
      }
    }

    try {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answer })
    } catch (error) {
      const failure = new WhepError(
        'protocol',
        error instanceof Error ? error.message : 'invalid answer'
      )
      this.options.onError?.(failure)
      throw failure
    }

    if (!this.closed) this.options.onStatus?.('waiting')
  }

  /**
   * Adaptive safety net: the video target stays at the minimum and is only
   * raised while the measured jitter is high. Ignored by browsers without
   * `jitterBufferTarget`.
   */
  setVideoLatencyTarget(targetMs: number): void {
    if (this.closed || !this.videoReceiver) return
    if (targetMs === this.videoTargetMs) return

    const receiver = this.videoReceiver as LowLatencyReceiver

    try {
      if ('jitterBufferTarget' in receiver) {
        receiver.jitterBufferTarget = targetMs
        this.videoTargetMs = targetMs
      }
    } catch {
      // Unsupported or out of range: keep the current target.
    }
  }

  async collectStats(): Promise<StreamStats | null> {
    if (this.closed) return null

    try {
      const report = await this.pc.getStats()
      let inbound: InboundVideoStats | undefined

      report.forEach((stat: InboundVideoStats) => {
        if (stat.type === 'inbound-rtp' && stat.kind === 'video') inbound = stat
      })

      if (!inbound) return null

      const now = performance.now()
      const bytes = inbound.bytesReceived ?? 0

      let bitrateKbps: number | null = null
      if (this.lastStatsAt > 0 && now > this.lastStatsAt) {
        bitrateKbps = Math.round(((bytes - this.lastBytes) * 8) / (now - this.lastStatsAt))
      }

      this.lastBytes = bytes
      this.lastStatsAt = now

      const sample = readBufferSample(inbound)
      const bufferMs = bufferDeltaMs(this.lastBuffer, sample)
      if (sample) this.lastBuffer = sample

      return {
        bitrateKbps,
        fps: inbound.framesPerSecond ?? null,
        width: inbound.frameWidth ?? null,
        height: inbound.frameHeight ?? null,
        droppedFrames: inbound.framesDropped ?? null,
        jitterMs: typeof inbound.jitter === 'number' ? inbound.jitter * 1000 : null,
        bufferMs
      }
    } catch {
      return null
    }
  }

  /** Closes the peer connection and tells the WHEP server to release the session. */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true

    if (this.dropTimer) {
      clearTimeout(this.dropTimer)
      this.dropTimer = undefined
    }

    this.abortController?.abort()
    this.abortController = null

    const resourceUrl = this.resourceUrl
    this.resourceUrl = null

    this.pc.onconnectionstatechange = null
    this.pc.ontrack = null

    for (const track of this.media.getTracks()) {
      this.media.removeTrack(track)
      track.stop()
    }

    try {
      this.pc.close()
    } catch {
      // Already closed.
    }

    this.options.onStatus?.('idle')

    if (resourceUrl) {
      try {
        await fetch(resourceUrl, {
          method: 'DELETE',
          signal: AbortSignal.timeout(3000)
        })
      } catch {
        // Not every WHEP endpoint supports DELETE; the server will time out.
      }
    }
  }

  private async waitForIce(): Promise<void> {
    if (this.pc.iceGatheringState === 'complete') return

    // The full gathering window is only kept when a STUN/TURN server is
    // configured and its reflexive candidate has not arrived yet. Otherwise the
    // offer can go out shortly after the last candidate, which removes up to a
    // few seconds from the time to first frame.
    const usesTurn = (this.options.iceServers ?? []).some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
      return urls.some(
        (url) => typeof url === 'string' && url.trim().toLowerCase().startsWith('turn')
      )
    })

    const usesStun = (this.options.iceServers ?? []).some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
      return urls.some(
        (url) => typeof url === 'string' && url.trim().toLowerCase().startsWith('stun')
      )
    })

    // A configured STUN/TURN server needs its reflexive candidate in the offer.
    // Without one (usual LAN setup), the offer can go out as soon as the host
    // candidates have settled.
    const needsReflexive = usesStun || usesTurn

    await new Promise<void>((resolve) => {
      let idleTimer: ReturnType<typeof setTimeout> | undefined
      let maxTimer: ReturnType<typeof setTimeout> | null = null
      let sawReflexive = false

      const finish = (): void => {
        this.pc.removeEventListener('icegatheringstatechange', onChange)
        this.pc.removeEventListener('icecandidate', onCandidate)
        if (idleTimer) clearTimeout(idleTimer)
        if (maxTimer) clearTimeout(maxTimer)
        resolve()
      }

      const onChange = (): void => {
        if (this.pc.iceGatheringState === 'complete') finish()
      }

      const onCandidate = (event: RTCPeerConnectionIceEvent): void => {
        if (!event.candidate) return

        if (event.candidate.type === 'srflx' || event.candidate.type === 'relay') {
          sawReflexive = true
        }

        if (needsReflexive && !sawReflexive) return

        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(finish, ICE_IDLE_MS)
      }

      this.pc.addEventListener('icegatheringstatechange', onChange)
      this.pc.addEventListener('icecandidate', onCandidate)

      // Gathering may have completed while the listeners were being added.
      if (this.pc.iceGatheringState === 'complete') {
        finish()
        return
      }

      maxTimer = setTimeout(finish, ICE_MAX_MS)
    })
  }
}

function readBufferSample(stats: InboundVideoStats): BufferSample | null {
  const delaySeconds = stats.jitterBufferDelay
  const emittedCount = stats.jitterBufferEmittedCount

  if (typeof delaySeconds !== 'number' || typeof emittedCount !== 'number') return null

  return { delaySeconds, emittedCount }
}

function applyLowLatency(receiver: RTCRtpReceiver, targetMs: number): void {
  const target = receiver as LowLatencyReceiver

  try {
    if ('jitterBufferTarget' in target) target.jitterBufferTarget = targetMs
  } catch {
    // Unsupported.
  }

  // Deprecated hint, still honoured by some Chromium builds. Only relevant for
  // the video receiver: forcing it on audio causes crackling.
  if (targetMs === VIDEO_MIN_BUFFER_MS) {
    try {
      target.playoutDelayHint = 0
    } catch {
      // Unsupported.
    }
  }
}

export function toWhepError(error: unknown): WhepError {
  if (error instanceof WhepError) return error

  if (error instanceof DOMException) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return new WhepError('timeout', 'timeout')
    }
    return new WhepError('network', error.message)
  }

  if (error instanceof TypeError) return new WhepError('network', error.message)

  return new WhepError('unknown', error instanceof Error ? error.message : String(error))
}
