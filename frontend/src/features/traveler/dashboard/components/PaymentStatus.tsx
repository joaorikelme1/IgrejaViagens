import type { TravelerPaymentView } from '../model/travelerDashboardTypes'

const statusLabels = {
  confirmed: 'Confirmado',
  partial: 'Parcial',
  pending: 'Pendente',
  unconfigured: 'Não configurado',
} as const

export function PaymentStatus({ payment }: { payment: TravelerPaymentView }) {
  const detail =
    payment.status === 'unconfigured'
      ? 'Nenhum pagamento associado'
      : `${payment.paidInstallments}/${payment.totalInstallments} parcelas · ${payment.percentage}% pago`

  return (
    <div className="payment-status">
      <span className={`payment-status__badge is-${payment.status}`}>
        {statusLabels[payment.status]}
      </span>
      <span>{detail}</span>
    </div>
  )
}
