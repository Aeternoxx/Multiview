import type { Stream } from '@shared/types'

/**
 * Normalizes user input into a usable WHEP URL.
 * `server.local/cam/whep` becomes `https://server.local/cam/whep`.
 */
export function normalizeStreamUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname) return null
    return url.toString()
  } catch {
    return null
  }
}

export function isDuplicateStreamUrl(streams: Stream[], url: string, ignoreId?: string): boolean {
  return streams.some((stream) => stream.id !== ignoreId && stream.url === url)
}
