import { useEffect, useMemo, useRef, useState } from 'react'
import type { AudioState, Stream } from '@shared/types'
import { useI18n, type TranslationKey } from '../i18n'
import { useWhepPlayer } from '../hooks/useWhepPlayer'
import { describeWhepError } from '../lib/errors'
import { DEFAULT_ICE_CONFIG, parseIceConfig, toIceServers } from '../lib/ice'
import { readJson, STORAGE_KEYS } from '../lib/storage'
import type { WhepStatus } from '../lib/whep'
import { AudioControls } from './AudioControls'
import { Icon } from './Icon'
import { StatsPanel } from './StatsPanel'

type PopupAppProps = {
  params: URLSearchParams
}

export function PopupApp({ params }: PopupAppProps): React.JSX.Element {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasVideo, setHasVideo] = useState(false)

  const stream = useMemo<Stream>(
    () => ({
      id: params.get('streamId') || 'popup',
      name: params.get('streamName') || 'MultiView',
      url: params.get('streamUrl') || ''
    }),
    [params]
  )

  const iceServers = useMemo(
    () => toIceServers(readJson(STORAGE_KEYS.ice, parseIceConfig, DEFAULT_ICE_CONFIG)),
    []
  )

  const initialVolume = Number(params.get('streamVolume') ?? 70)

  const [audio, setAudio] = useState<AudioState>({
    volume: Number.isFinite(initialVolume) ? Math.min(100, Math.max(0, initialVolume)) : 70,
    muted: params.get('streamMuted') !== '0'
  })
  const [pinned, setPinned] = useState(params.get('streamPinned') !== '0')
  const [showStats, setShowStats] = useState(false)
  const [hovered, setHovered] = useState(false)

  const { status, error, stats, retry } = useWhepPlayer({
    url: stream.url,
    active: Boolean(stream.url),
    iceServers,
    videoRef
  })

  useEffect(() => {
    document.title = stream.name
  }, [stream.name])

  // The whole window is a native drag region, so hover is reported by the main
  // process (see pollStreamWindowHover) instead of relying on mouse events.
  useEffect(() => window.api.onStreamWindowHover(setHovered), [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.volume = audio.volume / 100
    video.muted = audio.muted
  }, [audio.volume, audio.muted])

  useEffect(() => {
    void window.api.updateStreamAudio(stream.id, audio)
  }, [stream.id, audio])

  const togglePinned = (): void => {
    const next = !pinned
    setPinned(next)
    void window.api.setStreamWindowPinned(stream.id, next)
  }

  const showOverlay = status !== 'live' || !hasVideo

  return (
    <main className="popup-app">
      <div className={`popup-player${hovered ? ' is-hovered' : ''}`}>
        <video
          ref={videoRef}
          className="stream-video"
          autoPlay
          playsInline
          muted={audio.muted}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              void window.api.setStreamWindowAspectRatio(
                stream.id,
                video.videoWidth / video.videoHeight
              )
            }
          }}
          onLoadedData={() => setHasVideo(true)}
          onEmptied={() => setHasVideo(false)}
        />

        {showOverlay && (
          <div className="player-overlay popup-overlay">
            <span className="video-symbol">
              <Icon
                name={status === 'error' ? 'offline' : 'spinner'}
                size={20}
                className={status === 'error' ? undefined : 'icon-spin'}
              />
            </span>
            <span className="overlay-title">{t(statusKeyFor(status))}</span>
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

        <div className="popup-topbar">
          <button
            className="popup-return-button"
            onClick={() => void window.api.returnToApp(stream.id)}
          >
            <Icon name="back" size={14} />
            {t('stream.detached.return')}
          </button>

          <div className="popup-window-actions">
            <button
              className={showStats ? 'active' : ''}
              onClick={() => setShowStats((value) => !value)}
              title={t('stream.stats')}
              aria-label={t('stream.stats')}
              aria-pressed={showStats}
            >
              <Icon name="stats" size={15} />
            </button>
            <button
              className={pinned ? 'active' : ''}
              onClick={togglePinned}
              title={pinned ? t('stream.unpin') : t('stream.pin')}
              aria-label={pinned ? t('stream.unpin') : t('stream.pin')}
              aria-pressed={pinned}
            >
              <Icon name="pin" size={15} />
            </button>
            <button
              onClick={() => void window.api.toggleStreamWindowFullscreen(stream.id)}
              title={t('stream.fullscreen')}
              aria-label={t('stream.fullscreen')}
            >
              <Icon name="fullscreen" size={15} />
            </button>
            <button
              className="popup-close"
              onClick={() => void window.api.closeStreamWindow(stream.id)}
              title={t('stream.closeWindow')}
              aria-label={t('stream.closeWindow')}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        </div>

        {showStats && <StatsPanel stats={stats} />}

        <AudioControls name={stream.name} audio={audio} onChange={setAudio} compact />
      </div>
    </main>
  )
}

function statusKeyFor(status: WhepStatus): TranslationKey {
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
