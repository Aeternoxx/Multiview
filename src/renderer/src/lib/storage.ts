import type { AudioState, Stream } from '@shared/types'
import type { IceConfig } from './ice'
import { MIN_TILE_HEIGHT, MIN_TILE_WIDTH } from './tiles'

export type TileSize = { width: number; height: number }
export type AudioMap = Record<string, AudioState>

export const STORAGE_KEYS = {
  streams: 'multiview-streams',
  tileSizes: 'multiview-tile-sizes',
  audio: 'multiview-audio',
  language: 'multiview-language',
  ice: 'multiview-ice'
} as const

export const DEFAULT_AUDIO: AudioState = { volume: 70, muted: true }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false

  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Accepts the v1 numeric ids so existing installs keep their streams. */
export function parseStreams(raw: string | null): Stream[] {
  const parsed = parseJson(raw)
  if (!Array.isArray(parsed)) return []

  const streams: Stream[] = []
  const seen = new Set<string>()

  for (const item of parsed) {
    if (!isRecord(item)) continue

    const id =
      typeof item.id === 'string' ? item.id : typeof item.id === 'number' ? String(item.id) : null
    if (!id || seen.has(id)) continue
    if (!isHttpUrl(item.url)) continue

    const name =
      typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 80) : 'Flux'

    seen.add(id)
    streams.push({ id, name, url: item.url.trim() })
  }

  return streams
}

export function parseTileSizes(raw: string | null): Record<string, TileSize> {
  const parsed = parseJson(raw)
  if (!isRecord(parsed)) return {}

  const sizes: Record<string, TileSize> = {}

  for (const [id, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue

    const width = Number(value.width)
    const height = Number(value.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    if (width < MIN_TILE_WIDTH || height < MIN_TILE_HEIGHT) continue

    sizes[id] = { width: Math.round(width), height: Math.round(height) }
  }

  return sizes
}

export function parseAudioMap(raw: string | null): AudioMap {
  const parsed = parseJson(raw)
  if (!isRecord(parsed)) return {}

  const audio: AudioMap = {}

  for (const [id, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue

    const volume = Number(value.volume)
    if (!Number.isFinite(volume)) continue

    audio[id] = {
      volume: Math.min(100, Math.max(0, Math.round(volume))),
      muted: value.muted === true
    }
  }

  return audio
}

export function parseLanguage(raw: string | null): 'FR' | 'EN' {
  if (!raw) return 'FR'

  const value = raw.startsWith('"') ? (parseJson(raw) as unknown) : raw
  return value === 'EN' ? 'EN' : 'FR'
}

export function parseIceConfigValue(raw: string | null): Partial<IceConfig> | null {
  const parsed = parseJson(raw)
  return isRecord(parsed) ? (parsed as Partial<IceConfig>) : null
}

export function readJson<T>(key: string, parse: (raw: string | null) => T, fallback: T): T {
  try {
    return parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`[MultiView] Unable to persist ${key}:`, error)
  }
}
