import type { FinancialSummaryValue } from '../model/paymentTypes'

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function FinancialSummary({ summary }: { summary: FinancialSummaryValue }) {
  const visualPercentage = Math.min(100, Math.max(0, summary.goalPercentage))
  return (
    <section aria-label="Resumo financeiro" className="financial-summary">
      <article><span>Arrecadado</span><strong>{currency(summary.collected)}</strong></article>
      <article><span>Valor pendente</span><strong>{currency(summary.pendingValue)}</strong></article>
      <article><span>Total previsto</span><strong>{currency(summary.expectedTotal)}</strong></article>
      <article><span>Meta</span><strong>{currency(summary.goal)}</strong></article>
      <div className="financial-summary__progress">
        <span><i style={{ width: `${visualPercentage}%` }} /></span>
        <strong>{Math.round(summary.goalPercentage)}% da meta</strong>
      </div>
      <p>{summary.completeCount} pago(s) · {summary.partialCount} parcial(is) · {summary.pendingCount} pendente(s)</p>
    </section>
  )
}
