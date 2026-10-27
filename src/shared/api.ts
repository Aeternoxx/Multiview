import type { AppState, AudioState, ImportedStreams, Stream, StreamWindowPayload } from './types'

export type StreamAudioUpdate = AudioState & { id: string }

export type MultiviewApi = {
  getAppState: () => Promise<AppState>
  setMainMinimumWidth: (width: number) => Promise<void>
  openStreamWindow: (stream: StreamWindowPayload) => Promise<void>
  closeStreamWindow: (id: string) => Promise<void>
  returnToApp: (id: string) => Promise<void>
  setStreamWindowAspectRatio: (id: string, ratio: number) => Promise<void>
  setStreamWindowPinned: (id: string, pinned: boolean) => Promise<void>
  toggleStreamWindowFullscreen: (id: string) => Promise<void>
  updateStreamAudio: (id: string, audio: AudioState) => Promise<void>
  forgetStreamLayout: (id: string) => Promise<void>
  resetWindowLayout: () => Promise<void>
  exportStreams: (streams: Stream[]) => Promise<boolean>
  importStreams: () => Promise<ImportedStreams | null>
  onStreamWindowClosed: (callback: (id: string) => void) => () => void
  onStreamWindowReturned: (callback: (id: string) => void) => () => void
  onStreamAudioUpdated: (callback: (update: StreamAudioUpdate) => void) => () => void
  onStreamWindowHover: (callback: (hovered: boolean) => void) => () => void
}
