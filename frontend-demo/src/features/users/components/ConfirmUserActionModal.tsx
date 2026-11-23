import { useState } from 'react'

interface ConfirmUserActionModalProps {
  confirmLabel: string
  description: string
  onCancel: () => void
  onConfirm: () => Promise<void>
  title: string
}

export function ConfirmUserActionModal({
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title,
}: ConfirmUserActionModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setError(null)
    setIsSaving(true)
    try {
      await onConfirm()
      onCancel()
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : 'Não foi possível concluir a operação.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="user-management-overlay">
      <section
        aria-labelledby="user-confirm-title"
        aria-modal="true"
        className="user-management-modal user-confirm-modal"
        role="dialog"
      >
        <div className="user-management-modal__body">
          <h2 id="user-confirm-title">{title}</h2>
          <p>{description}</p>
          {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
        </div>
        <footer className="user-management-modal__footer">
          <button disabled={isSaving} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button
            className="is-danger"
            disabled={isSaving}
            onClick={() => void confirm()}
            type="button"
          >
            {isSaving ? 'Processando...' : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}
