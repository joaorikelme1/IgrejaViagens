import { useState, type FormEvent } from 'react'
import { maskCpf } from '../../../shared/validation/cpf'
import type { SystemUser } from '../../users/model/userTypes'
import type { PaymentMutation, PaymentRecord } from '../model/paymentTypes'

interface PaymentFormProps {
  onClose: () => void
  onSubmit: (mutation: PaymentMutation) => Promise<void>
  payment?: PaymentRecord
  tripId: string
  users: SystemUser[]
}

export function PaymentForm({
  onClose,
  onSubmit,
  payment,
  tripId,
  users,
}: PaymentFormProps) {
  const [userCpf, setUserCpf] = useState(payment?.userCpf ?? users[0]?.cpf ?? '')
  const [totalInstallments, setTotalInstallments] = useState(
    Math.max(1, payment?.totalInstallments ?? 1),
  )
  const [paidInstallments, setPaidInstallments] = useState(
    Math.max(0, payment?.paidInstallments ?? 0),
  )
  const [dueDay, setDueDay] = useState(Math.max(1, payment?.dueDay ?? 10))
  const [locked, setLocked] = useState(payment?.locked ?? false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!userCpf) {
      setError('Selecione um viajante.')
      return
    }
    try {
      setIsSaving(true)
      await onSubmit({
        dueDay,
        id: payment?.id,
        locked,
        paidInstallments,
        receipts: payment?.receipts ?? {},
        totalInstallments,
        tripId,
        userCpf,
      })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível salvar o pagamento.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="payment-overlay">
      <section
        aria-labelledby="payment-form-title"
        aria-modal="true"
        className="payment-modal"
        role="dialog"
      >
        <header className="payment-modal__header">
          <div>
            <h2 id="payment-form-title">
              {payment ? 'Editar pagamento' : 'Registrar pagamento'}
            </h2>
            <p>Configure o parcelamento e a situação registrada.</p>
          </div>
          <button aria-label="Fechar formulário" onClick={onClose} type="button">×</button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="payment-modal__body payment-form-grid">
            {error ? <p className="form-message is-error payment-field--wide" role="alert">{error}</p> : null}
            <label className="payment-field payment-field--wide">
              Viajante
              <select
                disabled={isSaving || Boolean(payment)}
                onChange={(event) => setUserCpf(event.currentTarget.value)}
                value={userCpf}
              >
                {users.map((user) => (
                  <option key={user.cpf} value={user.cpf}>
                    {user.name} · {maskCpf(user.cpf)}
                  </option>
                ))}
              </select>
            </label>
            <label className="payment-field">
              Total de parcelas
              <input
                disabled={isSaving}
                max="24"
                min="1"
                onChange={(event) => {
                  const total = Math.min(
                    24,
                    Math.max(1, Math.trunc(Number(event.currentTarget.value)) || 1),
                  )
                  setTotalInstallments(total)
                  setPaidInstallments((paid) => Math.min(paid, total))
                }}
                type="number"
                value={totalInstallments}
              />
            </label>
            <label className="payment-field">
              Parcelas pagas
              <input
                disabled={isSaving}
                max={Math.max(1, totalInstallments)}
                min="0"
                onChange={(event) =>
                  setPaidInstallments(
                    Math.min(
                      totalInstallments,
                      Math.max(
                        0,
                        Math.trunc(Number(event.currentTarget.value)) || 0,
                      ),
                    ),
                  )
                }
                type="number"
                value={paidInstallments}
              />
            </label>
            <label className="payment-field">
              Dia de vencimento
              <input
                disabled={isSaving}
                max="31"
                min="1"
                onChange={(event) =>
                  setDueDay(
                    Math.min(
                      31,
                      Math.max(
                        1,
                        Math.trunc(Number(event.currentTarget.value)) || 1,
                      ),
                    ),
                  )
                }
                type="number"
                value={dueDay}
              />
            </label>
            <label className="payment-check-field">
              <input
                checked={locked}
                disabled={isSaving}
                onChange={(event) => setLocked(event.currentTarget.checked)}
                type="checkbox"
              />
              Parcelamento confirmado
            </label>
          </div>
          <footer className="payment-modal__footer">
            <button disabled={isSaving} onClick={onClose} type="button">Cancelar</button>
            <button className="is-primary" disabled={isSaving} type="submit">
              {isSaving ? 'Salvando...' : 'Salvar pagamento'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
