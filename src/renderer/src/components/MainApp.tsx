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
import { newStreamId } from '../lib/id'
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
import { SettingsDialog } from './SettingsDialog'
import { StreamCard } from './StreamCard'
import { StreamFormDialog } from './StreamFormDialog'
import { TopBar } from './TopBar'

type StreamDialogState = { mode: 'add' } | { mode: 'edit'; stream: Stream }

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
  const [streamDialog, setStreamDialog] = useState<StreamDialogState | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<Stream | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [appState, setAppState] = useState<AppState>({ version: '' })
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const iceServers = useMemo(() => toIceServers(ice), [ice])

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
    const grid = gridRef.current
    const contentWidth = document.documentElement.clientWidth
    const workspaceChrome = grid
      ? Math.max(0, contentWidth - grid.getBoundingClientRect().width)
      : 0
    const frameChrome = Math.max(0, window.outerWidth - window.innerWidth)

    void window.api.setMainMinimumWidth(Math.ceil(widestTile + workspaceChrome + frameChrome))
  }, [widestTile])

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

  const stopStream = useCallback((id: string): void => {
    setRunningIds((current) => current.filter((item) => item !== id))
  }, [])

  const toggleStream = (id: string): void => {
    setRunningIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

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
    const headerHeight = card.querySelector('.stream-info')?.getBoundingClientRect().height ?? 72
    const ratio = aspectRatios[id] || rect.width / Math.max(1, rect.height - headerHeight)
    const maxWidth = Math.max(MIN_TILE_WIDTH, grid.getBoundingClientRect().width)

    let frame = 0
    let pendingWidth = rect.width

    const apply = (): void => {
      frame = 0
      const width = Math.max(MIN_TILE_WIDTH, Math.min(maxWidth, pendingWidth))
      const height = Math.max(MIN_TILE_HEIGHT, width / ratio + headerHeight)
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
    setNotice(t('settings.notice.reset'))
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

      <section className="workspace">
        <div className="section-heading">
          <div>
            <h2>{t('workspace.title')}</h2>
            <p>{t('workspace.count', { count: streams.length })}</p>
          </div>
        </div>

        {streams.length === 0 ? (
          <EmptyState onAdd={() => setStreamDialog({ mode: 'add' })} />
        ) : (
          <div className="stream-grid" ref={gridRef}>
            {streams.map((stream) => {
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
                      running={runningIds.includes(stream.id)}
                      audio={getAudio(stream.id)}
                      solo={unmutedIds.length === 1 && unmutedIds[0] === stream.id}
                      size={size}
                      aspectRatio={aspectRatios[stream.id]}
                      iceServers={iceServers}
                      onToggle={toggleStream}
                      onUnavailable={stopStream}
                      onRemove={requestRemoval}
                      onEdit={(item) => setStreamDialog({ mode: 'edit', stream: item })}
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

      <Footer version={appState.version} />

      <SettingsDialog
        open={settingsOpen}
        ice={ice}
        notice={notice}
        onClose={() => setSettingsOpen(false)}
        onIceChange={setIce}
        onExport={() => void exportStreams()}
        onImport={() => void importStreams()}
        onResetLayout={resetLayout}
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
