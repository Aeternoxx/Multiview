import { ElectronAPI } from '@electron-toolkit/preload'

type StreamWindowPayload = { id: number; name: string; url: string }

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openStreamWindow: (stream: StreamWindowPayload) => Promise<void>
      closeStreamWindow: (id: number) => Promise<void>
      returnToApp: (id: number) => Promise<void>
      setStreamWindowAspectRatio: (id: number, ratio: number) => Promise<void>
      onStreamWindowClosed: (callback: (id: number) => void) => () => void
      onStreamWindowReturned: (callback: (id: number) => void) => () => void
    }
  }
}
