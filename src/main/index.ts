import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

type StreamWindowPayload = {
  id: number
  name: string
  url: string
}

const streamWindows = new Map<number, BrowserWindow>()
const streamAspectRatios = new Map<number, number>()
let mainWindow: BrowserWindow | null = null

function loadStreamWindow(window: BrowserWindow, stream: StreamWindowPayload): void {
  const query = {
    streamPopup: '1',
    streamId: String(stream.id),
    streamName: stream.name,
    streamUrl: stream.url,
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
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
  mainWindow.on('closed', () => { mainWindow = null })
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
  if (existing && !existing.isDestroyed()) { existing.focus(); return }

  const popup = new BrowserWindow({
    width: 800,
    height: 520,
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
  // The screen-saver level is the highest always-on-top level supported by Electron.
  popup.setAlwaysOnTop(true, 'screen-saver')
  popup.on('show', () => {
    if (!popup.isDestroyed()) popup.setAlwaysOnTop(true, 'screen-saver')
  })

  streamWindows.set(stream.id, popup)
  popup.on('page-title-updated', (event) => event.preventDefault())
  popup.on('closed', () => {
    if (streamWindows.get(stream.id) === popup) streamWindows.delete(stream.id)
    streamAspectRatios.delete(stream.id)
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('stream-window-closed', stream.id)
  })
  loadStreamWindow(popup, stream)
})


ipcMain.handle('close-stream-window', (_event, id: number) => {
  const popup = streamWindows.get(id)
  if (popup && !popup.isDestroyed()) popup.close()
})

ipcMain.handle('return-stream-to-app', (_event, id: number) => {
  const popup = streamWindows.get(id)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('stream-window-returned', id)
  if (popup && !popup.isDestroyed()) popup.close()
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

ipcMain.handle('set-stream-window-aspect-ratio', (_event, id: number, ratio: number) => {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < 0.2 || ratio > 5) return
  const popup = streamWindows.get(id)
  if (!popup || popup.isDestroyed()) return
  streamAspectRatios.set(id, ratio)
  // Frameless windows have no title bar, so the window ratio can match the video ratio.
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
    if (Math.abs(current.width / current.height - currentRatio) < 0.015) { bounds = current; return }
    const widthChange = Math.abs(current.width - bounds.width) / Math.max(1, bounds.width)
    const heightChange = Math.abs(current.height - bounds.height) / Math.max(1, bounds.height)
    const nextWidth = widthChange >= heightChange ? current.width : Math.max(320, Math.round(current.height * currentRatio))
    const nextHeight = widthChange >= heightChange ? Math.max(180, Math.round(current.width / currentRatio)) : current.height
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
