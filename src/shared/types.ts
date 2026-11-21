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

/** Where the auto-updater currently is; drives the footer pill. */
export type UpdatePhase = 'idle' | 'available' | 'downloading' | 'ready' | 'error'

export type UpdateState = {
  phase: UpdatePhase
  /** Published version, without the leading `v` (for example `1.2.5`). */
  version: string
  /** Download progress in percent, `0` while nothing moves. */
  percent: number
  /** Release page: the way out whenever the updater cannot do the install. */
  releaseUrl: string
  /** Why the last attempt failed, shown in the pill tooltip only. */
  error: string | null
}

export const STREAM_ID_MAX_LENGTH = 120
export const STREAM_NAME_MAX_LENGTH = 80
