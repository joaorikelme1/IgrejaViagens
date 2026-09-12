import { useState, type FormEvent } from 'react'
import { maskCpf } from '../../../shared/validation/cpf'
import { AppIcon } from '../../../shared/components/AppIcon'
import {
  createEmptyUserForm,
  userFormSubmission,
  userToForm,
} from '../forms/userForm'
import type { SystemUser, UserMutation } from '../model/userTypes'
import { ChildrenFields } from './ChildrenFields'
import { SpouseFields } from './SpouseFields'

interface UserFormProps {
  availableUsers?: SystemUser[]
  fixedRole?: UserMutation['role']
  forceFirstLoginOnCreate?: boolean
  onClose: () => void
  onSubmit: (cpf: string, mutation: UserMutation) => Promise<void>
  title: string
  user?: SystemUser
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível salvar o usuário.'
}

export function UserForm({
  availableUsers = [],
  fixedRole,
  forceFirstLoginOnCreate = false,
  onClose,
  onSubmit,
  title,
  user,
}: UserFormProps) {
  const isEditing = Boolean(user)
  const [values, setValues] = useState(() =>
    user ? userToForm(user) : createEmptyUserForm(fixedRole),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const relationshipOptions = availableUsers.filter(
    (candidate) => candidate.cpf !== user?.cpf,
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      const submission = userFormSubmission(
        {
          ...values,
          role: fixedRole ?? values.role,
          firstLogin:
            forceFirstLoginOnCreate && !isEditing ? true : values.firstLogin,
        },
        isEditing,
      )
      setIsSaving(true)
      await onSubmit(submission.cpf, submission.mutation)
      onClose()
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="user-management-overlay">
      <section
        aria-labelledby="user-form-title"
        aria-modal="true"
        className="user-management-modal"
        role="dialog"
      >
        <header className="user-management-modal__header">
          <div>
            <h2 id="user-form-title">{title}</h2>
            <p>Dados pessoais e familiares do cadastro.</p>
          </div>
          <button
            aria-label="Fechar formulário de usuário"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <AppIcon name="x" />
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)}>
          <div className="user-management-modal__body">
            {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
            <div className="user-fields-grid">
              <label className="user-field user-field--wide">
                Nome completo *
                <input
                  autoFocus
                  disabled={isSaving}
                  onChange={(event) =>
                    setValues({ ...values, name: event.currentTarget.value })
                  }
                  value={values.name}
                />
              </label>
              <label className="user-field">
                CPF *
                <input
                  disabled={isSaving || isEditing}
                  inputMode="numeric"
                  maxLength={14}
                  onChange={(event) =>
                    setValues({ ...values, cpf: maskCpf(event.currentTarget.value) })
                  }
                  placeholder="000.000.000-00"
                  value={maskCpf(values.cpf)}
                />
              </label>
              <label className="user-field">
                Data de nascimento
                <input
                  disabled={isSaving}
                  onChange={(event) =>
                    setValues({ ...values, birthdate: event.currentTarget.value })
                  }
                  type="date"
                  value={values.birthdate}
                />
              </label>
              {!isEditing ? (
                <label className="user-field">
                  Senha inicial *
                  <input
                    autoComplete="new-password"
                    disabled={isSaving}
                    minLength={8}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        initialPassword: event.currentTarget.value,
                      })
                    }
                    type="password"
                    value={values.initialPassword}
                  />
                </label>
              ) : null}
              <label className="user-field">
                Papel no sistema
                <select
                  disabled={isSaving || Boolean(fixedRole)}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      role: event.currentTarget.value === 'admin' ? 'admin' : 'traveler',
                    })
                  }
                  value={fixedRole ?? values.role}
                >
                  <option value="traveler">Viajante</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <label className="user-check-field user-check-field--status">
                <input
                  checked={
                    forceFirstLoginOnCreate && !isEditing
                      ? true
                      : values.firstLogin
                  }
                  disabled={
                    isSaving || (forceFirstLoginOnCreate && !isEditing)
                  }
                  onChange={(event) =>
                    setValues({
                      ...values,
                      firstLogin: event.currentTarget.checked,
                    })
                  }
                  type="checkbox"
                />
                Exigir troca de senha no próximo acesso
              </label>
            </div>

            <SpouseFields
              availableUsers={relationshipOptions}
              disabled={isSaving}
              married={values.married}
              onMarriedChange={(married) =>
                setValues({
                  ...values,
                  married,
                  spouseCpf: married ? values.spouseCpf : '',
                })
              }
              onSpouseCpfChange={(spouseCpf) => {
                const spouse = relationshipOptions.find(
                  (candidate) => candidate.cpf === spouseCpf,
                )
                setValues({
                  ...values,
                  spouseCpf,
                  spouseName: spouse?.name ?? values.spouseName,
                })
              }}
              onSpouseNameChange={(spouseName) =>
                setValues({ ...values, spouseName })
              }
              spouseCpf={values.spouseCpf}
              spouseName={values.spouseName}
            />
            <ChildrenFields
              availableUsers={relationshipOptions}
              childCpfs={values.childCpfs}
              disabled={isSaving}
              hasKids={values.hasKids}
              kids={values.kids}
              onHasKidsChange={(hasKids) =>
                setValues({
                  ...values,
                  hasKids,
                  childCpfs: hasKids ? values.childCpfs : [],
                  kids: hasKids && values.kids.length === 0 ? [''] : values.kids,
                })
              }
              onChildCpfsChange={(childCpfs) => {
                const linkedNames = relationshipOptions
                  .filter((candidate) => childCpfs.includes(candidate.cpf))
                  .map((candidate) => candidate.name)
                setValues({
                  ...values,
                  childCpfs,
                  kids: [...new Set([...values.kids.filter(Boolean), ...linkedNames])],
                })
              }}
              onKidsChange={(kids) => setValues({ ...values, kids })}
            />
          </div>
          <footer className="user-management-modal__footer">
            <button disabled={isSaving} onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="is-primary" disabled={isSaving} type="submit">
              {isSaving ? 'Salvando...' : 'Salvar usuário'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
