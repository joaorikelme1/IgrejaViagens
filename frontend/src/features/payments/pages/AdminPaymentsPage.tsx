import { useEffect, useMemo, useState } from 'react'
import { stripCpf } from '../../../shared/validation/cpf'
import { useTrip } from '../../trips/hooks/useTrip'
import type { Trip } from '../../trips/model/tripTypes'
import { loadPaymentSource, savePayment } from '../api/paymentApi'
import { FinancialSummary } from '../components/FinancialSummary'
import { PaymentForm } from '../components/PaymentForm'
import { PaymentTable } from '../components/PaymentTable'
import { ReceiptViewer } from '../components/ReceiptViewer'
import { buildPaymentRows, paymentWithReceiptStatus } from '../lib/buildPaymentRows'
import { calculateFinancialSummary } from '../lib/paymentCalculations'
import type {
  PaymentMutation,
  PaymentRecord,
  PaymentSource,
  PaymentStatus,
  ReceiptStatus,
} from '../model/paymentTypes'
import './payments.css'

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar os pagamentos.'
}

function AdminPaymentsContent({ trip }: { trip: Trip }) {
  const [source, setSource] = useState<PaymentSource | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all')
  const [formPayment, setFormPayment] = useState<PaymentRecord | null | undefined>()
  const [receiptPayment, setReceiptPayment] = useState<PaymentRecord | null>(null)

  useEffect(() => {
    let current = true
    void loadPaymentSource()
      .then((loaded) => {
        if (current) setSource(loaded)
      })
      .catch((error: unknown) => {
        if (current) setLoadError(errorMessage(error))
      })
    return () => {
      current = false
    }
  }, [])

  const rows = useMemo(
    () => (source ? buildPaymentRows(trip, source) : []),
    [source, trip],
  )
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    const digits = stripCpf(query)
    return rows.filter(
      (row) =>
        (status === 'all' || row.progress.status === status) &&
        (!normalized ||
          row.name.toLocaleLowerCase('pt-BR').includes(normalized) ||
          (digits.length > 0 && row.userCpf.includes(digits))),
    )
  }, [query, rows, status])
  const summary = source
    ? calculateFinancialSummary(trip, source.payments)
    : null
  const usersWithoutPayment = (source?.users ?? []).filter(
    (user) =>
      user.role === 'traveler' &&
      trip.travelerCpfs.includes(user.cpf) &&
      !rows.some((row) => row.userCpf === user.cpf && row.payment),
  )

  const replaceLocalPayment = (saved: PaymentRecord) => {
    setSource((current) => {
      if (!current) return current
      const exists = current.payments.some((payment) => payment.id === saved.id)
      return {
        ...current,
        payments: exists
          ? current.payments.map((payment) =>
              payment.id === saved.id ? saved : payment,
            )
          : [...current.payments, saved],
      }
    })
  }

  const persist = async (mutation: PaymentMutation) => {
    setFeedback(null)
    const saved = await savePayment(mutation)
    replaceLocalPayment(saved)
    setFeedback('Pagamento persistido com sucesso.')
  }

  const updateReceiptStatus = async (
    installment: string,
    nextStatus: ReceiptStatus,
    note = '',
  ) => {
    if (!receiptPayment) return
    setFeedback(null)
    const updated = paymentWithReceiptStatus(
      receiptPayment,
      installment,
      nextStatus,
      note,
    )
    const saved = await savePayment(updated)
    replaceLocalPayment(saved)
    setReceiptPayment(saved)
    setFeedback(
      nextStatus === 'approved'
        ? 'Comprovante aprovado após persistência.'
        : 'Comprovante recusado após persistência.',
    )
  }

  if (loadError) return <p className="payment-page-status" role="alert">{loadError}</p>
  if (!source || !summary) return <p className="payment-page-status" role="status">Carregando pagamentos...</p>

  return (
    <div className="payments-page">
      <header className="payments-intro">
        <div><span>Gestão financeira</span><h2>Pagamentos de {trip.name}</h2><p>Acompanhamento dos viajantes da viagem ativa.</p></div>
        <button
          className="payment-primary-action"
          disabled={usersWithoutPayment.length === 0}
          onClick={() => setFormPayment(null)}
          type="button"
        >
          Registrar pagamento
        </button>
      </header>
      <aside className="payment-info-banner">
        Os valores abaixo são estimativas calculadas no cliente a partir das parcelas. A validação financeira definitiva deve ser feita pelo backend.
      </aside>
      {feedback ? <p className="form-message is-success" role="status">{feedback}</p> : null}
      <FinancialSummary summary={summary} />

      <section className="payment-panel">
        <header className="payment-panel__header">
          <div><h3>Situação por viajante</h3><small>{rows.length} registro(s)</small></div>
          <div className="payment-filters">
            <label>Buscar por nome ou CPF<input onChange={(event) => setQuery(event.currentTarget.value)} value={query} /></label>
            <label>Situação<select onChange={(event) => setStatus(event.currentTarget.value as PaymentStatus | 'all')} value={status}><option value="all">Todas</option><option value="complete">Pagos</option><option value="partial">Parciais</option><option value="pending">Pendentes</option><option value="unconfigured">Não configurados</option></select></label>
          </div>
        </header>
        <PaymentTable
          onEdit={(row) => setFormPayment(row.payment)}
          onReceipts={(row) => setReceiptPayment(row.payment)}
          rows={filteredRows}
        />
      </section>

      {formPayment !== undefined ? (
        <PaymentForm
          onClose={() => setFormPayment(undefined)}
          onSubmit={persist}
          payment={formPayment ?? undefined}
          tripId={trip.id}
          users={formPayment ? source.users.filter((user) => user.cpf === formPayment.userCpf) : usersWithoutPayment}
        />
      ) : null}
      {receiptPayment ? (
        <ReceiptViewer
          onClose={() => setReceiptPayment(null)}
          onStatusChange={updateReceiptStatus}
          payment={receiptPayment}
          title="Comprovantes do pagamento"
        />
      ) : null}
    </div>
  )
}

export function AdminPaymentsPage() {
  const { activeTrip } = useTrip()
  if (!activeTrip) return null
  return <AdminPaymentsContent key={activeTrip.id} trip={activeTrip} />
}
