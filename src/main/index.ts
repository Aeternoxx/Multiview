import { app, dialog, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { STREAM_NAME_MAX_LENGTH } from '../shared/types'
import type { AudioState, ImportedStreams, Stream, StreamWindowPayload } from '../shared/types'
import { flushSettings, resetLayout } from './settings'
import {
  closeAllStreamWindows,
  closeStreamWindow,
  createMainWindow,
  forgetStreamLayout,
  getMainWindow,
  openStreamWindow,
  returnStreamToApp,
  sendToMain,
  setMainMinimumWidth,
  setStreamAspectRatio,
  setStreamPinned,
  toggleStreamFullscreen
} from './windows'

const APP_USER_MODEL_ID = 'com.aeternoxx.multiview'

function sanitizeName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const name = value.replace(/\s+/g, ' ').trim()
  return name ? name.slice(0, STREAM_NAME_MAX_LENGTH) : fallback
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false

  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function sanitizeImportedStreams(value: unknown): ImportedStreams {
  const rawList = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { streams?: unknown }).streams)
      ? ((value as { streams: unknown[] }).streams as unknown[])
      : []

  const streams: Stream[] = []
  const seenUrls = new Set<string>()
  const seenIds = new Set<string>()
  let skipped = 0

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      skipped += 1
      continue
    }

    const candidate = item as Record<string, unknown>
    const url = typeof candidate.url === 'string' ? candidate.url.trim() : ''

    if (!isHttpUrl(url) || seenUrls.has(url)) {
      skipped += 1
      continue
    }

    let id = typeof candidate.id === 'string' && candidate.id ? candidate.id : randomUUID()
    if (seenIds.has(id)) id = randomUUID()

    seenUrls.add(url)
    seenIds.add(id)
    streams.push({ id, name: sanitizeName(candidate.name, `Flux ${streams.length + 1}`), url })
  }

  return { streams, skipped }
}

async function exportStreams(streams: unknown): Promise<boolean> {
  const { streams: safeStreams } = sanitizeImportedStreams(streams)
  const window = getMainWindow()
  const options: Electron.SaveDialogOptions = {
    title: 'Exporter les flux — MultiView',
    defaultPath: 'multiview-streams.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  }

  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)

  if (result.canceled || !result.filePath) return false

  try {
    await writeFile(
      result.filePath,
      JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), streams: safeStreams },
        null,
        2
      ),
      'utf8'
    )
    return true
  } catch (error) {
    console.error('[MultiView] Unable to export streams:', error)
    return false
  }
}

async function importStreams(): Promise<ImportedStreams | null> {
  const window = getMainWindow()
  const options: Electron.OpenDialogOptions = {
    title: 'Importer des flux — MultiView',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  }

  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)

  const filePath = result.filePaths[0]
  if (result.canceled || !filePath) return null

  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
    return sanitizeImportedStreams(parsed)
  } catch (error) {
    console.error('[MultiView] Unable to import streams:', error)
    return { streams: [], skipped: 1 }
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('get-app-state', () => ({
    version: app.getVersion()
  }))

  ipcMain.handle('set-main-minimum-width', (_event, width: unknown) => {
    if (typeof width === 'number') setMainMinimumWidth(width)
  })

  ipcMain.handle('open-stream-window', (_event, payload: StreamWindowPayload) => {
    openStreamWindow(payload)
  })

  ipcMain.handle('close-stream-window', (_event, id: unknown) => {
    if (typeof id === 'string') closeStreamWindow(id)
  })

  ipcMain.handle('return-stream-to-app', (_event, id: unknown) => {
    if (typeof id === 'string') returnStreamToApp(id)
  })

  ipcMain.handle('set-stream-window-aspect-ratio', (_event, id: unknown, ratio: unknown) => {
    if (typeof id === 'string' && typeof ratio === 'number') setStreamAspectRatio(id, ratio)
  })

  ipcMain.handle('set-stream-window-pinned', (_event, id: unknown, pinned: unknown) => {
    if (typeof id === 'string' && typeof pinned === 'boolean') setStreamPinned(id, pinned)
  })

  ipcMain.handle('toggle-stream-window-fullscreen', (_event, id: unknown) => {
    if (typeof id === 'string') toggleStreamFullscreen(id)
  })

  ipcMain.handle('update-stream-audio', (_event, id: unknown, audio: AudioState) => {
    if (typeof id !== 'string' || !audio || typeof audio !== 'object') return

    const volume = Number(audio.volume)
    if (!Number.isFinite(volume)) return

    sendToMain('stream-audio-updated', {
      id,
      volume: Math.min(100, Math.max(0, volume)),
      muted: audio.muted === true
    })
  })

  ipcMain.handle('forget-stream-layout', (_event, id: unknown) => {
    if (typeof id === 'string') forgetStreamLayout(id)
  })

  ipcMain.handle('reset-window-layout', () => {
    resetLayout()
  })

  ipcMain.handle('export-streams', (_event, streams: unknown) => exportStreams(streams))

  ipcMain.handle('import-streams', () => importStreams())
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = getMainWindow()
    if (!window) return

    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })

  registerIpcHandlers()

  app.whenReady().then(() => {
    electronApp.setAppUserModelId(APP_USER_MODEL_ID)

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createMainWindow()

    app.on('activate', () => {
      if (!getMainWindow()) createMainWindow()
    })
  })

  app.on('before-quit', () => {
    flushSettings()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      closeAllStreamWindows()
      app.quit()
    }
  })
}
