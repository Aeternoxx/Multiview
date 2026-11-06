import { useI18n } from '../i18n'
import type { UpdateInfo } from '@shared/types'

type FooterProps = {
  version: string
  update: UpdateInfo | null
}

export function Footer({ version, update }: FooterProps): React.JSX.Element {
  const { language, setLanguage, t } = useI18n()

  return (
    <footer className="footer">
      <div className="footer-left">
        <strong>MultiView</strong>
        {version && <span className="version">v{version}</span>}
        {update && (
          <button
            type="button"
            className="update-pill"
            onClick={() => void window.api.openUpdate()}
            title={t('footer.updateHint')}
          >
            <span className="update-pill-dot" aria-hidden="true" />
            {t('footer.update', { version: update.version })}
          </button>
        )}
        <span className="footer-tech">WHEP · WebRTC</span>
      </div>

      <div className="footer-right">
        <button
          className={language === 'FR' ? 'language-active' : ''}
          onClick={() => setLanguage('FR')}
          title="Français"
        >
          FR
        </button>
        <span aria-hidden="true">|</span>
        <button
          className={language === 'EN' ? 'language-active' : ''}
          onClick={() => setLanguage('EN')}
          title="English"
        >
          EN
        </button>

        <a
          className="kofi-link"
          href="https://ko-fi.com/aeternoxx"
          target="_blank"
          rel="noreferrer"
        >
          <img src="./kofi.svg" alt="" />
          {t('footer.support')}
        </a>
      </div>
    </footer>
  )
}
