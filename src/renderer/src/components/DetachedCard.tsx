import type { Stream } from '@shared/types'
import { useI18n } from '../i18n'
import { Icon } from './Icon'

type DetachedCardProps = {
  stream: Stream
  onReturn: (id: string) => void
}

export function DetachedCard({ stream, onReturn }: DetachedCardProps): React.JSX.Element {
  const { t } = useI18n()

  return (
    <article className="stream-card detached-card">
      <div className="detached-message">
        <span className="availability-dot online" />
        <strong>{t('stream.detached.title')}</strong>
        <p>{stream.name}</p>

        <button className="primary-button" onClick={() => onReturn(stream.id)}>
          <Icon name="back" size={14} />
          {t('stream.detached.return')}
        </button>
      </div>
    </article>
  )
}
