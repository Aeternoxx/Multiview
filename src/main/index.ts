import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

type StreamWindowPayload = {
  id: number
  name: string
  url: string
}

const streamWindows = new Map<number, BrowserWindow>()

type SavedBounds = { x?: number; y?: number; width: number; height: number }
type WindowSettings = { main?: SavedBounds; streams?: Record<string, SavedBounds> }

const settingsPath = join(app.getPath('userData'), 'window-layout.json')

function readWindowSettings(): WindowSettings {
  try {
    return existsSync(settingsPath)
      ? (JSON.parse(readFileSync(settingsPath, 'utf8')) as WindowSettings)
      : {}
  } catch {
    return {}
  }
}

function saveWindowSettings(settings: WindowSettings): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
  } catch (error) {
    console.error('Unable to save window layout', error)
  }
}

function safeBounds(bounds: SavedBounds | undefined, fallback: SavedBounds): SavedBounds {
  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    return fallback
  }

  const displays = screen.getAllDisplays()
  const x = Number.isFinite(bounds.x) ? bounds.x! : 80
  const y = Number.isFinite(bounds.y) ? bounds.y! : 80

  const visible = displays.some(
    (d) =>
      x < d.workArea.x + d.workArea.width &&
      x + bounds.width > d.workArea.x &&
      y < d.workArea.y + d.workArea.height &&
      y + bounds.height > d.workArea.y
  )

  return visible ? { x, y, width: bounds.width, height: bounds.height } : fallback
}

const streamAspectRatios = new Map<number, number>()
let mainWindow: BrowserWindow | null = null

function closeStreamWindows(): void {
  for (const popup of streamWindows.values()) {
    if (!popup.isDestroyed()) {
      popup.destroy()
    }
  }

  streamWindows.clear()
  streamAspectRatios.clear()
}

function loadStreamWindow(window: BrowserWindow, stream: StreamWindowPayload): void {
  const query = {
    streamPopup: '1',
    streamId: String(stream.id),
    streamName: stream.name,
    streamUrl: stream.url,
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
}

function createWindow(): void {
  const saved = readWindowSettings()
  const bounds = safeBounds(saved.main, { width: 1100, height: 780 })

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const persistMain = () => {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.isMinimized() ||
      mainWindow.isMaximized()
    ) {
      return
    }

    const settings = readWindowSettings()
    settings.main = mainWindow.getBounds()
    saveWindowSettings(settings)
  }

  mainWindow.on('move', persistMain)
  mainWindow.on('resize', persistMain)

  mainWindow.on('closed', () => {
    persistMain()
    mainWindow = null

    // Closing the main window exits the application on Windows and Linux.
    if (process.platform !== 'darwin') {
      closeStreamWindows()
      app.quit()
    }
  })
}

ipcMain.handle('open-stream-window', (_event, stream: StreamWindowPayload) => {
  if (
    !stream ||
    typeof stream.id !== 'number' ||
    typeof stream.name !== 'string' ||
    typeof stream.url !== 'string'
  ) {
    throw new Error('Informations du flux invalides')
  }

  const existing = streamWindows.get(stream.id)

  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const savedLayout = readWindowSettings()
  const popupBounds = safeBounds(savedLayout.streams?.[String(stream.id)], {
    width: 800,
    height: 520,
  })

  const popup = new BrowserWindow({
    ...popupBounds,
    minWidth: 360,
    minHeight: 260,
    frame: false,
    title: stream.name,
    backgroundColor: '#050609',
    useContentSize: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  // Keep detached video windows above other applications, including games.
  popup.setAlwaysOnTop(true, 'screen-saver')

  popup.on('show', () => {
    if (!popup.isDestroyed()) {
      popup.setAlwaysOnTop(true, 'screen-saver')
    }
  })

  streamWindows.set(stream.id, popup)

  const persistPopup = () => {
    if (popup.isDestroyed() || popup.isMinimized()) return

    const settings = readWindowSettings()
    settings.streams ??= {}
    settings.streams[String(stream.id)] = popup.getBounds()
    saveWindowSettings(settings)
  }

  popup.on('move', persistPopup)
  popup.on('resize', persistPopup)
  popup.on('page-title-updated', (event) => event.preventDefault())

  popup.on('closed', () => {
    if (streamWindows.get(stream.id) === popup) {
      streamWindows.delete(stream.id)
    }

    streamAspectRatios.delete(stream.id)

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stream-window-closed', stream.id)
    }
  })

  loadStreamWindow(popup, stream)
})

ipcMain.handle('close-stream-window', (_event, id: number) => {
  const popup = streamWindows.get(id)

  if (popup && !popup.isDestroyed()) {
    popup.close()
  }
})

ipcMain.handle('return-stream-to-app', (_event, id: number) => {
  const popup = streamWindows.get(id)

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stream-window-returned', id)
  }

  if (popup && !popup.isDestroyed()) {
    popup.close()
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

ipcMain.handle('set-stream-window-aspect-ratio', (_event, id: number, ratio: number) => {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < 0.2 || ratio > 5) {
    return
  }

  const popup = streamWindows.get(id)

  if (!popup || popup.isDestroyed()) return

  streamAspectRatios.set(id, ratio)

  let bounds = popup.getBounds()
  const targetHeight = Math.max(180, Math.round(bounds.width / ratio))

  if (Math.abs(bounds.height - targetHeight) > 2) {
    popup.setSize(bounds.width, targetHeight)
    bounds = popup.getBounds()
  }

  popup.removeAllListeners('resize')

  popup.on('resize', () => {
    if (popup.isDestroyed()) return

    const current = popup.getBounds()
    const currentRatio = streamAspectRatios.get(id)

    if (!currentRatio) return

    if (Math.abs(current.width / current.height - currentRatio) < 0.015) {
      bounds = current
      return
    }

    const widthChange =
      Math.abs(current.width - bounds.width) / Math.max(1, bounds.width)
    const heightChange =
      Math.abs(current.height - bounds.height) / Math.max(1, bounds.height)

    const nextWidth =
      widthChange >= heightChange
        ? current.width
        : Math.max(320, Math.round(current.height * currentRatio))

    const nextHeight =
      widthChange >= heightChange
        ? Math.max(180, Math.round(current.width / currentRatio))
        : current.height

    popup.setSize(nextWidth, nextHeight)
    bounds = { ...current, width: nextWidth, height: nextHeight }
  })
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.multiview')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  closeStreamWindows()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})