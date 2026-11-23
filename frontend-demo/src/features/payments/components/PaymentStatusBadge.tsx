import type { PaymentProgress } from '../model/paymentTypes'

const labels = {
  complete: 'Pago',
  partial: 'Parcial',
  pending: 'Pendente',
  unconfigured: 'Não configurado',
} as const

export function PaymentStatusBadge({ progress }: { progress: PaymentProgress }) {
  return (
    <span className={`payment-badge is-${progress.status}`}>
      {labels[progress.status]}
      {progress.status !== 'unconfigured' ? ` · ${progress.percentage}%` : ''}
    </span>
  )
}
