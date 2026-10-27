import { useEffect } from 'react'
import { Icon } from './Icon'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm
}: ConfirmDialogProps): React.JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="modal-panel modal-panel-narrow"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onCancel} aria-label={cancelLabel}>
            <Icon name="close" size={15} />
          </button>
        </header>

        <section className="modal-section">
          <p className="modal-message">{message}</p>
        </section>

        <div className="modal-footer">
          <button className="secondary-button" type="button" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button className="secondary-button danger" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
