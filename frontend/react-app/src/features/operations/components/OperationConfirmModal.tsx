import { useState } from 'react'

export function OperationConfirmModal({
  confirmLabel,
  description,
  onClose,
  onConfirm,
  title,
}: {
  confirmLabel: string
  description: string
  onClose: () => void
  onConfirm: () => Promise<void>
  title: string
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir a operação.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="operation-overlay">
      <section aria-modal="true" className="operation-modal operation-confirm" role="dialog">
        <div className="operation-modal__body">
          <h2>{title}</h2>
          <p>{description}</p>
          {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
        </div>
        <footer className="operation-modal__footer">
          <button disabled={saving} onClick={onClose} type="button">Cancelar</button>
          <button className="is-danger" disabled={saving} onClick={() => void confirm()} type="button">
            {saving ? 'Persistindo...' : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}
