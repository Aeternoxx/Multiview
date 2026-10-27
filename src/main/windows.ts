import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { StreamWindowPayload } from '../shared/types'
import { clearStreamLayout, isPinned, readSettings, setPinned, updateSettings } from './settings'

type StreamWindowEntry = {
  window: BrowserWindow
  ratio: number | null
  lastBounds: Electron.Rectangle
  returning: boolean
  hovered: boolean
}

const streamWindows = new Map<string, StreamWindowEntry>()

let mainWindow: BrowserWindow | null = null

/** Main window chassis minimum: wide enough for a default tile and the padding. */
const MAIN_MIN_WIDTH = 720
const MAIN_MIN_HEIGHT = 520

/** The cursor is polled so the popup controls also react over the drag region. */
const HOVER_POLL_MS = 80

let hoverTimer: ReturnType<typeof setInterval> | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function sendToMain(channel: string, ...args: unknown[]): void {
  const window = getMainWindow()
  if (window) window.webContents.send(channel, ...args)
}

function openExternalSafe(rawUrl: string): void {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      void shell.openExternal(parsed.toString())
    }
  } catch {
    // Ignore malformed URLs instead of handing them to the OS.
  }
}

function hardenWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler((details) => {
    openExternalSafe(details.url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const current = window.webContents.getURL()
    if (url === current) return

    const devOrigin = process.env['ELECTRON_RENDERER_URL']
    if (devOrigin && url.startsWith(devOrigin)) return
    if (!devOrigin && url.startsWith('file://')) return

    event.preventDefault()
    openExternalSafe(url)
  })
}

function safeBounds(
  bounds: { x?: number; y?: number; width: number; height: number } | undefined,
  fallback: { x?: number; y?: number; width: number; height: number }
): Electron.Rectangle {
  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    return { ...fallback, x: fallback.x ?? 80, y: fallback.y ?? 80 }
  }

  const displays = screen.getAllDisplays()
  const x = Number.isFinite(bounds.x) ? (bounds.x as number) : 80
  const y = Number.isFinite(bounds.y) ? (bounds.y as number) : 80

  const visible = displays.some(
    (display) =>
      x < display.workArea.x + display.workArea.width &&
      x + bounds.width > display.workArea.x &&
      y < display.workArea.y + display.workArea.height &&
      y + bounds.height > display.workArea.y
  )

  return visible
    ? { x, y, width: Math.round(bounds.width), height: Math.round(bounds.height) }
    : { ...fallback, x: fallback.x ?? 80, y: fallback.y ?? 80 }
}

function loadRenderer(window: BrowserWindow, query?: Record<string, string>): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']

  if (is.dev && devUrl) {
    const url = new URL(devUrl)
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value)
    void window.loadURL(url.toString())
    return
  }

  void window.loadFile(join(__dirname, '../renderer/index.html'), query ? { query } : undefined)
}

export function createMainWindow(): BrowserWindow {
  const bounds = safeBounds(readSettings().main, { width: 1100, height: 780 })

  const window = new BrowserWindow({
    ...bounds,
    minWidth: MAIN_MIN_WIDTH,
    minHeight: MAIN_MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = window
  hardenWindow(window)

  window.on('ready-to-show', () => window.show())

  const persistMain = (): void => {
    if (window.isMinimized() || window.isMaximized() || window.isFullScreen()) return
    updateSettings((settings) => {
      settings.main = window.getBounds()
    })
  }

  window.on('move', persistMain)
  window.on('resize', persistMain)
  window.on('close', persistMain)

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null

    if (process.platform !== 'darwin') {
      closeAllStreamWindows()
    }
  })

  loadRenderer(window)
  return window
}

/**
 * Keeps the main window at least as wide as the widest video tile: a manually
 * frozen tile is then never squeezed again when the window is resized. Capped to
 * the current display so an oversized tile cannot lock the window off-screen.
 */
