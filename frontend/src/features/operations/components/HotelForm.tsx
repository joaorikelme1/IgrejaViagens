import { useState, type FormEvent } from 'react'
import type { HotelConfig } from '../model/operationTypes'

export function HotelForm({
  hotel,
  onClose,
  onSave,
}: {
  hotel?: HotelConfig
  onClose: () => void
  onSave: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(hotel?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = name.trim()
    if (!normalized) {
      setError('Informe o nome do hotel.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(normalized)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o hotel.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="operation-overlay">
      <section aria-labelledby="hotel-form-title" aria-modal="true" className="operation-modal" role="dialog">
        <header className="operation-modal__header">
          <div><h2 id="hotel-form-title">{hotel ? 'Editar hotel' : 'Cadastrar hotel'}</h2><p>Os quartos e ocupantes existentes serão preservados.</p></div>
          <button aria-label="Fechar formulário de hotel" disabled={saving} onClick={onClose} type="button">×</button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="operation-modal__body">
            {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
            <label className="operation-field">Nome do hotel<input disabled={saving} onChange={(event) => setName(event.currentTarget.value)} value={name} /></label>
            {hotel ? <small className="operation-id">ID preservado: {String(hotel.id)}</small> : null}
          </div>
          <footer className="operation-modal__footer"><button disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="is-primary" disabled={saving} type="submit">{saving ? 'Salvando...' : 'Salvar hotel'}</button></footer>
        </form>
      </section>
    </div>
  )
}
