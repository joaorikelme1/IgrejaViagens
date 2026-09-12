import { useState } from 'react'
import type {
  PaymentReceipt,
  PaymentRecord,
  ReceiptStatus,
} from '../model/paymentTypes'
import { safeReceiptData } from '../utils/receiptFile'

interface ReceiptViewerProps {
  onClose: () => void
  onUpload?: (installment: string, file: File) => Promise<void>
  onStatusChange?: (
    installment: string,
    status: ReceiptStatus,
    note?: string,
  ) => Promise<void>
  payment: PaymentRecord
  title: string
}

const statusLabels = {
  approved: 'Aprovado',
  pending: 'Pendente',
  rejected: 'Recusado',
} as const

export function ReceiptViewer({
  onClose,
  onUpload,
  onStatusChange,
  payment,
  title,
}: ReceiptViewerProps) {
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const entries: Array<[string, PaymentReceipt | undefined]> = onUpload
    ? Array.from(
        {
          length: Math.min(
            24,
            Math.max(1, Math.trunc(payment.totalInstallments) || 1),
          ),
        },
        (_, index) => {
          const installment = String(index + 1)
          return [installment, payment.receipts[installment]]
        },
      )
    : Object.entries(payment.receipts).sort(
        ([first], [second]) => Number(first) - Number(second),
      )

  const changeStatus = async (
    installment: string,
    status: ReceiptStatus,
    rejectionNote = '',
  ) => {
    if (!onStatusChange) return
    if (status === 'rejected' && !rejectionNote.trim()) {
      setError('Informe o motivo da recusa.')
      return
    }
    setError(null)
    setSaving(installment)
    try {
      await onStatusChange(installment, status, rejectionNote)
      setRejecting(null)
      setNote('')
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Não foi possível atualizar o comprovante.',
      )
    } finally {
      setSaving(null)
    }
  }

  const upload = async (installment: string, file: File) => {
    if (!onUpload) return
    setError(null)
    setUploading(installment)
    try {
      await onUpload(installment, file)
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

  return (
    <div className="payment-overlay">
      <section
        aria-labelledby="receipt-viewer-title"
        aria-modal="true"
        className="payment-modal receipt-viewer"
        role="dialog"
      >
        <header className="payment-modal__header">
          <div><h2 id="receipt-viewer-title">{title}</h2><p>Arquivos e metadados enviados por parcela.</p></div>
          <button aria-label="Fechar comprovantes" onClick={onClose} type="button">×</button>
        </header>
        <div className="payment-modal__body">
          {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
          {entries.length ? entries.map(([installment, receipt]) => {
            const preview = receipt ? safeReceiptData(receipt) : null
            return (
              <article className="receipt-card" key={installment}>
                <header>
                  <div>
                    <strong>Parcela {installment}</strong>
                    <span>
                      {receipt
                        ? `${receipt.filename || 'Arquivo sem nome'} · ${receipt.date || 'Data não informada'}`
                        : 'Nenhum arquivo enviado'}
                    </span>
                  </div>
                  <span className={`receipt-status is-${receipt?.status ?? 'none'}`}>
                    {receipt ? statusLabels[receipt.status] : 'Sem comprovante'}
                  </span>
                </header>
                {preview?.kind === 'image' ? <img alt={`Comprovante da parcela ${installment}`} src={preview.value} /> : null}
                {preview?.kind === 'pdf' ? <object aria-label={`PDF da parcela ${installment}`} data={preview.value} type="application/pdf" /> : null}
                {receipt && !preview ? <p className="receipt-missing">Comprovante sem arquivo válido anexado.</p> : null}
                {receipt?.note ? <p className="receipt-note">Motivo: {receipt.note}</p> : null}
                {preview && receipt ? <a download={receipt.filename || 'comprovante'} href={preview.value}>Baixar comprovante</a> : null}
                {onUpload || (onStatusChange && receipt) ? (
                  <div className="receipt-actions">
                    {onUpload ? (
                      <label className="receipt-upload-button">
                        {uploading === installment
                          ? 'Enviando...'
                          : receipt
                            ? 'Substituir comprovante'
                            : 'Anexar comprovante'}
                        <input
                          accept="image/*,.pdf"
                          aria-label={`${receipt ? 'Substituir' : 'Anexar'} comprovante da parcela ${installment}`}
                          disabled={uploading !== null || saving !== null}
                          onChange={(event) => {
                            const input = event.currentTarget
                            const file = input.files?.[0]
                            if (file) {
                              void upload(installment, file).finally(() => {
                                input.value = ''
                              })
                            }
                          }}
                          type="file"
                        />
                      </label>
                    ) : null}
                    {onStatusChange && receipt && receipt.status !== 'approved' ? <button disabled={saving !== null || uploading !== null} onClick={() => void changeStatus(installment, 'approved')} type="button">Aprovar</button> : null}
                    {onStatusChange && receipt && receipt.status !== 'approved' ? <button disabled={saving !== null || uploading !== null} onClick={() => setRejecting(installment)} type="button">Recusar</button> : null}
                  </div>
                ) : null}
                {receipt && rejecting === installment ? (
                  <div className="receipt-reject-form">
                    <label>Motivo da recusa<textarea onChange={(event) => setNote(event.currentTarget.value)} value={note} /></label>
                    <button disabled={saving !== null} onClick={() => void changeStatus(installment, 'rejected', note)} type="button">Confirmar recusa</button>
                  </div>
                ) : null}
              </article>
            )
          }) : <p className="payment-empty">Nenhum comprovante enviado.</p>}
        </div>
        <footer className="payment-modal__footer"><button onClick={onClose} type="button">Fechar</button></footer>
      </section>
    </div>
  )
}
