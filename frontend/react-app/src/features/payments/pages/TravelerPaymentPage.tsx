import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { useTrip } from '../../trips/hooks/useTrip'
import type { Trip } from '../../trips/model/tripTypes'
import { listPayments, savePayment } from '../api/paymentApi'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { ReceiptViewer } from '../components/ReceiptViewer'
import { TravelerPaymentPlan } from '../components/TravelerPaymentPlan'
import { calculatePaymentProgress } from '../lib/paymentCalculations'
import type { PaymentMutation, PaymentRecord } from '../model/paymentTypes'
import { readReceiptFile } from '../utils/receiptFile'
import './payments.css'

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function TravelerPaymentContent({
  cpf,
  trip,
}: {
  cpf: string
  trip: Trip
}) {
  const [payment, setPayment] = useState<PaymentRecord | null | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [showReceipts, setShowReceipts] = useState(false)

  useEffect(() => {
    let current = true
    void listPayments()
      .then((payments) => {
        if (!current) return
        setPayment(
          payments.find(
            (item) => item.tripId === trip.id && item.userCpf === cpf,
          ) ?? null,
        )
      })
      .catch((loadError: unknown) => {
        if (!current) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar seu pagamento.',
        )
      })
    return () => {
      current = false
    }
  }, [cpf, trip.id])

  const persistPlan = async (mutation: PaymentMutation) => {
    setError(null)
    setFeedback(null)
    const saved = await savePayment(mutation)
    setPayment(saved)
    setFeedback('Parcelamento confirmado após a persistência.')
  }

  const attachReceipt = async (installment: string, file: File) => {
    if (!payment) return
    setError(null)
    setFeedback(null)
    setUploading(installment)
    try {
      const data = await readReceiptFile(file)
      const nextPayment: PaymentRecord = {
        ...payment,
        receipts: {
          ...payment.receipts,
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
      const saved = await savePayment(nextPayment)
      setPayment(saved)
      setFeedback('Comprovante enviado e aguardando análise.')
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Não foi possível anexar o comprovante.',
      )
    } finally {
      setUploading(null)
    }
  }

  if (error && payment === undefined) {
    return <p className="payment-page-status" role="alert">{error}</p>
  }
  if (payment === undefined) {
    return <p className="payment-page-status" role="status">Carregando pagamento...</p>
  }
  if (!(trip.price > 0)) {
    return <p className="payment-page-status">O administrador ainda não configurou o valor da viagem.</p>
  }

  const progress = calculatePaymentProgress(payment)
  const installmentCount = payment
    ? Math.min(24, Math.max(1, Math.trunc(payment.totalInstallments) || 1))
    : 0
  const installmentValue = installmentCount > 0 ? trip.price / installmentCount : 0

  return (
    <div className="payments-page traveler-payments">
      <header className="payments-intro">
        <div><span>Minha situação financeira</span><h2>{trip.name}</h2><p>Valor total: {currency(trip.price)}</p></div>
        <PaymentStatusBadge progress={progress} />
      </header>
      {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
      {feedback ? <p className="form-message is-success" role="status">{feedback}</p> : null}

      {!payment || !payment.locked ? (
        <TravelerPaymentPlan
          onSave={persistPlan}
          payment={payment ?? null}
          price={trip.price}
          tripId={trip.id}
          userCpf={cpf}
        />
      ) : (
        <section className="traveler-plan-summary">
          <div><span>Parcelamento</span><strong>{installmentCount}x de {currency(installmentValue)}</strong></div>
          <div><span>Vencimento</span><strong>Dia {payment.dueDay} de cada mês</strong></div>
          <div><span>Progresso</span><strong>{progress.paidInstallments}/{progress.totalInstallments} parcelas</strong></div>
          {progress.invalidData ? <p className="form-message is-error">Os dados recebidos são inconsistentes; os valores exibidos foram normalizados.</p> : null}
        </section>
      )}

      {payment?.locked ? (
        <section className="installment-panel">
          <header><div><h3>Parcelas</h3><p>Envie imagens ou PDF de até 4 MB.</p></div><button onClick={() => setShowReceipts(true)} type="button">Ver comprovantes</button></header>
          <div className="installment-list">
            {Array.from({ length: installmentCount }, (_, index) => {
              const installment = String(index + 1)
              const receipt = payment.receipts[installment]
              return (
                <article key={installment}>
                  <span>{installment}</span>
                  <div><strong>Parcela {installment}</strong><small>{currency(installmentValue)} · vencimento dia {payment.dueDay}</small>{receipt?.note ? <small className="payment-warning">Motivo: {receipt.note}</small> : null}</div>
                  <span className={`receipt-status is-${receipt?.status ?? 'none'}`}>{receipt ? receipt.status === 'approved' ? 'Aprovado' : receipt.status === 'rejected' ? 'Recusado' : 'Aguardando' : 'Sem comprovante'}</span>
                  {receipt?.status !== 'approved' ? (
                    <label className="receipt-upload-button">
                      {uploading === installment ? 'Enviando...' : receipt ? 'Reenviar' : 'Anexar'}
                      <input
                        accept="image/*,.pdf"
                        disabled={uploading !== null}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0]
                          if (file) void attachReceipt(installment, file)
                        }}
                        type="file"
                      />
                    </label>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {showReceipts && payment ? (
        <ReceiptViewer
          onClose={() => setShowReceipts(false)}
          payment={payment}
          title="Meus comprovantes"
        />
      ) : null}
    </div>
  )
}

export function TravelerPaymentPage() {
  const { user } = useAuth()
  const { activeTrip } = useTrip()
  if (!user || !activeTrip) return null
  return <TravelerPaymentContent cpf={user.cpf} key={`${user.cpf}-${activeTrip.id}`} trip={activeTrip} />
}
