interface SpouseFieldsProps {
  disabled: boolean
  married: boolean
  onMarriedChange: (value: boolean) => void
  onSpouseNameChange: (value: string) => void
  spouseName: string
}

export function SpouseFields({
  disabled,
  married,
  onMarriedChange,
  onSpouseNameChange,
  spouseName,
}: SpouseFieldsProps) {
  return (
    <fieldset className="user-family-fields">
      <label className="user-check-field">
        <input
          checked={married}
          disabled={disabled}
          onChange={(event) => onMarriedChange(event.currentTarget.checked)}
          type="checkbox"
        />
        Casado(a)
      </label>
      {married ? (
        <div className="user-family-fields__details">
          <label className="user-field">
            Nome do cônjuge
            <input
              disabled={disabled}
              onChange={(event) => onSpouseNameChange(event.currentTarget.value)}
              placeholder="Nome informado pelo usuário"
              value={spouseName}
            />
          </label>
          <small>
            Este campo é apenas informativo; o backend não mantém vínculo entre
            cadastros de cônjuges.
          </small>
        </div>
      ) : null}
    </fieldset>
  )
}
