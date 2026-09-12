import { useState, type FormEvent } from 'react'
import { TripDetailsFields } from '../../../trips/components/TripDetailsFields'
import '../../../trips/components/tripManagement.css'
import {
  tripFormToMutation,
  tripToForm,
  type TripFormValues,
} from '../../../trips/forms/tripForm'
import { useTrip } from '../../../trips/hooks/useTrip'
import type { Trip } from '../../../trips/model/tripTypes'
import './tripSettings.css'

function TripSettingsForm({ trip }: { trip: Trip }) {
  const { updateTrip } = useTrip()
  const [values, setValues] = useState(() => tripToForm(trip))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{
    kind: 'error' | 'success'
    text: string
  } | null>(null)

  const updateValues = (nextValues: TripFormValues) => {
    setMessage(null)
    setValues(nextValues)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    try {
      const mutation = tripFormToMutation(values)
      setIsSaving(true)
      const persistedTrip = await updateTrip(trip.id, mutation)
      setValues(tripToForm(persistedTrip))
      setMessage({ kind: 'success', text: 'Configurações salvas com sucesso.' })
    } catch (error) {
      setMessage({
        kind: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar as configurações.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      className="trip-settings"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <header>
        <div>
          <span>Viagem ativa</span>
          <h2>{trip.name}</h2>
          <p>
            Altere somente os dados gerais. Hotéis, quartos, viajantes e ônibus
            permanecem associados.
          </p>
        </div>
      </header>

      {message ? (
        <p
          className={`form-message ${message.kind === 'error' ? 'is-error' : 'is-success'}`}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}

      <section className="trip-settings__card">
        <TripDetailsFields
          disabled={isSaving}
          onChange={updateValues}
          values={values}
        />
      </section>

      <footer>
        <button
          disabled={isSaving}
          onClick={() => {
            setValues(tripToForm(trip))
            setMessage(null)
          }}
          type="button"
        >
          Descartar alterações
        </button>
        <button className="is-primary" disabled={isSaving} type="submit">
          {isSaving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </footer>
    </form>
  )
}

export function TripSettingsPage() {
  const { activeTrip } = useTrip()
  if (!activeTrip) return null
  return <TripSettingsForm key={activeTrip.id} trip={activeTrip} />
}
