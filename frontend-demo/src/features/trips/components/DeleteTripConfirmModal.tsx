import { useState } from 'react'
import { useTrip } from '../hooks/useTrip'
import type { Trip } from '../model/tripTypes'
import './tripManagement.css'

interface DeleteTripConfirmModalProps {
  onClose: () => void
  trip: Trip
}

export function DeleteTripConfirmModal({
  onClose,
  trip,
}: DeleteTripConfirmModalProps) {
  const { deleteTrip } = useTrip()
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      await deleteTrip(trip.id)
      onClose()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir a viagem.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="trip-management-overlay">
      <section
        aria-labelledby="delete-trip-title"
        aria-modal="true"
        className="trip-management-modal confirm-modal"
        role="alertdialog"
      >
        <div className="trip-management-modal__body">
          <h2 id="delete-trip-title">Excluir viagem?</h2>
          <p>
            Você está prestes a excluir <strong>{trip.name}</strong> e seus
            pagamentos, assentos e ocupações de quartos vinculados. Esta ação
            não pode ser desfeita.
          </p>
          {errorMessage ? (
            <p className="form-message is-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <footer className="trip-management-modal__footer">
          <button disabled={isDeleting} onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="is-danger"
            disabled={isDeleting}
            onClick={() => void handleDelete()}
            type="button"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir viagem'}
          </button>
        </footer>
      </section>
    </div>
  )
}