export function setMainMinimumWidth(width: number): void {
  const window = getMainWindow()
  if (!window || !Number.isFinite(width)) return

  const [, minHeight] = window.getMinimumSize()
  const { workAreaSize } = screen.getDisplayMatching(window.getBounds())
  const nextWidth = Math.round(Math.min(Math.max(width, MAIN_MIN_WIDTH), workAreaSize.width))

  if (nextWidth === window.getMinimumSize()[0]) return

  window.setMinimumSize(nextWidth, minHeight)
}

function persistStreamBounds(entry: StreamWindowEntry, id: string): void {
  if (entry.window.isDestroyed()) return

  updateSettings((settings) => {
    settings.streams ??= {}
    settings.streams[id] = entry.window.getBounds()
  })
}

/**
 * A single resize listener per window keeps the saved position, the saved size
 * and the requested video ratio in sync (previously `removeAllListeners` killed
 * the persistence listener as soon as the video ratio was known).
 */
function enforceRatio(entry: StreamWindowEntry, id: string): void {
  const { window } = entry
  if (window.isDestroyed()) return

  const current = window.getBounds()

  if (!entry.ratio) {
    entry.lastBounds = current
    persistStreamBounds(entry, id)
    return
  }

  const currentRatio = current.width / Math.max(1, current.height)

  if (Math.abs(currentRatio - entry.ratio) <= 0.012) {
    entry.lastBounds = current
    persistStreamBounds(entry, id)
    return
  }

  const widthChange = Math.abs(current.width - entry.lastBounds.width)
  const heightChange = Math.abs(current.height - entry.lastBounds.height)

  const width =
    widthChange >= heightChange
      ? current.width
      : Math.max(320, Math.round(current.height * entry.ratio))
  const height =
    widthChange >= heightChange
      ? Math.max(180, Math.round(current.width / entry.ratio))
      : current.height

  const next = { x: current.x, y: current.y, width, height }
  window.setBounds(next)
  entry.lastBounds = next
  persistStreamBounds(entry, id)
}

export function openStreamWindow(payload: StreamWindowPayload): void {
  if (
    !payload ||
    typeof payload.id !== 'string' ||
    typeof payload.name !== 'string' ||
    typeof payload.url !== 'string'
  ) {
    throw new Error('invalid-stream')
  }

  let protocol: string
  try {
    protocol = new URL(payload.url).protocol
  } catch {
    throw new Error('invalid-stream-url')
  }

  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('invalid-stream-url')
  }

  const existing = streamWindows.get(payload.id)
  if (existing && !existing.window.isDestroyed()) {
    existing.window.show()
    existing.window.focus()
    return
  }

  const bounds = safeBounds(readSettings().streams?.[payload.id], {
    width: 800,
    height: 520
  })

  const pinned = typeof payload.pinned === 'boolean' ? payload.pinned : isPinned(payload.id)
  const volume = Number.isFinite(payload.volume) ? Math.min(100, Math.max(0, payload.volume)) : 70
  const muted = typeof payload.muted === 'boolean' ? payload.muted : true

  const window = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 260,
    frame: false,
    title: payload.name,
    backgroundColor: '#050609',
    icon,
    useContentSize: true,
    autoHideMenuBar: true,
    skipTaskbar: pinned,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const entry: StreamWindowEntry = {
    window,
    ratio: null,
    lastBounds: bounds,
    returning: false,
    hovered: false
  }

  streamWindows.set(payload.id, entry)
  hardenWindow(window)
  startHoverPolling()

  window.setAlwaysOnTop(pinned, 'screen-saver')
  window.setSkipTaskbar(pinned)

  // Keep detached video windows above other applications, including games.
  window.on('show', () => {
    if (!window.isDestroyed() && isPinned(payload.id)) {
      window.setAlwaysOnTop(true, 'screen-saver')
    }
  })

  window.on('move', () => persistStreamBounds(entry, payload.id))
  window.on('resize', () => enforceRatio(entry, payload.id))
  window.on('page-title-updated', (event) => event.preventDefault())

  // The renderer starts with no hover state: force the next poll to send it.
  window.webContents.on('did-finish-load', () => {
    entry.hovered = false
  })

  window.on('closed', () => {
    if (streamWindows.get(payload.id) === entry) {
      streamWindows.delete(payload.id)
    }

    if (streamWindows.size === 0) stopHoverPolling()

    if (!entry.returning && getMainWindow()) {
      sendToMain('stream-window-closed', payload.id)
    }
  })

  loadRenderer(window, {
    streamPopup: '1',
    streamId: payload.id,
    streamName: payload.name,
    streamUrl: payload.url,
    streamVolume: String(volume),
    streamMuted: muted ? '1' : '0',
    streamPinned: pinned ? '1' : '0'
  })
}

