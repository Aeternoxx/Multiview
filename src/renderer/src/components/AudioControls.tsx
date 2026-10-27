import type { AudioState } from '@shared/types'
import { useI18n } from '../i18n'
import { Icon } from './Icon'

type AudioControlsProps = {
  name: string
  audio: AudioState
  onChange: (audio: AudioState) => void
  onSolo?: () => void
  solo?: boolean
  compact?: boolean
}

export function AudioControls({
  name,
  audio,
  onChange,
  onSolo,
  solo = false,
  compact = false
}: AudioControlsProps): React.JSX.Element {
  const { t } = useI18n()
  const muted = audio.muted || audio.volume === 0

  return (
    <div className={`audio-controls${compact ? ' compact' : ''}`}>
      <button
        type="button"
        className="mute-button"
        onClick={() =>
          onChange(muted ? { volume: audio.volume || 40, muted: false } : { ...audio, muted: true })
        }
        title={muted ? t('stream.unmute') : t('stream.mute')}
        aria-label={muted ? t('stream.unmute') : t('stream.mute')}
        aria-pressed={!muted}
      >
        <Icon name={muted ? 'mute' : 'volume'} size={16} />
      </button>

      <input
        type="range"
        min="0"
        max="100"
        value={audio.volume}
        aria-label={t('stream.volumeFor', { name })}
        title={t('stream.volume')}
        onChange={(event) => {
          const volume = Number(event.target.value)
          onChange({ volume, muted: volume === 0 })
        }}
      />

      {onSolo && (
        <button
          type="button"
          className={`solo-button${solo ? ' active' : ''}`}
          onClick={onSolo}
          title={t('stream.soloHint')}
          aria-label={t('stream.solo')}
          aria-pressed={solo}
        >
          <Icon name="solo" size={15} />
        </button>
      )}
    </div>
  )
}
