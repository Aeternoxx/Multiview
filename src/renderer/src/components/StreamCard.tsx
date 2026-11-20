import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { AudioState, Stream } from '@shared/types'
import { useI18n, type TranslationKey } from '../i18n'
import { useWhepPlayer } from '../hooks/useWhepPlayer'
import { describeWhepError } from '../lib/errors'
import type { TileSize } from '../lib/storage'
import type { WhepStatus } from '../lib/whep'
import { setAvailability, type Availability } from '../lib/availability'
import { invalidateProbeCache } from '../lib/probe'
import { AudioControls } from './AudioControls'
import { Icon } from './Icon'
import { StatsPanel } from './StatsPanel'

type StreamCardProps = {
  stream: Stream
  audio: AudioState
  solo: boolean
  size?: TileSize
  aspectRatio?: number
  iceServers: RTCIceServer[]
  onStop: (id: string) => void
  onUnavailable: (id: string) => void
  onDetach: (stream: Stream) => void
  onAudioChange: (id: string, audio: AudioState) => void
  onSolo: (id: string) => void
  onAspectRatio: (id: string, ratio: number) => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void
}

function statusKey(status: WhepStatus): TranslationKey {
  switch (status) {
    case 'connecting':
      return 'stream.status.connecting'
    case 'negotiating':
      return 'stream.status.negotiating'
    case 'waiting':
      return 'stream.status.waiting'
    case 'live':
      return 'stream.status.live'
    case 'disconnected':
      return 'stream.status.disconnected'
    case 'error':
      return 'stream.status.error'
    default:
      return 'stream.status.stopped'
  }
}

function availabilityLabel(availability: Availability): TranslationKey {
  if (availability === 'online') return 'availability.online'
  if (availability === 'offline') return 'availability.offline'
  return 'availability.checking'
}

/**
 * Live view tile: a single playing stream. Unlike the old mixed card, it only
 * exists while the stream runs; management (edit, delete, availability) lives
 * in the Library. The name chip replaces the header block to keep the video
 * surface as large as possible.
 */
export function StreamCard({
  stream,
  audio,
  solo,
  size,
  aspectRatio,
  iceServers,
  onStop,
  onUnavailable,
  onDetach,
  onAudioChange,
  onSolo,
  onAspectRatio,
  onResizeStart
}: StreamCardProps): React.JSX.Element {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleUnavailable = useCallback((): void => {
    // Reconnection failed for the whole window: forget any previous "online"
    // result and let the background probe decide whether the stream is still
    // published, then return the tile to the Library's stopped state.
    invalidateProbeCache(stream.url)
    setAvailability(stream.url, 'checking')
    onUnavailable(stream.id)
  }, [stream.url, stream.id, onUnavailable])

  const { status, error, stats, retry } = useWhepPlayer({
    url: stream.url,
    active: true,
    iceServers,
    videoRef,
    onUnavailable: handleUnavailable
  })

  useEffect(() => {
    // Presence is unknown while the stream is playing; never reuse a probe
    // result from before playback when the tile stops again.
    invalidateProbeCache(stream.url)
  }, [stream.url])

  const [hasVideo, setHasVideo] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = audio.volume / 100
    video.muted = audio.muted
  }, [audio.volume, audio.muted])

  useEffect(() => {
    const onChange = (): void =>
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const dotState: Availability =
    status === 'live' ? 'online' : status === 'error' ? 'offline' : 'checking'

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen()
      else await containerRef.current?.requestFullscreen()
    } catch (consoleError) {
      console.error('[MultiView] Fullscreen failed:', consoleError)
    }
  }

  return (
    <article className="stream-card live-card">
      <div
        className={`video-container${size ? ' sized-video-container' : ''}`}
        style={!size && aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
        ref={containerRef}
      >
        <video
          ref={videoRef}
          className="stream-video"
          autoPlay
          playsInline
          muted={audio.muted}
          onClick={() => {
            if (videoRef.current) void videoRef.current.play()
          }}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              onAspectRatio(stream.id, video.videoWidth / video.videoHeight)
            }
          }}
          onLoadedData={() => setHasVideo(true)}
          onEmptied={() => setHasVideo(false)}
        />

        <div className="live-name">
          <span className={`availability-dot ${dotState}`} title={t(availabilityLabel(dotState))} />
          <span className="live-name-text">{stream.name}</span>
          <span className="live-status">{t(statusKey(status))}</span>
        </div>

        {(!hasVideo || status !== 'live') && (
          <div className="player-overlay">
            <span className="video-symbol">
              <Icon
                name={status === 'error' ? 'offline' : 'spinner'}
                size={20}
                className={status === 'error' ? undefined : 'icon-spin'}
              />
            </span>
            <span className="overlay-title">{t(statusKey(status))}</span>
            {error && (
              <p className="player-error" title={error.message}>
                {describeWhepError(error, t)}
              </p>
            )}
            {(status === 'error' || status === 'disconnected') && (
              <button className="overlay-action" onClick={retry}>
                <Icon name="refresh" size={14} />
                {t('stream.retry')}
              </button>
            )}
          </div>
        )}

        <div className="view-controls">
          <button type="button" onClick={() => onStop(stream.id)} title={t('stream.stop')}>
            <Icon name="stop" size={14} />
            <span>{t('stream.stop')}</span>
          </button>

          <button
            type="button"
            className={showStats ? 'active' : undefined}
            onClick={() => setShowStats((value) => !value)}
            title={t('stream.stats')}
            aria-label={t('stream.stats')}
            aria-pressed={showStats}
          >
            <Icon name="stats" size={15} />
          </button>

          <button
            type="button"
            onClick={() => onDetach(stream)}
            title={t('stream.detachTitle')}
            aria-label={t('stream.detach')}
          >
            <Icon name="detach" size={15} />
          </button>

          <button type="button" onClick={() => void toggleFullscreen()}>
            <Icon name={isFullscreen ? 'exitFullscreen' : 'fullscreen'} size={14} />
            <span>{isFullscreen ? t('stream.exitFullscreen') : t('stream.fullscreen')}</span>
          </button>
        </div>

        {showStats && <StatsPanel stats={stats} />}

        <AudioControls
          name={stream.name}
          audio={audio}
          onChange={(next) => onAudioChange(stream.id, next)}
          onSolo={() => onSolo(stream.id)}
          solo={solo}
        />
      </div>

      <button
        type="button"
        className="resize-grip"
        aria-label={t('stream.resize', { name: stream.name })}
        title={t('stream.resizeHint')}
        onPointerDown={(event) => onResizeStart(event, stream.id)}
      />
    </article>
  )
}
