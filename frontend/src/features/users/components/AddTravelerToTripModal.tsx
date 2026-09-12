import { useState } from 'react'
import { maskCpf } from '../../../shared/validation/cpf'
import { filterUsers } from '../lib/userSearch'
import type { SystemUser } from '../model/userTypes'

interface AddTravelerToTripModalProps {
  capacityReached: boolean
  onAdd: (cpf: string) => Promise<void>
  onClose: () => void
  users: SystemUser[]
}

export function AddTravelerToTripModal({
  capacityReached,
  onAdd,
  onClose,
  users,
}: AddTravelerToTripModalProps) {
  const [query, setQuery] = useState('')
  const [savingCpf, setSavingCpf] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const filteredUsers = filterUsers(users, query)

  const add = async (cpf: string) => {
    setError(null)
    setSavingCpf(cpf)
    try {
      await onAdd(cpf)
      onClose()
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : 'Não foi possível adicionar o usuário.',
      )
    } finally {
      setSavingCpf(null)
    }
  }

  return (
    <div className="user-management-overlay">
      <section
        aria-labelledby="add-traveler-title"
        aria-modal="true"
        className="user-management-modal add-traveler-modal"
        role="dialog"
      >
        <header className="user-management-modal__header">
          <div>
            <h2 id="add-traveler-title">Adicionar usuário existente</h2>
            <p>Selecione uma pessoa do cadastro global, inclusive administradores.</p>
          </div>
          <button aria-label="Fechar seleção" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="user-management-modal__body">
          {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
          {capacityReached ? (
            <p className="form-message is-error" role="alert">
              O limite de pessoas desta viagem foi atingido.
            </p>
          ) : null}
          <label className="user-field">
            Buscar por nome ou CPF
            <input
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Nome ou CPF"
              value={query}
            />
          </label>
          <div className="add-traveler-list">
            {filteredUsers.length ? (
              filteredUsers.map((user) => (
                <article key={user.cpf}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{maskCpf(user.cpf)}</span>
                  </div>
                  <button
                    aria-label={`Adicionar ${user.name}`}
                    disabled={capacityReached || savingCpf !== null}
                    onClick={() => void add(user.cpf)}
                    type="button"
                  >
                    {savingCpf === user.cpf ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </article>
              ))
            ) : (
              <p className="user-empty">Nenhum usuário disponível.</p>
            )}
          </div>
        </div>
        <footer className="user-management-modal__footer">
          <button onClick={onClose} type="button">Fechar</button>
        </footer>
      </section>
    </div>
  )
}
