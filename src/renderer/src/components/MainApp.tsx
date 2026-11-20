import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { AppState, AudioState, Stream } from '@shared/types'
import { useI18n, type TranslationKey } from '../i18n'
import { usePersistentState } from '../hooks/usePersistentState'
import { useUpdateCheck } from '../hooks/useUpdateCheck'
import { newStreamId } from '../lib/id'
import { getAvailability } from '../lib/availability'
import { clearProbeCache } from '../lib/probe'
import { DEFAULT_ICE_CONFIG, parseIceConfig, toIceServers, type IceConfig } from '../lib/ice'
import {
  DEFAULT_AUDIO,
  parseAudioMap,
  parseStreams,
  parseTileSizes,
  STORAGE_KEYS,
  type AudioMap,
  type TileSize
} from '../lib/storage'
import { isDuplicateStreamUrl, normalizeStreamUrl } from '../lib/url'
import { DEFAULT_TILE_WIDTH, MIN_TILE_HEIGHT, MIN_TILE_WIDTH } from '../lib/tiles'
import { ConfirmDialog } from './ConfirmDialog'
import { DetachedCard } from './DetachedCard'
import { EmptyState } from './EmptyState'
import { Footer } from './Footer'
import { Icon } from './Icon'
import { LibraryRow } from './LibraryRow'
import { SettingsDialog } from './SettingsDialog'
import { StreamCard } from './StreamCard'
import { StreamFormDialog } from './StreamFormDialog'
import { TopBar } from './TopBar'

type StreamDialogState = { mode: 'add' } | { mode: 'edit'; stream: Stream }
type View = 'library' | 'live'

const DEFAULT_ASPECT_RATIO = 16 / 9

function nextDefaultName(streams: Stream[]): string {
  const used = new Set<number>()

  for (const stream of streams) {
    const match = /^Flux\s+(\d+)$/i.exec(stream.name)
    if (match) used.add(Number(match[1]))
  }

  let number = 1
  while (used.has(number)) number += 1

  return `Flux ${number}`
}

