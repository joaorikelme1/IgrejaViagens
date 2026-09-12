import { maskCpf } from '../../../shared/validation/cpf'
import type { TripTravelerRow } from '../lib/buildTripTravelers'

interface TravelerTableProps {
  onEdit: (row: TripTravelerRow) => void
  onRemove: (row: TripTravelerRow) => void
  onView: (row: TripTravelerRow) => void
  rows: TripTravelerRow[]
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR').format(date)
}

export function TravelerTable({
  onEdit,
  onRemove,
  onView,
  rows,
}: TravelerTableProps) {
  return (
    <div className="user-table-wrap">
      <table className="user-table">
        <thead>
          <tr>
            <th>Viajante</th>
            <th>Nascimento</th>
            <th>Assento</th>
            <th>Quarto</th>
            <th>Pagamento</th>
            <th>Comprovantes</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.user.cpf}>
                <td>
                  <div className="user-identity">
                    <span>{row.user.name.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{row.user.name}</strong>
                      <small>{maskCpf(row.user.cpf)}</small>
                    </div>
                  </div>
                </td>
                <td>{formatDate(row.user.birthdate)}</td>
                <td>{row.seatLabel}</td>
                <td>{row.roomLabel}</td>
                <td>
                  {row.payment ? (
                    <span className={`user-badge payment-${row.payment.percentage}`}>
                      {row.payment.percentage}%
                    </span>
                  ) : (
                    <span className="user-badge is-muted">Não configurado</span>
                  )}
                </td>
                <td>
                  {row.pendingReceipts > 0
                    ? `${row.pendingReceipts} pendente(s)`
                    : row.payment?.receipts.length
                      ? `${row.payment.receipts.length} enviado(s)`
                      : '—'}
                </td>
                <td>
                  <div className="user-row-actions">
                    <button onClick={() => onEdit(row)} type="button">Editar</button>
                    <button onClick={() => onView(row)} type="button">Detalhes</button>
                    <button
                      className="is-danger"
                      onClick={() => onRemove(row)}
                      type="button"
                    >
                      Remover da viagem
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="user-empty" colSpan={7}>Nenhum viajante encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
