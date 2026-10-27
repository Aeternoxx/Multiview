import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

export type SavedBounds = { x?: number; y?: number; width: number; height: number }

export type WindowSettings = {
  main?: SavedBounds
  streams?: Record<string, SavedBounds>
  pinned?: Record<string, boolean>
}

const WRITE_DELAY_MS = 300

let cache: WindowSettings | null = null
let writeTimer: NodeJS.Timeout | undefined

function settingsPath(): string {
  return join(app.getPath('userData'), 'window-layout.json')
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sanitizeBounds(value: unknown): SavedBounds | null {
  if (!value || typeof value !== 'object') return null

  const bounds = value as Record<string, unknown>
  if (!isFiniteNumber(bounds.width) || !isFiniteNumber(bounds.height)) return null
  if (bounds.width < 100 || bounds.height < 100) return null

  const result: SavedBounds = {
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  }

  if (isFiniteNumber(bounds.x)) result.x = Math.round(bounds.x)
  if (isFiniteNumber(bounds.y)) result.y = Math.round(bounds.y)

  return result
}

function sanitizeSettings(value: unknown): WindowSettings {
  if (!value || typeof value !== 'object') return {}

  const raw = value as Record<string, unknown>
  const settings: WindowSettings = {}

  const main = sanitizeBounds(raw.main)
  if (main) settings.main = main

  if (raw.streams && typeof raw.streams === 'object') {
    const streams: Record<string, SavedBounds> = {}
    for (const [id, bounds] of Object.entries(raw.streams as Record<string, unknown>)) {
      const sanitized = sanitizeBounds(bounds)
      if (sanitized) streams[id] = sanitized
    }
    settings.streams = streams
  }

  if (raw.pinned && typeof raw.pinned === 'object') {
    const pinned: Record<string, boolean> = {}
    for (const [id, pinnedValue] of Object.entries(raw.pinned as Record<string, unknown>)) {
      if (typeof pinnedValue === 'boolean') pinned[id] = pinnedValue
    }
    settings.pinned = pinned
  }

  return settings
}

/** Settings are cached in memory: window move/resize events never hit the disk. */
export function readSettings(): WindowSettings {
  if (cache) return cache

  try {
    const path = settingsPath()
    cache = existsSync(path) ? sanitizeSettings(JSON.parse(readFileSync(path, 'utf8'))) : {}
  } catch (error) {
    console.error('[MultiView] Unable to read window layout:', error)
    cache = {}
  }

  return cache
}

/** Mutates the in-memory settings and schedules one debounced, atomic write. */
export function updateSettings(mutator: (settings: WindowSettings) => void): void {
  mutator(readSettings())

  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = undefined
    flushSettings()
  }, WRITE_DELAY_MS)
}

export function setPinned(id: string, pinned: boolean): void {
  updateSettings((settings) => {
    settings.pinned ??= {}
    settings.pinned[id] = pinned
  })
}

export function isPinned(id: string): boolean {
  return readSettings().pinned?.[id] ?? true
}

export function clearStreamLayout(id: string): void {
  updateSettings((settings) => {
    if (settings.streams) delete settings.streams[id]
    if (settings.pinned) delete settings.pinned[id]
  })
}

export function resetLayout(): void {
  updateSettings((settings) => {
    delete settings.streams
    delete settings.pinned
  })
}

/** Writes to a temporary file first so a crash can never truncate the layout. */
export function flushSettings(): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = undefined
  }

  if (!cache) return

  try {
    const directory = app.getPath('userData')
    const path = settingsPath()
    const temporaryPath = `${path}.tmp`

    mkdirSync(directory, { recursive: true })
    writeFileSync(temporaryPath, JSON.stringify(cache, null, 2), 'utf8')
    renameSync(temporaryPath, path)
  } catch (error) {
    console.error('[MultiView] Unable to save window layout:', error)
  }
}
