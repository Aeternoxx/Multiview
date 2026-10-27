import { useEffect, useState, type FormEvent } from 'react'
import type { Stream } from '@shared/types'
import { useI18n, type TranslationKey } from '../i18n'
import { Icon } from './Icon'

type StreamFormDialogProps = {
  /** Existing stream to edit, or `null` to create a new one. */
  stream: Stream | null
  onClose: () => void
  onSave: (id: string | null, name: string, url: string) => TranslationKey | null
}

export function StreamFormDialog({
  stream,
  onClose,
  onSave
}: StreamFormDialogProps): React.JSX.Element {
  const { t } = useI18n()

  const [name, setName] = useState(stream?.name ?? '')
  const [url, setUrl] = useState(stream?.url ?? '')
  const [error, setError] = useState<TranslationKey | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const failure = onSave(stream?.id ?? null, name, url)
    if (failure) {
      setError(failure)
      return
    }

    onClose()
  }

  const title = stream ? t('stream.settings.title') : t('header.addStream')

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel modal-panel-narrow"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('form.cancel')}>
            <Icon name="close" size={15} />
          </button>
        </header>

        <form onSubmit={submit}>
          <section className="modal-section">
            <label className="modal-field">
              <span>{t('stream.name')}</span>
              <input
                autoFocus={Boolean(stream)}
                value={name}
                placeholder={t('form.namePlaceholder')}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="modal-field">
              <span>{t('stream.url')}</span>
              <input
                autoFocus={!stream}
                value={url}
                inputMode="url"
                placeholder={t('form.urlPlaceholder')}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>

            {error ? (
              <p className="player-error form-error">{t(error)}</p>
            ) : (
              <p className="modal-hint">{t('form.hint')}</p>
            )}
          </section>

          <div className="modal-footer">
            <button className="secondary-button" type="button" onClick={onClose}>
              {t('form.cancel')}
            </button>
            <button className="primary-button" type="submit">
              {stream ? t('stream.settings.save') : t('form.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
