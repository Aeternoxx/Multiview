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
}

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000
const DROP_GRACE_MS = 4_000

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

  private lastBytes = 0
  private lastStatsAt = 0

  constructor(options: WhepSessionOptions = {}) {
    this.options = options
    this.pc = new RTCPeerConnection({ iceServers: options.iceServers ?? [] })
    this.pc.addTransceiver('video', { direction: 'recvonly' })
    this.pc.addTransceiver('audio', { direction: 'recvonly' })

    this.pc.ontrack = (event) => {
      if (this.closed) return

      applyLowLatency(event.receiver)
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

      return {
        bitrateKbps,
        fps: inbound.framesPerSecond ?? null,
        width: inbound.frameWidth ?? null,
        height: inbound.frameHeight ?? null,
        droppedFrames: inbound.framesDropped ?? null,
        jitterMs: typeof inbound.jitter === 'number' ? inbound.jitter * 1000 : null
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

    await new Promise<void>((resolve) => {
      const finish = (): void => {
        this.pc.removeEventListener('icegatheringstatechange', onChange)
        clearTimeout(timeout)
        resolve()
      }

      const onChange = (): void => {
        if (this.pc.iceGatheringState === 'complete') finish()
      }

      const timeout = setTimeout(finish, 4000)
      this.pc.addEventListener('icegatheringstatechange', onChange)
    })
  }
}

function applyLowLatency(receiver: RTCRtpReceiver): void {
  const target = receiver as LowLatencyReceiver

  try {
    target.playoutDelayHint = 0
  } catch {
    // Unsupported.
  }

  try {
    if ('jitterBufferTarget' in target) target.jitterBufferTarget = 0
  } catch {
    // Unsupported.
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
