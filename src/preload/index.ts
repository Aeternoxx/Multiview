import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { MultiviewApi } from '../shared/api'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: MultiviewApi = {
  getAppState: () => ipcRenderer.invoke('get-app-state'),
  setMainMinimumWidth: (width) => ipcRenderer.invoke('set-main-minimum-width', width),
  openStreamWindow: (stream) => ipcRenderer.invoke('open-stream-window', stream),
  closeStreamWindow: (id) => ipcRenderer.invoke('close-stream-window', id),
  returnToApp: (id) => ipcRenderer.invoke('return-stream-to-app', id),
  setStreamWindowAspectRatio: (id, ratio) =>
    ipcRenderer.invoke('set-stream-window-aspect-ratio', id, ratio),
  setStreamWindowPinned: (id, pinned) => ipcRenderer.invoke('set-stream-window-pinned', id, pinned),
  toggleStreamWindowFullscreen: (id) => ipcRenderer.invoke('toggle-stream-window-fullscreen', id),
  updateStreamAudio: (id, audio) => ipcRenderer.invoke('update-stream-audio', id, audio),
  forgetStreamLayout: (id) => ipcRenderer.invoke('forget-stream-layout', id),
  resetWindowLayout: () => ipcRenderer.invoke('reset-window-layout'),
  exportStreams: (streams) => ipcRenderer.invoke('export-streams', streams),
  importStreams: () => ipcRenderer.invoke('import-streams'),
  onStreamWindowClosed: (callback) => subscribe('stream-window-closed', callback),
  onStreamWindowReturned: (callback) => subscribe('stream-window-returned', callback),
  onStreamAudioUpdated: (callback) => subscribe('stream-audio-updated', callback),
  onStreamWindowHover: (callback) => subscribe('stream-window-hover', callback)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
