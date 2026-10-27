import appLogo from '../../../../resources/icon.png'
import { useI18n } from '../i18n'
import { Icon } from './Icon'

type TopBarProps = {
  onAddStream: () => void
  onOpenSettings: () => void
}

export function TopBar({ onAddStream, onOpenSettings }: TopBarProps): React.JSX.Element {
  const { t } = useI18n()

  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand-icon" src={appLogo} alt="" />
        <div>
          <h1>MultiView</h1>
          <p>{t('app.tagline')}</p>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="primary-button" onClick={onAddStream}>
          + {t('header.addStream')}
        </button>

        <button
          className="icon-button topbar-settings"
          onClick={onOpenSettings}
          title={t('header.settings')}
          aria-label={t('header.settings')}
        >
          <Icon name="settings" size={18} />
        </button>
      </div>
    </header>
  )
}
