import { maskCpf } from '../../../shared/validation/cpf'
import type { PaymentRow } from '../model/paymentTypes'
import { PaymentStatusBadge } from './PaymentStatusBadge'

interface PaymentTableProps {
  onEdit: (row: PaymentRow) => void
  onReceipts: (row: PaymentRow) => void
  rows: PaymentRow[]
}

export function PaymentTable({
  onEdit,
  onReceipts,
  rows,
}: PaymentTableProps) {
  return (
    <div className="payment-table-wrap">
      <table className="payment-table">
        <thead><tr><th>Viajante</th><th>Plano</th><th>Situação</th><th>Comprovantes</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.userCpf}>
              <td><strong>{row.name}</strong><small>{maskCpf(row.userCpf)}</small></td>
              <td>
                {row.payment
                  ? `${row.progress.totalInstallments}x · dia ${row.payment.dueDay}${row.payment.locked ? ' · confirmado' : ''}`
                  : 'Não configurado'}
                {row.progress.invalidData ? <small className="payment-warning">Dados inconsistentes</small> : null}
              </td>
              <td><PaymentStatusBadge progress={row.progress} /></td>
              <td>
                {row.payment && Object.keys(row.payment.receipts).length
                  ? `${Object.keys(row.payment.receipts).length} enviado(s) · ${row.pendingReceipts} pendente(s)`
                  : 'Nenhum comprovante'}
              </td>
              <td>
                <div className="payment-row-actions">
                  {row.payment ? (
                    <>
                      <button onClick={() => onEdit(row)} type="button">Editar</button>
                      <button onClick={() => onReceipts(row)} type="button">Comprovantes</button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          )) : <tr><td className="payment-empty" colSpan={5}>Nenhum pagamento encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
