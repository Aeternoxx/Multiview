export type StreamId = string

export type Stream = {
  id: StreamId
  name: string
  url: string
}

export type AudioState = {
  volume: number
  muted: boolean
}

export type StreamWindowPayload = {
  id: StreamId
  name: string
  url: string
  volume: number
  muted: boolean
  pinned?: boolean
}

export type PopupQuery = {
  streamPopup: '1'
  streamId: StreamId
  streamName: string
  streamUrl: string
  streamVolume: string
  streamMuted: '1' | '0'
  streamPinned: '1' | '0'
}

export type ImportedStreams = {
  streams: Stream[]
  skipped: number
}

export type AppState = {
  version: string
}

export const STREAM_ID_MAX_LENGTH = 120
export const STREAM_NAME_MAX_LENGTH = 80
