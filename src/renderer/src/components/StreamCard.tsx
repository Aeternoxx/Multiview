import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AudioState, Stream } from '@shared/types'
import { useI18n, type TranslationKey } from '../i18n'
import { useStreamAvailability } from '../hooks/useStreamAvailability'
import { useWhepPlayer } from '../hooks/useWhepPlayer'
import { describeWhepError } from '../lib/errors'
import type { TileSize } from '../lib/storage'
import type { WhepStatus } from '../lib/whep'
import type { Availability } from '../lib/availability'
import { AudioControls } from './AudioControls'
import { Icon } from './Icon'
import { StatsPanel } from './StatsPanel'

type StreamCardProps = {
  stream: Stream
  running: boolean
  audio: AudioState
  solo: boolean
  size?: TileSize
  aspectRatio?: number
  iceServers: RTCIceServer[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onEdit: (stream: Stream) => void
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

export function StreamCard({
  stream,
  running,
  audio,
  solo,
  size,
  aspectRatio,
  iceServers,
  onToggle,
  onRemove,
  onEdit,
  onDetach,
  onAudioChange,
  onSolo,
  onAspectRatio,
  onResizeStart
}: StreamCardProps): React.JSX.Element {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { status, error, stats, retry } = useWhepPlayer({
    url: stream.url,
    active: running,
    iceServers,
    videoRef
  })
  const availability = useStreamAvailability({
    url: stream.url,
    enabled: !running,
    iceServers
  })

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

  const dotState: Availability = running
    ? status === 'live'
      ? 'online'
      : status === 'error'
        ? 'offline'
        : 'checking'
    : availability

  // Playback is only allowed once the stream has been detected.
  const startBlocked = !running && availability === 'offline'
  const startLabel = running
    ? t('stream.stop')
    : startBlocked
      ? t('stream.startUnavailable')
      : t('stream.start')

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen()
      else await containerRef.current?.requestFullscreen()
    } catch (consoleError) {
      console.error('[MultiView] Fullscreen failed:', consoleError)
    }
  }

  const statusText = running
    ? t(statusKey(status))
    : `${t('stream.status.stopped')} · ${t(
        availability === 'online'
          ? 'stream.status.online'
          : availability === 'offline'
            ? 'stream.status.offline'
            : 'stream.status.checking'
      )}`

  return (
    <article className="stream-card">
      <div className="stream-info">
        <div className="stream-details">
          <h3>{stream.name}</h3>
          <p title={stream.url}>{stream.url}</p>

          <div className="status-line">
            <span
              className={`availability-dot ${dotState}`}
              title={t(availabilityLabel(dotState))}
            />
            <span className="stream-status">{statusText}</span>
          </div>

          {error && running && (
            <p className="player-error inline-error" title={error.message}>
              {describeWhepError(error, t)}
            </p>
          )}
        </div>

        <div className="stream-actions">
          <button
            className="icon-button"
            onClick={() => onToggle(stream.id)}
            disabled={startBlocked}
            title={startLabel}
            aria-label={startLabel}
          >
            <Icon name={running ? 'stop' : 'play'} size={18} />
          </button>

          {running && (
            <button
              className={`icon-button${showStats ? ' active' : ''}`}
              onClick={() => setShowStats((value) => !value)}
              title={t('stream.stats')}
              aria-label={t('stream.stats')}
              aria-pressed={showStats}
            >
              <Icon name="stats" size={15} />
            </button>
          )}

          <button
            className="icon-button"
            onClick={() => onEdit(stream)}
            title={t('stream.edit')}
            aria-label={t('stream.edit')}
          >
            <Icon name="edit" size={15} />
          </button>

          <button
            className="icon-button"
            onClick={() => onDetach(stream)}
            disabled={startBlocked}
            title={startBlocked ? t('stream.detachUnavailable') : t('stream.detachTitle')}
            aria-label={t('stream.detach')}
          >
            <Icon name="detach" size={15} />
          </button>

          <button
            className="delete-button"
            onClick={() => onRemove(stream.id)}
            title={t('stream.delete')}
            aria-label={t('stream.deleteLabel', { name: stream.name })}
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
      </div>

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
            if (videoRef.current && running) void videoRef.current.play()
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

        {!running && (
          <div
            className={`player-overlay idle-overlay${availability === 'offline' ? ' is-offline' : ''}`}
          >
            <span className="video-symbol">
              <Icon
                name={
                  availability === 'online'
                    ? 'play'
                    : availability === 'offline'
                      ? 'offline'
                      : 'spinner'
                }
                size={20}
                className={availability === 'checking' ? 'icon-spin' : undefined}
              />
            </span>

            <span className="overlay-title">{t(availabilityLabel(availability))}</span>

            {availability === 'offline' && (
              <span className="overlay-hint">{t('stream.offlineHint')}</span>
            )}

            {availability === 'online' && (
              <button className="overlay-action" onClick={() => onToggle(stream.id)}>
                <Icon name="play" size={14} />
                {t('stream.start')}
              </button>
            )}
          </div>
        )}

        {running && (!hasVideo || status !== 'live') && (
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
          <button type="button" onClick={() => void toggleFullscreen()}>
            <Icon name={isFullscreen ? 'exitFullscreen' : 'fullscreen'} size={14} />
            {isFullscreen ? t('stream.exitFullscreen') : t('stream.fullscreen')}
          </button>
        </div>

        {running && showStats && <StatsPanel stats={stats} />}

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
