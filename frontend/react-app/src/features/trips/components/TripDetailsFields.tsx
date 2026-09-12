import type { ChangeEvent } from 'react'
import {
  suggestArrecadationGoal,
  type TripFormValues,
} from '../forms/tripForm'

interface TripDetailsFieldsProps {
  disabled?: boolean
  onChange: (values: TripFormValues) => void
  values: TripFormValues
}

export function TripDetailsFields({
  disabled = false,
  onChange,
  values,
}: TripDetailsFieldsProps) {
  const update =
    (field: keyof Omit<TripFormValues, 'buses'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({ ...values, [field]: event.target.value })
    }
  const suggestion = suggestArrecadationGoal(values)

  return (
    <div className="trip-fields">
      <label className="trip-field trip-field--wide">
        <span>Nome da viagem</span>
        <input
          disabled={disabled}
          onChange={update('name')}
          required
          value={values.name}
        />
      </label>
      <label className="trip-field">
        <span>Origem</span>
        <input
          disabled={disabled}
          onChange={update('departurePlace')}
          required
          value={values.departurePlace}
        />
      </label>
      <label className="trip-field">
        <span>Destino</span>
        <input
          disabled={disabled}
          onChange={update('destination')}
          required
          value={values.destination}
        />
      </label>
      <label className="trip-field">
        <span>Data</span>
        <input
          disabled={disabled}
          onChange={update('date')}
          required
          type="date"
          value={values.date}
        />
      </label>
      <label className="trip-field">
        <span>Horário</span>
        <input
          disabled={disabled}
          onChange={update('departureTime')}
          required
          type="time"
          value={values.departureTime}
        />
      </label>
      <label className="trip-field">
        <span>Limite de pessoas</span>
        <input
          disabled={disabled}
          min="1"
          onChange={update('maxPeople')}
          required
          step="1"
          type="number"
          value={values.maxPeople}
        />
      </label>
      <label className="trip-field">
        <span>Preço individual (R$)</span>
        <input
          disabled={disabled}
          min="0"
          onChange={update('price')}
          required
          step="0.01"
          type="number"
          value={values.price}
        />
      </label>
      <div className="trip-field trip-field--goal">
        <label htmlFor="trip-arrecadation-goal">Meta de arrecadação (R$)</label>
        <input
          disabled={disabled}
          id="trip-arrecadation-goal"
          min="0"
          onChange={update('arrecadationGoal')}
          required
          step="0.01"
          type="number"
          value={values.arrecadationGoal}
        />
        <small>
          Sugestão pelo limite: R${' '}
          {suggestion.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}
          <button
            disabled={disabled}
            onClick={() =>
              onChange({ ...values, arrecadationGoal: String(suggestion) })
            }
            type="button"
          >
            Usar sugestão
          </button>
        </small>
      </div>
      <label className="trip-field trip-field--wide">
        <span>Regras e observações</span>
        <textarea
          disabled={disabled}
          onChange={update('rules')}
          rows={4}
          value={values.rules}
        />
      </label>
    </div>
  )
}
