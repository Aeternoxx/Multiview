import { WhepSession } from './whep'

const PROBE_TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 20_000

type CacheEntry = { result: boolean; checkedAt: number }

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<boolean>>()
const generations = new Map<string, number>()

function generationOf(url: string): number {
  return generations.get(url) ?? 0
}

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

  const generation = generationOf(url)

  const promise = probeStream(url, iceServers)
    .then((result) => {
      // An invalidation happened while this probe was running: its result is
      // already stale, so do not cache it.
      if (generationOf(url) === generation) cache.set(url, { result, checkedAt: Date.now() })
      return result
    })
    .catch(() => false)
    .finally(() => {
      // A newer probe may have replaced this one after an invalidation.
      if (inFlight.get(url) === promise) inFlight.delete(url)
    })

  inFlight.set(url, promise)
  return promise
}

/** Drops the cached result for one URL so the next probe is authoritative. */
export function invalidateProbeCache(url: string): void {
  generations.set(url, generationOf(url) + 1)
  cache.delete(url)
  // Do not reuse a probe that started before the invalidation.
  inFlight.delete(url)
}

export function clearProbeCache(): void {
  cache.clear()
  inFlight.clear()

  for (const url of generations.keys()) {
    generations.set(url, generationOf(url) + 1)
  }
}
