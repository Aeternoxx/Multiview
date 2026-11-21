import { useI18n } from '../i18n'
import type { UpdateState } from '@shared/types'

type FooterProps = {
  version: string
  update: UpdateState | null
}

/**
 * One look per updater phase. The busy phases are a status, not a control: the
 * only two actions the user gets are "restart now" and "take me to the release
 * page" when the updater could not do the job.
 */
function UpdatePill({ update }: { update: UpdateState }): React.JSX.Element {
  const { t } = useI18n()

  if (update.phase === 'available' || update.phase === 'downloading') {
    const label =
      update.phase === 'downloading'
        ? t('footer.updateDownloading', { version: update.version, percent: update.percent })
        : t('footer.update', { version: update.version })

    return (
      <span className="update-pill is-busy" role="status" title={t('footer.updateHint')}>
        <span className="update-pill-dot" aria-hidden="true" />
        {label}
      </span>
    )
  }

  const ready = update.phase === 'ready'
  const hint = ready ? t('footer.updateRestartHint') : t('footer.updateFailedHint')
  const tooltip = ready || !update.error ? hint : `${hint} — ${update.error}`

  return (
    <button
      type="button"
      className={ready ? 'update-pill is-ready' : 'update-pill is-error'}
      onClick={() => void (ready ? window.api.installUpdate() : window.api.openReleasePage())}
      title={tooltip}
    >
      <span className="update-pill-dot" aria-hidden="true" />
      {ready ? t('footer.updateRestart', { version: update.version }) : t('footer.updateFailed')}
    </button>
  )
}

export function Footer({ version, update }: FooterProps): React.JSX.Element {
  const { language, setLanguage, t } = useI18n()

  return (
    <footer className="footer">
      <div className="footer-left">
        <strong>MultiView</strong>
        {version && <span className="version">v{version}</span>}
        {update && update.phase !== 'idle' && <UpdatePill update={update} />}
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
