import { maskCpf } from '../../../shared/validation/cpf'
import type { SystemUser } from '../model/userTypes'

interface ChildrenFieldsProps {
  availableUsers: SystemUser[]
  childCpfs: string[]
  disabled: boolean
  hasKids: boolean
  kids: string[]
  onChildCpfsChange: (cpfs: string[]) => void
  onHasKidsChange: (value: boolean) => void
  onKidsChange: (kids: string[]) => void
}

export function ChildrenFields({
  availableUsers,
  childCpfs,
  disabled,
  hasKids,
  kids,
  onChildCpfsChange,
  onHasKidsChange,
  onKidsChange,
}: ChildrenFieldsProps) {
  const updateCount = (countValue: number) => {
    const count = Math.min(10, Math.max(1, Math.trunc(countValue) || 1))
    onKidsChange(Array.from({ length: count }, (_, index) => kids[index] ?? ''))
  }

  return (
    <fieldset className="user-family-fields">
      <label className="user-check-field">
        <input
          checked={hasKids}
          disabled={disabled}
          onChange={(event) => onHasKidsChange(event.currentTarget.checked)}
          type="checkbox"
        />
        Tem filhos
      </label>

      {hasKids ? (
        <div className="user-family-fields__details">
          <label className="user-field user-field--count">
            Quantidade de filhos
            <input
              disabled={disabled}
              max="10"
              min="1"
              onChange={(event) => updateCount(Number(event.currentTarget.value))}
              type="number"
              value={Math.max(1, kids.length)}
            />
          </label>
          {kids.map((kid, index) => (
            <label className="user-field" key={index}>
              Nome do filho {index + 1}
              <input
                disabled={disabled}
                onChange={(event) =>
                  onKidsChange(
                    kids.map((current, kidIndex) =>
                      kidIndex === index ? event.currentTarget.value : current,
                    ),
                  )
                }
                value={kid}
              />
            </label>
          ))}
          <label className="user-field user-field--wide">
            Vincular filhos que já possuem cadastro
            <select
              disabled={disabled}
              multiple
              onChange={(event) =>
                onChildCpfsChange(
                  Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                )
              }
              size={Math.min(6, Math.max(2, availableUsers.length))}
              value={childCpfs}
            >
              {availableUsers.map((user) => (
                <option key={user.cpf} value={user.cpf}>
                  {user.name} · {maskCpf(user.cpf)}
                </option>
              ))}
            </select>
            <small>Use Ctrl (ou Command) para selecionar mais de um cadastro.</small>
          </label>
        </div>
      ) : null}
    </fieldset>
  )
}
