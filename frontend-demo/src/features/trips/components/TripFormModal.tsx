import { useState, type FormEvent } from 'react'
import { AppIcon } from '../../../shared/components/AppIcon'
import {
  createEmptyTripForm,
  tripFormToMutation,
  tripToForm,
} from '../forms/tripForm'
import { useTrip } from '../hooks/useTrip'
import type { Trip } from '../model/tripTypes'
import { BusEditor } from './BusEditor'
import { TripDetailsFields } from './TripDetailsFields'
import './tripManagement.css'

interface TripFormModalProps {
  onClose: () => void
  trip?: Trip
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível salvar a viagem.'
}

export function TripFormModal({ onClose, trip }: TripFormModalProps) {
  const { createTrip, updateTrip } = useTrip()
  const [values, setValues] = useState(() =>
    trip ? tripToForm(trip) : createEmptyTripForm(),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isEditing = Boolean(trip)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    try {
      const mutation = tripFormToMutation(values)
      setIsSaving(true)
      if (trip) await updateTrip(trip.id, mutation)
      else await createTrip(mutation)
      onClose()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="trip-management-overlay">
      <section
        aria-labelledby="trip-form-title"
        aria-modal="true"
        className="trip-management-modal trip-form-modal"
        role="dialog"
      >
        <header className="trip-management-modal__header">
          <div>
            <h2 id="trip-form-title">
              {isEditing ? 'Editar viagem' : 'Criar viagem'}
            </h2>
            <p>
              {isEditing
                ? 'Atualize os dados sem perder associações existentes.'
                : 'Cadastre a viagem e configure seu transporte inicial.'}
            </p>
          </div>
          <button
            aria-label="Fechar formulário de viagem"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <AppIcon name="x" />
          </button>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="trip-management-modal__body">
            {errorMessage ? <p className="form-message is-error" role="alert">{errorMessage}</p> : null}
            <TripDetailsFields
              disabled={isSaving}
              onChange={setValues}
              values={values}
            />
            <BusEditor
              buses={values.buses}
              disabled={isSaving}
              onChange={(buses) => setValues({ ...values, buses })}
              preservedBusIds={trip?.buses.map((bus) => bus.id)}
            />
          </div>
          <footer className="trip-management-modal__footer">
            <button disabled={isSaving} onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="is-primary" disabled={isSaving} type="submit">
              {isSaving ? 'Salvando...' : 'Salvar viagem'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
