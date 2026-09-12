import { useState, type FormEvent } from 'react'
import { completeFirstAccess } from '../api/authApi'
import type { AuthUser } from '../model/authTypes'
import { AuthIcon } from './AuthIcon'

interface FirstAccessModalProps {
  user: AuthUser
  onComplete: (user: AuthUser) => void
}

function getFirstAccessError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível salvar a nova senha.'
}

export function FirstAccessModal({
  user,
  onComplete,
}: FirstAccessModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (newPassword.length < 8) {
      setErrorMessage('A senha deve ter ao menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmation) {
      setErrorMessage('As senhas não coincidem.')
      return
    }

    setIsSubmitting(true)

    try {
      const updatedUser = await completeFirstAccess(user, newPassword)
      setNewPassword('')
      setConfirmation('')
      onComplete(updatedUser)
    } catch (error) {
      setErrorMessage(getFirstAccessError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="first-access-overlay">
      <section
        aria-labelledby="first-access-title"
        aria-modal="true"
        className="first-access-modal"
        role="dialog"
      >
        <header className="first-access-header">
          <h2 id="first-access-title">
            <AuthIcon name="key" />
            Crie sua senha
          </h2>
        </header>

        <div className="first-access-body">
          <div className="first-access-info">
            <AuthIcon name="info" />
            <span>
              Este é o seu primeiro acesso. Por segurança, crie uma senha
              pessoal.
            </span>
          </div>

          <form
            aria-busy={isSubmitting}
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="auth-field auth-field--light">
              <label htmlFor="new-password">Nova senha</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <AuthIcon name="lock" />
                </span>
                <input
                  autoComplete="new-password"
                  autoFocus
                  disabled={isSubmitting}
                  id="new-password"
                  minLength={8}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  type="password"
                  value={newPassword}
                />
              </div>
            </div>

            <div className="auth-field auth-field--light">
              <label htmlFor="confirm-password">Confirmar senha</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <AuthIcon name="lock" />
                </span>
                <input
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  id="confirm-password"
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Repita a senha"
                  type="password"
                  value={confirmation}
                />
              </div>
            </div>

            {errorMessage ? (
              <div className="auth-error auth-error--light" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <footer className="first-access-footer">
              <button
                className="auth-submit auth-submit--compact"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <span className="auth-spinner" aria-hidden="true" />
                ) : null}
                {isSubmitting ? 'Salvando...' : 'Salvar e entrar'}
                {!isSubmitting ? <AuthIcon name="arrowRight" /> : null}
              </button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  )
}
