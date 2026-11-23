import { maskCpf } from '../../../shared/validation/cpf'
import type { TripTravelerRow } from '../lib/buildTripTravelers'

export function TravelerDetailsModal({
  onClose,
  row,
}: {
  onClose: () => void
  row: TripTravelerRow
}) {
  return (
    <div className="user-management-overlay">
      <section
        aria-labelledby="traveler-details-title"
        aria-modal="true"
        className="user-management-modal traveler-details-modal"
        role="dialog"
      >
        <header className="user-management-modal__header">
          <div>
            <h2 id="traveler-details-title">Detalhes de {row.user.name}</h2>
            <p>{maskCpf(row.user.cpf)}</p>
          </div>
          <button aria-label="Fechar detalhes" onClick={onClose} type="button">×</button>
        </header>
        <div className="user-management-modal__body">
          <dl className="traveler-details-grid">
            <div><dt>Estado civil</dt><dd>{row.user.married ? 'Casado(a)' : 'Solteiro(a)'}</dd></div>
            <div>
              <dt>{row.user.spouseCpf ? 'Cônjuge vinculado' : 'Nome informado do cônjuge'}</dt>
              <dd>{row.user.married && row.user.spouseName ? row.user.spouseName : '—'}</dd>
            </div>
            <div><dt>Filhos</dt><dd>{row.user.hasKids && row.user.kids.length ? row.user.kids.join(', ') : 'Nenhum'}</dd></div>
            <div><dt>Assento</dt><dd>{row.seatLabel}</dd></div>
            <div><dt>Quarto</dt><dd>{row.roomLabel}</dd></div>
            <div>
              <dt>Pagamento</dt>
              <dd>
                {row.payment
                  ? `${row.payment.paidInstallments}/${row.payment.totalInstallments} parcelas · ${row.payment.percentage}%`
                  : 'Não configurado'}
              </dd>
            </div>
          </dl>
          <p className="relationship-note">
            {row.user.spouseCpf
              ? 'Este cadastro possui vínculo familiar confirmado e participa da distribuição automática.'
              : 'Familiares apenas informados por nome são associados automaticamente somente quando o cadastro correspondente é único.'}
          </p>
          <section className="receipt-summary" aria-labelledby="receipt-title">
            <h3 id="receipt-title">Comprovantes</h3>
            {row.payment?.receipts.length ? (
              <ul>
                {row.payment.receipts.map((receipt) => (
                  <li key={`${receipt.installment}-${receipt.fileName}`}>
                    <strong>Parcela {receipt.installment}</strong>
                    <span>{receipt.fileName} · {receipt.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum comprovante enviado.</p>
            )}
          </section>
        </div>
        <footer className="user-management-modal__footer">
          <button onClick={onClose} type="button">Fechar</button>
        </footer>
      </section>
    </div>
  )
}
