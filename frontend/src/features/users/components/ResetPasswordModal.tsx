import { useState, type FormEvent } from 'react'
import type { SystemUser } from '../model/userTypes'

interface ResetPasswordModalProps {
  onCancel: () => void
  onConfirm: (password: string) => Promise<void>
  user: SystemUser
}

export function ResetPasswordModal({ onCancel, onConfirm, user }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onConfirm(password)
      onCancel()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível redefinir a senha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="user-management-overlay">
      <section aria-labelledby="reset-password-title" aria-modal="true" className="user-management-modal user-confirm-modal" role="dialog">
        <form onSubmit={(event) => void submit(event)}>
          <div className="user-management-modal__body">
            <h2 id="reset-password-title">Redefinir acesso de {user.name}</h2>
            <p>A senha será temporária e a troca será obrigatória no próximo acesso.</p>
            <label className="user-field">Senha temporária<input autoComplete="new-password" disabled={saving} minLength={10} onChange={(event) => setPassword(event.currentTarget.value)} type="password" value={password} /></label>
            {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
          </div>
          <footer className="user-management-modal__footer">
            <button disabled={saving} onClick={onCancel} type="button">Cancelar</button>
            <button className="is-primary" disabled={saving || !password} type="submit">{saving ? 'Redefinindo...' : 'Redefinir acesso'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