export function closeStreamWindow(id: string): void {
  const entry = streamWindows.get(id)
  if (!entry || entry.window.isDestroyed()) return

  entry.window.close()
}

export function returnStreamToApp(id: string): void {
  const entry = streamWindows.get(id)

  if (entry && !entry.window.isDestroyed()) {
    entry.returning = true
    entry.window.close()
  }

  sendToMain('stream-window-returned', id)

  const window = getMainWindow()
  if (window) {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
}

export function setStreamAspectRatio(id: string, ratio: number): void {
  if (!Number.isFinite(ratio) || ratio < 0.2 || ratio > 5) return

  const entry = streamWindows.get(id)
  if (!entry || entry.window.isDestroyed()) return

  entry.ratio = ratio
  const bounds = entry.window.getBounds()
  entry.lastBounds = bounds

  const height = Math.max(180, Math.round(bounds.width / ratio))
  if (Math.abs(bounds.height - height) > 2) {
    entry.window.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height })
  } else {
    persistStreamBounds(entry, id)
  }
}

export function setStreamPinned(id: string, pinned: boolean): void {
  setPinned(id, pinned)

  const entry = streamWindows.get(id)
  if (!entry || entry.window.isDestroyed()) return

  entry.window.setAlwaysOnTop(pinned, 'screen-saver')
  entry.window.setSkipTaskbar(pinned)
}

export function toggleStreamFullscreen(id: string): void {
  const entry = streamWindows.get(id)
  if (!entry || entry.window.isDestroyed()) return

  entry.window.setFullScreen(!entry.window.isFullScreen())
}

export function closeAllStreamWindows(): void {
  stopHoverPolling()

  for (const entry of streamWindows.values()) {
    entry.returning = true
    if (!entry.window.isDestroyed()) entry.window.destroy()
  }

  streamWindows.clear()
}

export function forgetStreamLayout(id: string): void {
  clearStreamLayout(id)
}

/**
 * Frameless stream windows use a native `-webkit-app-region: drag` area, which
 * does not deliver mouse events to the page. The hover state of the popup
 * controls is therefore computed from the real cursor position.
 */
function pollStreamWindowHover(): void {
  const cursor = screen.getCursorScreenPoint()

  for (const entry of streamWindows.values()) {
    const { window } = entry
    if (window.isDestroyed()) continue

    let hovered = false

    if (window.isVisible() && !window.isMinimized()) {
      const bounds = window.getBounds()
      hovered =
        cursor.x >= bounds.x &&
        cursor.x < bounds.x + bounds.width &&
        cursor.y >= bounds.y &&
        cursor.y < bounds.y + bounds.height
    }

    if (hovered === entry.hovered) continue

    entry.hovered = hovered
    window.webContents.send('stream-window-hover', hovered)
  }
}

function startHoverPolling(): void {
  if (hoverTimer) return
  hoverTimer = setInterval(pollStreamWindowHover, HOVER_POLL_MS)
}

function stopHoverPolling(): void {
  if (hoverTimer) clearInterval(hoverTimer)
  hoverTimer = null
}
