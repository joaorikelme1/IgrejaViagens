import { maskCpf } from '../../../shared/validation/cpf'
import type { SystemUser } from '../model/userTypes'

interface SpouseFieldsProps {
  availableUsers: SystemUser[]
  disabled: boolean
  married: boolean
  onMarriedChange: (value: boolean) => void
  onSpouseCpfChange: (value: string) => void
  onSpouseNameChange: (value: string) => void
  spouseCpf: string
  spouseName: string
}

export function SpouseFields({
  availableUsers,
  disabled,
  married,
  onMarriedChange,
  onSpouseCpfChange,
  onSpouseNameChange,
  spouseCpf,
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
            Vincular cadastro do cônjuge
            <select
              disabled={disabled}
              onChange={(event) => onSpouseCpfChange(event.currentTarget.value)}
              value={spouseCpf}
            >
              <option value="">Cônjuge ainda não cadastrado</option>
              {availableUsers.map((user) => (
                <option key={user.cpf} value={user.cpf}>
                  {user.name} · {maskCpf(user.cpf)}
                </option>
              ))}
            </select>
          </label>
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
            Ao selecionar um cadastro, o vínculo também será gravado no outro
            cônjuge. O nome continua disponível para familiares ainda não cadastrados.
          </small>
        </div>
      ) : null}
    </fieldset>
  )
}
