import { useState, type FormEvent } from 'react'
import { ApiError } from '../../../lib/http'
import { isValidCpf, maskCpf, stripCpf } from '../../../shared/validation/cpf'
import { login } from '../api/authApi'
import { AuthIcon } from '../components/AuthIcon'
import { FirstAccessModal } from '../components/FirstAccessModal'
import type { AuthUser } from '../model/authTypes'
import './login.css'

interface LoginPageProps {
  onAuthenticated: (user: AuthUser) => void
}

function getLoginError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'CPF ou senha incorretos.'
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'A conexão demorou demais. Tente novamente.'
  }

  return 'Não foi possível entrar. Verifique a conexão e tente novamente.'
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [cpfTouched, setCpfTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [firstAccessUser, setFirstAccessUser] = useState<AuthUser | null>(null)

  const cpfDigits = stripCpf(cpf)
  const cpfIsValid = isValidCpf(cpfDigits)
  const showCpfFeedback = cpfTouched && cpfDigits.length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCpfTouched(true)
    setErrorMessage(null)

    if (!cpfIsValid) {
      setErrorMessage('CPF inválido.')
      return
    }

    if (!password) {
      setErrorMessage('Informe sua senha.')
      return
    }

    setIsSubmitting(true)

    try {
      const authenticatedUser = await login({ cpf: cpfDigits, password })
      setPassword('')

      if (authenticatedUser.firstLogin) {
        setFirstAccessUser(authenticatedUser)
        return
      }

      onAuthenticated(authenticatedUser)
    } catch (error) {
      setErrorMessage(getLoginError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-lines" aria-hidden="true" />

      <section className="login-intro" aria-labelledby="login-intro-title">
        <div className="login-badge">
          <img src="/imagens/logo.png" alt="" />
          Sistema de Viagens
        </div>
        <h1 id="login-intro-title">
          Sua <em>jornada</em> começa aqui.
        </h1>
        <p>
          Organize, acompanhe e gerencie viagens da sua comunidade com
          praticidade e beleza.
        </p>
        <ul className="login-features">
          <li>Controle total de pagamentos e parcelas</li>
          <li>Gestão de assentos e quartos de hotel</li>
          <li>Passagem digital com download em PDF</li>
          <li>Dashboard administrativo completo</li>
        </ul>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <img
            className="login-logo"
            src="/imagens/logo.png"
            alt="Igreja Viagens"
          />
          <h2 id="login-title">Bem-vindo(a)</h2>
          <p className="login-subtitle">Faça login para acessar sua viagem</p>

          <form
            aria-busy={isSubmitting}
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="auth-field">
              <label htmlFor="login-cpf">CPF</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <AuthIcon name="user" />
                </span>
                <input
                  aria-describedby="cpf-feedback"
                  aria-invalid={showCpfFeedback && !cpfIsValid}
                  autoComplete="username"
                  className={
                    showCpfFeedback
                      ? cpfIsValid
                        ? 'is-valid'
                        : 'is-invalid'
                      : undefined
                  }
                  disabled={isSubmitting}
                  id="login-cpf"
                  inputMode="numeric"
                  maxLength={14}
                  onBlur={() => setCpfTouched(true)}
                  onChange={(event) => {
                    setCpf(maskCpf(event.target.value))
                    setErrorMessage(null)
                  }}
                  placeholder="000.000.000-00"
                  type="text"
                  value={cpf}
                />
              </div>
              <span
                className={`cpf-feedback ${
                  showCpfFeedback ? (cpfIsValid ? 'is-ok' : 'is-error') : ''
                }`}
                id="cpf-feedback"
              >
                {showCpfFeedback
                  ? cpfIsValid
                    ? 'CPF válido'
                    : 'CPF inválido.'
                  : ''}
              </span>
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Senha</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <AuthIcon name="lock" />
                </span>
                <input
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  id="login-password"
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setErrorMessage(null)
                  }}
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="password-toggle"
                  disabled={isSubmitting}
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  <AuthIcon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="auth-error" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="auth-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <span className="auth-spinner" aria-hidden="true" />
              ) : null}
              {isSubmitting ? 'Entrando...' : 'Entrar'}
              {!isSubmitting ? <AuthIcon name="arrowRight" /> : null}
            </button>
          </form>
        </div>
      </section>

      {firstAccessUser ? (
        <FirstAccessModal
          onComplete={(updatedUser) => {
            setFirstAccessUser(null)
            onAuthenticated(updatedUser)
          }}
          user={firstAccessUser}
        />
      ) : null}
    </main>
  )
}
