import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type StreamWindowPayload = { id: number; name: string; url: string }

const api = {
  openStreamWindow: (stream: StreamWindowPayload): Promise<void> => ipcRenderer.invoke('open-stream-window', stream),
  closeStreamWindow: (id: number): Promise<void> => ipcRenderer.invoke('close-stream-window', id),
  returnToApp: (id: number): Promise<void> => ipcRenderer.invoke('return-stream-to-app', id),
  setStreamWindowAspectRatio: (id: number, ratio: number): Promise<void> => ipcRenderer.invoke('set-stream-window-aspect-ratio', id, ratio),
  onStreamWindowReturned: (callback: (id: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: number) => callback(id)
    ipcRenderer.on('stream-window-returned', listener)
    return () => ipcRenderer.removeListener('stream-window-returned', listener)
  },
  onStreamWindowClosed: (callback: (id: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: number) => callback(id)
    ipcRenderer.on('stream-window-closed', listener)
    return () => ipcRenderer.removeListener('stream-window-closed', listener)
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) { console.error(error) }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
