import { useI18n } from '../i18n'
import { Icon } from './Icon'

type EmptyStateProps = {
  onAdd: () => void
}

export function EmptyState({ onAdd }: EmptyStateProps): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name="grid" size={26} />
      </div>
      <h2>{t('empty.title')}</h2>
      <p>{t('empty.body')}</p>
      <button className="primary-button" onClick={onAdd}>
        + {t('empty.action')}
      </button>
    </div>
  )
}
