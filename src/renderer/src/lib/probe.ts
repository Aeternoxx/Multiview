import { WhepSession } from './whep'

const PROBE_TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 20_000

type CacheEntry = { result: boolean; checkedAt: number }

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<boolean>>()

/**
 * Opens a short-lived WHEP session and waits for a decoded frame: an OPTIONS
 * response only proves that a web server exists, not that a stream is live.
 */
export async function probeStream(url: string, iceServers: RTCIceServer[]): Promise<boolean> {
  const video = document.createElement('video')
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  video.style.cssText =
    'position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0.01;pointer-events:none'
  document.body.appendChild(video)

  let finish: (value: boolean) => void = () => undefined
  const resultPromise = new Promise<boolean>((resolve) => {
    finish = resolve
  })

  const session = new WhepSession({
    iceServers,
    connectTimeoutMs: 8000,
    onTrack: (stream) => {
      video.srcObject = stream
      void video.play().catch(() => undefined)
    },
    onDrop: () => finish(false),
    onError: () => finish(false)
  })

  video.addEventListener(
    'loadeddata',
    () => finish(video.videoWidth > 0 && video.videoHeight > 0),
    {
      once: true
    }
  )

  const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS)

  try {
    await session.start(url)
  } catch {
    finish(false)
  }

  const result = await resultPromise
  clearTimeout(timer)

  video.pause()
  video.srcObject = null
  video.remove()

  // Releases the server-side session with DELETE instead of leaking it.
  await session.close()

  return result
}

/**
 * Deduplicates probes per URL and caches the result. A stopped tile therefore
 * costs at most one short session per minute, never one per render.
 */
export async function probeStreamCached(
  url: string,
  iceServers: RTCIceServer[],
  maxAgeMs = CACHE_TTL_MS
): Promise<boolean> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.checkedAt < maxAgeMs) return hit.result

  const pending = inFlight.get(url)
  if (pending) return pending

  const promise = probeStream(url, iceServers)
    .then((result) => {
      cache.set(url, { result, checkedAt: Date.now() })
      return result
    })
    .catch(() => false)
    .finally(() => {
      inFlight.delete(url)
    })

  inFlight.set(url, promise)
  return promise
}

export function clearProbeCache(): void {
  cache.clear()
}
