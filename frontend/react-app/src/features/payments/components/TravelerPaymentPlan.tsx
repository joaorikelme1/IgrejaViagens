import { useState, type FormEvent } from 'react'
import type { PaymentMutation, PaymentRecord } from '../model/paymentTypes'

interface TravelerPaymentPlanProps {
  onSave: (mutation: PaymentMutation) => Promise<void>
  payment: PaymentRecord | null
  price: number
  tripId: string
  userCpf: string
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function TravelerPaymentPlan({
  onSave,
  payment,
  price,
  tripId,
  userCpf,
}: TravelerPaymentPlanProps) {
  const [total, setTotal] = useState(
    Math.min(24, Math.max(1, payment?.totalInstallments ?? 1)),
  )
  const [dueDay, setDueDay] = useState(
    Math.min(31, Math.max(1, payment?.dueDay ?? 10)),
  )
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setError(null)
    setIsSaving(true)
    try {
      await onSave({
        dueDay,
        id: payment?.id,
        locked: true,
        paidInstallments: payment?.paidInstallments ?? 0,
        receipts: payment?.receipts ?? {},
        totalInstallments: total,
        tripId,
        userCpf,
      })
      setIsConfirming(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível confirmar o parcelamento.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="traveler-plan">
      <header><h3>Configure seu parcelamento</h3><p>Após confirmar, somente um administrador poderá editar o plano.</p></header>
      {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          setIsConfirming(true)
        }}
      >
        <label>Quantidade de parcelas<select onChange={(event) => setTotal(Number(event.currentTarget.value))} value={total}>{Array.from({ length: 12 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}x</option>)}</select></label>
        <label>Dia do vencimento<input max="31" min="1" onChange={(event) => setDueDay(Math.min(31, Math.max(1, Math.trunc(Number(event.currentTarget.value)) || 1)))} type="number" value={dueDay} /></label>
        <div><span>Valor por parcela</span><strong>{currency(price / total)}</strong></div>
        <button type="submit">Confirmar parcelamento</button>
      </form>
      {isConfirming ? (
        <div className="payment-overlay">
          <section aria-labelledby="confirm-plan-title" aria-modal="true" className="payment-modal confirm-plan-modal" role="dialog">
            <div className="payment-modal__body"><h2 id="confirm-plan-title">Confirmar parcelamento?</h2><p>{total} parcela(s) de {currency(price / total)}, com vencimento no dia {dueDay}. Essa escolha ficará bloqueada para o viajante.</p></div>
            <footer className="payment-modal__footer"><button disabled={isSaving} onClick={() => setIsConfirming(false)} type="button">Voltar</button><button className="is-primary" disabled={isSaving} onClick={() => void confirm()} type="button">{isSaving ? 'Persistindo...' : 'Confirmar e salvar'}</button></footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}