export function MainApp(): React.JSX.Element {
  const { t } = useI18n()

  const [streams, setStreams] = usePersistentState<Stream[]>(STORAGE_KEYS.streams, parseStreams, [])
  const [tileSizes, setTileSizes] = usePersistentState<Record<string, TileSize>>(
    STORAGE_KEYS.tileSizes,
    parseTileSizes,
    {}
  )
  const [audioMap, setAudioMap] = usePersistentState<AudioMap>(
    STORAGE_KEYS.audio,
    parseAudioMap,
    {}
  )
  const [ice, setIce] = usePersistentState<IceConfig>(
    STORAGE_KEYS.ice,
    parseIceConfig,
    DEFAULT_ICE_CONFIG
  )

  const [runningIds, setRunningIds] = useState<string[]>([])
  const [detachedIds, setDetachedIds] = useState<string[]>([])
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({})
  const [view, setView] = useState<View>('library')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [streamDialog, setStreamDialog] = useState<StreamDialogState | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<Stream | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [appState, setAppState] = useState<AppState>({ version: '' })
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [availabilityTick, setAvailabilityTick] = useState(0)
  const libraryListRef = useRef<HTMLDivElement>(null)
  const liveGridRef = useRef<HTMLDivElement>(null)
  const pendingFitRef = useRef(false)
  const update = useUpdateCheck()

  const iceServers = useMemo(() => toIceServers(ice), [ice])

  // Streams on screen in the Live view: playing tiles and floating windows.
  const liveIds = useMemo(
    () =>
      streams
        .filter((stream) => runningIds.includes(stream.id) || detachedIds.includes(stream.id))
        .map((stream) => stream.id),
    [streams, runningIds, detachedIds]
  )

  const getAudio = useCallback(
    (id: string): AudioState => audioMap[id] ?? DEFAULT_AUDIO,
    [audioMap]
  )

  const updateAudio = useCallback(
    (id: string, audio: AudioState): void => {
      setAudioMap((current) => ({ ...current, [id]: audio }))
    },
    [setAudioMap]
  )

  const unmutedIds = useMemo(
    () => streams.filter((stream) => !getAudio(stream.id).muted).map((stream) => stream.id),
    [streams, getAudio]
  )

  const soloStream = useCallback(
    (id: string): void => {
      setAudioMap((current) => {
        const next: AudioMap = {}

        for (const stream of streams) {
          const audio = current[stream.id] ?? DEFAULT_AUDIO
          next[stream.id] =
            stream.id === id
              ? { volume: audio.volume || 40, muted: false }
              : { ...audio, muted: true }
        }

        return next
      })
    },
    [streams, setAudioMap]
  )

  // The main window may never be narrower than the widest video tile, otherwise
  // a manually resized tile would be squeezed again by the grid.
  const widestTile = useMemo(() => {
    let widest = DEFAULT_TILE_WIDTH

    for (const stream of streams) {
      const width = tileSizes[stream.id]?.width ?? 0
      if (width > widest) widest = width
    }

    return widest
  }, [streams, tileSizes])

  useEffect(() => {
    // Measured from the DOM so the workspace padding and the window frame are
    // taken into account without duplicating CSS values here.
    const grid = view === 'library' ? libraryListRef.current : liveGridRef.current
    const contentWidth = document.documentElement.clientWidth
    const workspaceChrome = grid
      ? Math.max(0, contentWidth - grid.getBoundingClientRect().width)
      : 0
    const frameChrome = Math.max(0, window.outerWidth - window.innerWidth)

    void window.api.setMainMinimumWidth(Math.ceil(widestTile + workspaceChrome + frameChrome))
  }, [widestTile, view])

  useEffect(() => {
    let cancelled = false

    void window.api.getAppState().then((state) => {
      if (!cancelled) setAppState(state)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const offClosed = window.api.onStreamWindowClosed((id) => {
      setDetachedIds((current) => current.filter((item) => item !== id))
      setRunningIds((current) => current.filter((item) => item !== id))
    })

    const offReturned = window.api.onStreamWindowReturned((id) => {
      setDetachedIds((current) => current.filter((item) => item !== id))
      // Returning from the floating window keeps the stream playing in the app.
      setRunningIds((current) => (current.includes(id) ? current : [...current, id]))
    })

    const offAudio = window.api.onStreamAudioUpdated((update) => {
      setAudioMap((current) => ({
        ...current,
        [update.id]: { volume: update.volume, muted: update.muted }
      }))
    })

    return () => {
      offClosed()
      offReturned()
      offAudio()
    }
  }, [setAudioMap])

  const deleteStream = (id: string): void => {
    if (detachedIds.includes(id)) void window.api.closeStreamWindow(id)

    setStreams((current) => current.filter((stream) => stream.id !== id))
    setRunningIds((current) => current.filter((item) => item !== id))
    setDetachedIds((current) => current.filter((item) => item !== id))
    setSelectedIds((current) => current.filter((item) => item !== id))
    setTileSizes((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setAudioMap((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setAspectRatios((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })

    void window.api.forgetStreamLayout(id)
  }

  const requestRemoval = (id: string): void => {
    const target = streams.find((stream) => stream.id === id)
    if (target) setPendingRemoval(target)
  }

  const confirmRemoval = (): void => {
    if (!pendingRemoval) return

    const id = pendingRemoval.id
    setPendingRemoval(null)
    deleteStream(id)
  }

  const saveStream = (id: string | null, name: string, url: string): TranslationKey | null => {
    const normalized = normalizeStreamUrl(url)
    if (!normalized) return 'form.invalidUrl'

    if (isDuplicateStreamUrl(streams, normalized, id ?? undefined)) {
      return 'form.duplicateUrl'
    }

    const trimmed = name.trim()

    if (id === null) {
      const stream: Stream = {
        id: newStreamId(),
        name: trimmed || nextDefaultName(streams),
        url: normalized
      }

      setStreams((current) => [...current, stream])
      return null
    }

    setStreams((current) =>
      current.map((stream) =>
        stream.id === id ? { ...stream, name: trimmed || stream.name, url: normalized } : stream
      )
    )

    setAspectRatios((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })

    return null
  }

  /**
   * Starts a list of streams, then opens the Live view with an automatic fit.
   * Undetected streams are skipped (playback stays blocked, like the row's
   * own button does).
   */
  const startStreams = useCallback(
    (ids: string[]): void => {
      const toStart = ids.filter((id) => {
        if (runningIds.includes(id)) return false

        const stream = streams.find((item) => item.id === id)
        return stream !== undefined && getAvailability(stream.url) === 'online'
      })

      if (toStart.length === 0) return

      setRunningIds((current) => [...current, ...toStart])
      setSelectedIds((current) => current.filter((item) => !toStart.includes(item)))
      pendingFitRef.current = true
      setView('live')
    },
    [runningIds, streams]
  )

  const stopStream = useCallback((id: string): void => {
    setRunningIds((current) => current.filter((item) => item !== id))
  }, [])

  const toggleFromLibrary = (id: string): void => {
    if (detachedIds.includes(id)) {
      void window.api.closeStreamWindow(id)
      setRunningIds((current) => current.filter((item) => item !== id))
      return
    }

    if (runningIds.includes(id)) stopStream(id)
    else startStreams([id])
  }

  const stopAllRunning = (): void => {
    if (runningIds.length === 0 && detachedIds.length === 0) return

    for (const id of detachedIds) void window.api.closeStreamWindow(id)
    setRunningIds([])
  }

  /**
   * Resizes the playing tiles so the grid fills the window: the column count
   * is the one maximizing each tile's usable area for the stream count and
   * the average video ratio. The resulting sizes override manual ones; the
   * resize grip takes precedence back until the next fit.
   */
  const autoFitLiveGrid = useCallback((): void => {
    const count = liveIds.length
    if (count === 0) return

    const grid = liveGridRef.current
    if (!grid) return

    const gridRect = grid.getBoundingClientRect()
    const gridWidth = gridRect.width
    if (gridWidth <= 0) return

    const style = window.getComputedStyle(grid)
    const columnGap = parseFloat(style.columnGap) || 18
    const rowGap = parseFloat(style.rowGap) || columnGap

    const footer = document.querySelector('.footer')
    const footerHeight = footer?.getBoundingClientRect().height ?? 0
    const section = grid.closest('.workspace')
    const workspacePad = section
      ? parseFloat(window.getComputedStyle(section).paddingBottom) || 12
      : 12
    const availHeight = Math.max(
      MIN_TILE_HEIGHT,
      window.innerHeight - gridRect.top - footerHeight - workspacePad - 6
    )

    let ratioSum = 0
    for (const id of liveIds) ratioSum += aspectRatios[id] ?? DEFAULT_ASPECT_RATIO
    const avgRatio = ratioSum / count

    let best: { width: number; area: number } | null = null
    for (let cols = 1; cols <= count; cols += 1) {
      const rows = Math.ceil(count / cols)
      const cellW = (gridWidth - (cols - 1) * columnGap) / cols
      const cellH = (availHeight - (rows - 1) * rowGap) / rows
      if (cellW < MIN_TILE_WIDTH || cellH < MIN_TILE_HEIGHT) continue

      const width = Math.min(cellW, cellH * avgRatio)
      const area = width * (width / avgRatio)
      if (!best || area > best.area) best = { width, area }
    }

    if (!best) {
      // Minimum sizes do not fit either: one column, with scrolling.
      best = {
        width: Math.min(Math.max(gridWidth, MIN_TILE_WIDTH), availHeight * avgRatio),
        area: 0
      }
    }

    // floor: rounding up would overflow one column and force a line break
    // (one tile fewer per row).
    const width = Math.max(MIN_TILE_WIDTH, Math.floor(best.width))
    const height = Math.max(MIN_TILE_HEIGHT, Math.floor(width / avgRatio))

    setTileSizes((current) => {
      const next = { ...current }
      for (const id of liveIds) next[id] = { width, height }
      return next
    })
  }, [liveIds, aspectRatios, setTileSizes])

  // A launch from the Library fits the grid once the Live tiles are rendered.
  useEffect(() => {
    if (view !== 'live' || !pendingFitRef.current) return

    pendingFitRef.current = false
    const frame = requestAnimationFrame(() => autoFitLiveGrid())
    return () => cancelAnimationFrame(frame)
  }, [view, liveIds, autoFitLiveGrid])

  const detachStream = async (stream: Stream): Promise<void> => {
    const audio = getAudio(stream.id)

    try {
      await window.api.openStreamWindow({
        id: stream.id,
        name: stream.name,
        url: stream.url,
        volume: audio.volume,
        muted: audio.muted
      })

      setDetachedIds((current) => (current.includes(stream.id) ? current : [...current, stream.id]))
    } catch (error) {
      console.error('[MultiView] Unable to open floating window:', error)
      setNotice(t('stream.detachFailed'))
    }
  }

  /**
   * Launches the selected streams directly as floating miniatures (one
   * window per stream) instead of in the Live view grid.
   */
  const startAsMiniatures = async (ids: string[]): Promise<void> => {
    const toOpen = ids.filter((id) => {
      if (detachedIds.includes(id) || runningIds.includes(id)) return false

      const stream = streams.find((item) => item.id === id)
      return stream !== undefined && getAvailability(stream.url) === 'online'
    })

    if (toOpen.length === 0) return

    setSelectedIds((current) => current.filter((item) => !toOpen.includes(item)))

    for (const id of toOpen) {
      const stream = streams.find((item) => item.id === id)
      if (stream) await detachStream(stream)
    }
  }

  /** « Tout cocher »: the selection picks up every checkable stream. */
  const selectAllAvailable = (): void => {
    setSelectedIds((current) => {
      const next = [...current]

      for (const stream of streams) {
        if (runningIds.includes(stream.id) || detachedIds.includes(stream.id)) continue
        if (getAvailability(stream.url) !== 'online') continue
        if (!next.includes(stream.id)) next.push(stream.id)
      }

      return next
    })
  }

  /**
   * Drops the cached probe results and restarts the probe loop of every
   * stopped stream: the states shown become the ground truth at once.
   */
  const refreshAvailability = (): void => {
    clearProbeCache()
    setAvailabilityTick((current) => current + 1)
  }

  const reorderStream = (targetId: string): void => {
    if (!draggedId || draggedId === targetId) return

    setStreams((current) => {
      const from = current.findIndex((stream) => stream.id === draggedId)
      const to = current.findIndex((stream) => stream.id === targetId)
      if (from < 0 || to < 0) return current

      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

    setDraggedId(null)
  }

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, id: string): void => {
    event.preventDefault()
    event.stopPropagation()

    const card = event.currentTarget.closest('.stream-card') as HTMLElement | null
    const grid = event.currentTarget.closest('.stream-grid') as HTMLElement | null
    if (!card || !grid) return

    const startX = event.clientX
    const rect = card.getBoundingClientRect()
    const ratio = aspectRatios[id] || rect.width / Math.max(1, rect.height)
    const maxWidth = Math.max(MIN_TILE_WIDTH, grid.getBoundingClientRect().width)

    let frame = 0
    let pendingWidth = rect.width

    const apply = (): void => {
      frame = 0
      const width = Math.max(MIN_TILE_WIDTH, Math.min(maxWidth, pendingWidth))
      const height = Math.max(MIN_TILE_HEIGHT, width / ratio)
      setTileSizes((current) => ({ ...current, [id]: { width, height } }))
    }

    const onMove = (moveEvent: globalThis.PointerEvent): void => {
      pendingWidth = rect.width + moveEvent.clientX - startX
      if (!frame) frame = requestAnimationFrame(apply)
    }

    const onUp = (): void => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    window.addEventListener('pointercancel', onUp, { once: true })
  }

  const exportStreams = async (): Promise<void> => {
    const success = await window.api.exportStreams(streams)
    setNotice(t(success ? 'settings.notice.exported' : 'settings.notice.exportFailed'))
  }

  const importStreams = async (): Promise<void> => {
    const result = await window.api.importStreams()
    if (!result) return

    if (result.streams.length === 0) {
      setNotice(t('settings.notice.importFailed'))
      return
    }

    setStreams((current) => {
      const seen = new Set(current.map((stream) => stream.url))
      const merged = [...current]

      for (const stream of result.streams) {
        if (seen.has(stream.url)) continue
        seen.add(stream.url)
        merged.push(stream)
      }

      return merged
    })

    let message = t('settings.notice.imported', { count: result.streams.length })
    if (result.skipped > 0) {
      message += ` ${t('settings.notice.importSkipped', { count: result.skipped })}`
    }

    setNotice(message)
  }

  const resetLayout = (): void => {
    setTileSizes({})
    void window.api.resetWindowLayout()
  }

  return (
    <main className="app">
      <TopBar
        onAddStream={() => setStreamDialog({ mode: 'add' })}
        onOpenSettings={() => {
          setNotice('')
          setSettingsOpen(true)
        }}
      />

      <nav className="view-tabs" role="tablist">
        <button
          className={`view-tab${view === 'library' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={view === 'library'}
          onClick={() => setView('library')}
        >
          {t('tabs.library')}
        </button>
        <button
          className={`view-tab${view === 'live' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={view === 'live'}
          onClick={() => setView('live')}
        >
          {t('tabs.live')}
        </button>
      </nav>

      <section className="workspace" hidden={view !== 'library'}>
        <div className="section-heading">
          <div>
            <h2>{t('library.title')}</h2>
            <p>{t('library.count', { count: streams.length })}</p>
          </div>

          {streams.length > 0 && (
            <div className="library-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={selectAllAvailable}
                title={t('library.selectAllHint')}
                aria-label={t('library.selectAllHint')}
              >
                <Icon name="check" size={14} />
                <span>{t('library.selectAll')}</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSelectedIds([])}
                title={t('library.clearSelectionHint')}
                aria-label={t('library.clearSelectionHint')}
              >
                <Icon name="close" size={14} />
                <span>{t('library.clearSelection')}</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={refreshAvailability}
                title={t('library.refreshHint')}
                aria-label={t('library.refreshHint')}
              >
                <Icon name="refresh" size={14} />
                <span>{t('library.refresh')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Launch row under the heading: the row is permanent while streams
            exist (launch buttons disabled with an empty selection), so the
            heading buttons and the list never move. */}
        {streams.length > 0 && (
          <div className="selection-bar">
            <span className="selection-count">
              {t('library.selectedCount', { count: selectedIds.length })}
            </span>
            <button
              className="primary-button"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => startStreams(selectedIds)}
            >
              <Icon name="play" size={14} />
              <span>{t('library.launchLive')}</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => void startAsMiniatures(selectedIds)}
              title={t('library.launchMiniHint')}
            >
              <Icon name="detach" size={14} />
              <span>{t('library.launchMini')}</span>
            </button>
          </div>
        )}

        {streams.length === 0 ? (
          <EmptyState onAdd={() => setStreamDialog({ mode: 'add' })} />
        ) : (
          <div className="library-list" ref={libraryListRef}>
            {streams.map((stream) => (
              <LibraryRow
                key={stream.id}
                stream={stream}
                probing={view === 'library'}
                running={runningIds.includes(stream.id)}
                detached={detachedIds.includes(stream.id)}
                selected={selectedIds.includes(stream.id)}
                iceServers={iceServers}
                refreshTick={availabilityTick}
                onSelect={(id, selected) =>
                  setSelectedIds((current) =>
                    selected ? [...current, id] : current.filter((item) => item !== id)
                  )
                }
                onToggle={toggleFromLibrary}
                onDetach={(item) => void detachStream(item)}
                onEdit={(item) => setStreamDialog({ mode: 'edit', stream: item })}
                onRemove={requestRemoval}
                onDragStart={() => setDraggedId(stream.id)}
                onDragEnd={() => setDraggedId(null)}
                onDrop={() => reorderStream(stream.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="workspace" hidden={view !== 'live'}>
        <div className="section-heading">
          <div>
            <h2>{t('live.title')}</h2>
            <p>{t('live.count', { count: liveIds.length })}</p>
          </div>

          {liveIds.length > 0 && (
            <div className="live-toolbar">
              <button
                className="secondary-button"
                type="button"
                onClick={() => autoFitLiveGrid()}
                title={t('live.fitHint')}
                aria-label={t('live.fitHint')}
              >
                <Icon name="grid" size={14} />
                <span>{t('live.fit')}</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={resetLayout}
                title={t('live.resetHint')}
                aria-label={t('live.resetHint')}
              >
                <Icon name="refresh" size={14} />
                <span>{t('live.reset')}</span>
              </button>
              <button className="secondary-button danger" type="button" onClick={stopAllRunning}>
                <Icon name="stop" size={13} />
                <span>{t('live.stopAll')}</span>
              </button>
            </div>
          )}
        </div>

        {liveIds.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="play" size={26} />
            </div>
            <h2>{t('live.empty.title')}</h2>
            <p>{t('live.empty.body')}</p>
            <button className="primary-button" type="button" onClick={() => setView('library')}>
              {t('live.empty.action')}
            </button>
          </div>
        ) : (
          <div className="stream-grid" ref={liveGridRef}>
            {streams
              .filter((stream) => runningIds.includes(stream.id) || detachedIds.includes(stream.id))
              .map((stream) => {
                const size = tileSizes[stream.id]
                const detached = detachedIds.includes(stream.id)

                return (
                  <div
                    key={stream.id}
                    className="sortable-stream"
                    style={
                      size
                        ? {
                            width: `${size.width}px`,
                            maxWidth: 'none',
                            flex: `0 0 ${size.width}px`,
                            height: size.height
                          }
                        : undefined
                    }
                    draggable
                    onDragStart={(event) => {
                      const target = event.target as HTMLElement | null
                      if (
                        target?.closest(
                          'button, input, video, .view-controls, .audio-controls, .video-container'
                        )
                      ) {
                        event.preventDefault()
                        return
                      }

                      setDraggedId(stream.id)
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderStream(stream.id)}
                  >
                    {detached ? (
                      <DetachedCard
                        stream={stream}
                        onReturn={(id) => void window.api.returnToApp(id)}
                      />
                    ) : (
                      <StreamCard
                        stream={stream}
                        audio={getAudio(stream.id)}
                        solo={unmutedIds.length === 1 && unmutedIds[0] === stream.id}
                        size={size}
                        aspectRatio={aspectRatios[stream.id]}
                        iceServers={iceServers}
                        onStop={stopStream}
                        onUnavailable={stopStream}
                        onDetach={(item) => void detachStream(item)}
                        onAudioChange={updateAudio}
                        onSolo={soloStream}
                        onAspectRatio={(id, ratio) =>
                          setAspectRatios((current) => ({ ...current, [id]: ratio }))
                        }
                        onResizeStart={startResize}
                      />
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </section>

      <Footer version={appState.version} update={update} />

      <SettingsDialog
        open={settingsOpen}
        ice={ice}
        notice={notice}
        onClose={() => setSettingsOpen(false)}
        onIceChange={setIce}
        onExport={() => void exportStreams()}
        onImport={() => void importStreams()}
      />

      {pendingRemoval && (
        <ConfirmDialog
          title={t('stream.delete.title')}
          message={t('stream.delete.message', { name: pendingRemoval.name })}
          confirmLabel={t('stream.delete.confirm')}
          cancelLabel={t('form.cancel')}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={confirmRemoval}
        />
      )}

      {streamDialog && (
        <StreamFormDialog
          stream={streamDialog.mode === 'edit' ? streamDialog.stream : null}
          onClose={() => setStreamDialog(null)}
          onSave={saveStream}
        />
      )}
    </main>
  )
}
