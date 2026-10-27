import { useEffect } from 'react'
import { useI18n } from '../i18n'
import type { IceConfig } from '../lib/ice'
import { Icon } from './Icon'

type SettingsDialogProps = {
  open: boolean
  ice: IceConfig
  notice: string
  onClose: () => void
  onIceChange: (config: IceConfig) => void
  onExport: () => void
  onImport: () => void
  onResetLayout: () => void
}

export function SettingsDialog({
  open,
  ice,
  notice,
  onClose,
  onIceChange,
  onExport,
  onImport,
  onResetLayout
}: SettingsDialogProps): React.JSX.Element | null {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
        <header className="modal-header">
          <h2>{t('settings.title')}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('settings.close')}>
            <Icon name="close" size={15} />
          </button>
        </header>

        <section className="modal-section">
          <h3>{t('settings.network.title')}</h3>

          <label className="modal-field">
            <span>{t('settings.network.stun')}</span>
            <input
              value={ice.stun}
              placeholder="stun:stun.example.com:3478"
              onChange={(event) => onIceChange({ ...ice, stun: event.target.value })}
            />
          </label>

          <label className="modal-field">
            <span>{t('settings.network.turn')}</span>
            <input
              value={ice.turn}
              placeholder="turn:turn.example.com:3478"
              onChange={(event) => onIceChange({ ...ice, turn: event.target.value })}
            />
          </label>

          <div className="modal-row">
            <label className="modal-field">
              <span>{t('settings.network.username')}</span>
              <input
                value={ice.username}
                autoComplete="off"
                onChange={(event) => onIceChange({ ...ice, username: event.target.value })}
              />
            </label>

            <label className="modal-field">
              <span>{t('settings.network.password')}</span>
              <input
                type="password"
                value={ice.password}
                autoComplete="off"
                onChange={(event) => onIceChange({ ...ice, password: event.target.value })}
              />
            </label>
          </div>

          <p className="modal-hint">{t('settings.network.hint')}</p>
        </section>

        <section className="modal-section">
          <h3>{t('settings.data.title')}</h3>
          <div className="modal-actions">
            <button className="secondary-button" onClick={onExport}>
              {t('settings.data.export')}
            </button>
            <button className="secondary-button" onClick={onImport}>
              {t('settings.data.import')}
            </button>
            <button className="secondary-button danger" onClick={onResetLayout}>
              {t('settings.data.reset')}
            </button>
          </div>
          <p className="modal-hint">{t('settings.data.resetHint')}</p>
          {notice && <p className="modal-notice">{notice}</p>}
        </section>
      </div>
    </div>
  )
}
