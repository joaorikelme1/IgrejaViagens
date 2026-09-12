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
import { printPaymentReport } from '../utils/paymentReport'
import { readReceiptFile } from '../utils/receiptFile'
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
  const [reportError, setReportError] = useState<string | null>(null)
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
  const receiptOwnerName = receiptPayment
    ? rows.find((row) => row.userCpf === receiptPayment.userCpf)?.name
    : null
  const usersWithoutPayment = (source?.users ?? []).filter(
    (user) =>
      trip.travelerCpfs.includes(user.cpf) &&
      !rows.some((row) => row.userCpf === user.cpf && row.payment),
  )

  const generateReport = () => {
    if (!summary) return
    setReportError(null)
    const opened = printPaymentReport({ rows, summary, trip })
    if (opened) {
      setFeedback('Relatório aberto. Escolha “Salvar como PDF” ou imprima o documento.')
      return
    }
    setFeedback(null)
    setReportError('O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente.')
  }
  const paymentRegistrationHint = rows.length === 0
    ? 'Cadastre um viajante antes de registrar o pagamento.'
    : usersWithoutPayment.length === 0
      ? 'Todos os viajantes já possuem pagamento. Para lançar ou corrigir parcelas, use “Editar” na tabela.'
      : null

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

  const uploadReceipt = async (installment: string, file: File) => {
    if (!receiptPayment) return
    setFeedback(null)
    const data = await readReceiptFile(file)
    const withReceipt: PaymentRecord = {
      ...receiptPayment,
      receipts: {
        ...receiptPayment.receipts,
        [installment]: {
          data,
          date: new Intl.DateTimeFormat('pt-BR').format(new Date()),
          filename: file.name,
          note: '',
          status: 'pending',
          type: file.type,
        },
      },
    }
    const updated = paymentWithReceiptStatus(
      withReceipt,
      installment,
      'pending',
    )
    const saved = await savePayment(updated)
    replaceLocalPayment(saved)
    setReceiptPayment(saved)
    setFeedback('Comprovante anexado pelo administrador e aguardando aprovação.')
  }

  if (loadError) return <p className="payment-page-status" role="alert">{loadError}</p>
  if (!source || !summary) return <p className="payment-page-status" role="status">Carregando pagamentos...</p>

  return (
    <div className="payments-page">
      <header className="payments-intro">
        <div><span>Gestão financeira</span><h2>Pagamentos de {trip.name}</h2><p>Acompanhamento dos viajantes da viagem ativa.</p></div>
        <div className="payment-page-actions">
          <button onClick={generateReport} type="button">Gerar relatório PDF</button>
          <div
            aria-describedby={paymentRegistrationHint ? 'payment-registration-hint' : undefined}
            className="payment-registration-action"
            tabIndex={paymentRegistrationHint ? 0 : undefined}
          >
            <button
              aria-describedby={paymentRegistrationHint ? 'payment-registration-hint' : undefined}
              className="payment-primary-action"
              disabled={Boolean(paymentRegistrationHint)}
              onClick={() => setFormPayment(null)}
              type="button"
            >
              Registrar pagamento
            </button>
            {paymentRegistrationHint ? (
              <span
                className="payment-registration-tooltip"
                id="payment-registration-hint"
                role="tooltip"
              >
                {paymentRegistrationHint}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      <aside className="payment-info-banner">
        Os valores abaixo são estimativas calculadas no cliente a partir das parcelas. A validação financeira definitiva deve ser feita pelo backend.
      </aside>
      {reportError ? <p className="form-message is-error" role="alert">{reportError}</p> : null}
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
          onUpload={uploadReceipt}
          payment={receiptPayment}
          title={
            receiptOwnerName
              ? `Comprovantes de ${receiptOwnerName}`
              : 'Comprovantes do pagamento'
          }
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
