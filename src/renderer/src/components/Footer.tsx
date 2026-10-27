import { useI18n } from '../i18n'

type FooterProps = {
  version: string
}

export function Footer({ version }: FooterProps): React.JSX.Element {
  const { language, setLanguage, t } = useI18n()

  return (
    <footer className="footer">
      <div className="footer-left">
        <strong>MultiView</strong>
        {version && <span className="version">v{version}</span>}
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
