import type { Stream } from '@shared/types'
import { useI18n, type TranslationKey } from '../i18n'
import { useStreamAvailability } from '../hooks/useStreamAvailability'
import type { Availability } from '../lib/availability'
import { Icon } from './Icon'

type LibraryRowProps = {
  stream: Stream
  /** Availability probes only run while the library tab is active. */
  probing: boolean
  running: boolean
  detached: boolean
  selected: boolean
  iceServers: RTCIceServer[]
  onSelect: (id: string, selected: boolean) => void
  onToggle: (id: string) => void
  onDetach: (stream: Stream) => void
  onEdit: (stream: Stream) => void
  onRemove: (id: string) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
}

function availabilityLabel(availability: Availability): TranslationKey {
  if (availability === 'online') return 'availability.online'
  if (availability === 'offline') return 'availability.offline'
  return 'availability.checking'
}

/**
 * Simplified Library row: no video, but the availability probe (running only
 * while the library tab is open) and the management actions. The play button
 * opens the stream in the Live view; detach sends it to a floating window.
 */
export function LibraryRow({
  stream,
  probing,
  running,
  detached,
  selected,
  iceServers,
  onSelect,
  onToggle,
  onDetach,
  onEdit,
  onRemove,
  onDragStart,
  onDragEnd,
  onDrop
}: LibraryRowProps): React.JSX.Element {
  const { t } = useI18n()

  // The stream plays either in the Live view or in its floating window.
  const active = running || detached

  const availability = useStreamAvailability({
    url: stream.url,
    enabled: probing && !active,
    iceServers
  })

  const dotState: Availability = active ? 'online' : availability
  const startBlocked = !active && availability === 'offline'

  const statusText = active
    ? t('library.playing')
    : `${t('stream.status.stopped')} · ${t(
        availability === 'online'
          ? 'stream.status.online'
          : availability === 'offline'
            ? 'stream.status.offline'
            : 'stream.status.checking'
      )}`

  const toggleLabel = active ? t('stream.stop') : t('stream.start')

  // A checkbox stays checkable only for a stream ready to be launched.
  const selectable = !active && availability === 'online'

  return (
    <div
      className={`library-row${active ? ' is-running' : ''}${selected ? ' selected' : ''}`}
      draggable
      onDragStart={(event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('button, input, .row-actions')) {
          event.preventDefault()
          return
        }

        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <input
        type="checkbox"
        className="row-select"
        checked={selected}
        disabled={!selectable}
        aria-label={t('library.selectFor', { name: stream.name })}
        onChange={(event) => onSelect(stream.id, event.target.checked)}
      />

      <div className="row-main">
        <div className="row-title">
          <h3 className="row-name">{stream.name}</h3>
          {active && <span className="row-playing">{t('library.playing')}</span>}
        </div>

        <p className="row-url" title={stream.url}>
          {stream.url}
        </p>

        <div className="status-line">
          <span className={`availability-dot ${dotState}`} title={t(availabilityLabel(dotState))} />
          <span className="row-status">{statusText}</span>
        </div>
      </div>

      <div className="row-actions">
        <button
          className="icon-button"
          onClick={() => onToggle(stream.id)}
          disabled={startBlocked}
          title={toggleLabel}
          aria-label={toggleLabel}
        >
          <Icon name={active ? 'stop' : 'play'} size={18} />
        </button>

        <button
          className="icon-button"
          onClick={() => onDetach(stream)}
          disabled={startBlocked || detached}
          title={startBlocked ? t('stream.detachUnavailable') : t('stream.detachTitle')}
          aria-label={t('stream.detach')}
        >
          <Icon name="detach" size={15} />
        </button>

        <button
          className="icon-button"
          onClick={() => onEdit(stream)}
          title={t('stream.edit')}
          aria-label={t('stream.edit')}
        >
          <Icon name="edit" size={15} />
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
  )
}
