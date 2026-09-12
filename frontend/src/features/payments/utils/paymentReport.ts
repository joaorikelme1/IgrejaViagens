import { maskCpf } from '../../../shared/validation/cpf'
import type { Trip } from '../../trips/model/tripTypes'
import type {
  FinancialSummaryValue,
  PaymentRow,
  PaymentStatus,
} from '../model/paymentTypes'

interface PaymentReportData {
  generatedAt?: Date
  rows: PaymentRow[]
  summary: FinancialSummaryValue
  trip: Trip
}

const statusLabels: Record<PaymentStatus, string> = {
  complete: 'Pago',
  partial: 'Parcial',
  pending: 'Pendente',
  unconfigured: 'Não configurado',
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0)
}

function formatTripDate(value: string) {
  if (!value) return 'Não informada'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR').format(date)
}

function receiptSummary(row: PaymentRow) {
  if (!row.payment) return '—'
  const receipts = Object.values(row.payment.receipts)
  if (!receipts.length) return 'Nenhum'
  const approved = receipts.filter((receipt) => receipt.status === 'approved').length
  const pending = receipts.filter((receipt) => receipt.status === 'pending').length
  const rejected = receipts.filter((receipt) => receipt.status === 'rejected').length
  return `${approved} aprovado(s), ${pending} pendente(s), ${rejected} recusado(s)`
}

function financialValues(row: PaymentRow, price: number) {
  const ratio = row.progress.totalInstallments > 0
    ? row.progress.paidInstallments / row.progress.totalInstallments
    : 0
  const paid = Math.max(0, price) * ratio
  return { paid, pending: Math.max(0, price - paid) }
}

export function buildPaymentReportHtml({
  generatedAt = new Date(),
  rows,
  summary,
  trip,
}: PaymentReportData) {
  const generatedLabel = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(generatedAt)
  const orderedRows = [...rows].sort((first, second) =>
    first.name.localeCompare(second.name, 'pt-BR'),
  )
  const tableRows = orderedRows.map((row) => {
    const values = financialValues(row, trip.price)
    const plan = row.payment
      ? `${row.progress.paidInstallments}/${row.progress.totalInstallments} parcelas · venc. dia ${row.payment.dueDay}`
      : 'Não configurado'
    return `
      <tr>
        <td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(maskCpf(row.userCpf))}</small></td>
        <td>${escapeHtml(plan)}</td>
        <td><span class="status status--${row.progress.status}">${escapeHtml(statusLabels[row.progress.status])} · ${row.progress.percentage}%</span></td>
        <td>${escapeHtml(formatCurrency(values.paid))}</td>
        <td>${escapeHtml(formatCurrency(values.pending))}</td>
        <td>${escapeHtml(receiptSummary(row))}</td>
      </tr>`
  }).join('')

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatório geral - ${escapeHtml(trip.name)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1b1f55; font: 12px/1.45 Arial, sans-serif; }
    header { display: flex; justify-content: space-between; gap: 24px; padding: 15px 18px; border-radius: 10px; background: linear-gradient(120deg, #151d71, #303b9c); color: white; }
    .brand { display: block; margin-bottom: 5px; color: #bfc7ff; font-size: 8px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 0 0 5px; font-size: 22px; }
    header p, header small { margin: 0; color: #e4e7ff; }
    .generated { text-align: right; white-space: nowrap; }
    .trip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 14px 0; }
    .trip div, .summary div { padding: 9px 10px; border: 1px solid #d8dbea; border-radius: 6px; }
    .trip span, .summary span { display: block; color: #667085; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .trip strong, .summary strong { display: block; margin-top: 3px; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px; }
    .summary div { border-top: 3px solid #4d59bb; background: #f7f8fc; }
    .summary div:first-child { border-top-color: #00a86b; }
    .summary div:nth-child(2) { border-top-color: #f0a126; }
    h2 { margin: 0 0 8px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 7px 8px; border: 1px solid #d8dbea; text-align: left; vertical-align: top; }
    th { background: #1b1f55; color: white; font-size: 9px; letter-spacing: .03em; text-transform: uppercase; }
    td { font-size: 10px; }
    tbody tr:nth-child(even) { background: #f8f9fc; }
    td strong, td small { display: block; }
    td small { margin-top: 2px; color: #667085; }
    tr { break-inside: avoid; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 10px; background: #fff1d8; color: #7d5305; font-weight: 700; white-space: nowrap; }
    .status--complete { background: #dcf6e8; color: #116a41; }
    .status--partial { background: #e8edff; color: #3048a6; }
    .status--unconfigured { background: #eff1f5; color: #667085; }
    footer { margin-top: 12px; color: #667085; font-size: 9px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header>
    <div><span class="brand">Igreja Viagens</span><h1>Relatório geral da viagem</h1><p>${escapeHtml(trip.name)}</p></div>
    <div class="generated"><small>Gerado em</small><strong>${escapeHtml(generatedLabel)}</strong></div>
  </header>
  <section class="trip" aria-label="Dados da viagem">
    <div><span>Origem</span><strong>${escapeHtml(trip.departurePlace || 'Não informada')}</strong></div>
    <div><span>Destino</span><strong>${escapeHtml(trip.destination || 'Não informado')}</strong></div>
    <div><span>Data e horário</span><strong>${escapeHtml(formatTripDate(trip.date))} · ${escapeHtml(trip.departureTime || 'Não informado')}</strong></div>
    <div><span>Viajantes</span><strong>${rows.length} de ${trip.maxPeople}</strong></div>
    <div><span>Valor individual</span><strong>${escapeHtml(formatCurrency(trip.price))}</strong></div>
  </section>
  <section class="summary" aria-label="Resumo financeiro">
    <div><span>Arrecadado</span><strong>${escapeHtml(formatCurrency(summary.collected))}</strong></div>
    <div><span>Pendente</span><strong>${escapeHtml(formatCurrency(summary.pendingValue))}</strong></div>
    <div><span>Total previsto</span><strong>${escapeHtml(formatCurrency(summary.expectedTotal))}</strong></div>
    <div><span>Meta</span><strong>${escapeHtml(formatCurrency(summary.goal))}</strong></div>
    <div><span>Meta atingida</span><strong>${Math.round(summary.goalPercentage)}%</strong></div>
    <div><span>Situação</span><strong>${summary.completeCount} pago(s) · ${summary.partialCount} parcial(is) · ${summary.pendingCount} pendente(s)</strong></div>
  </section>
  <h2>Viajantes e pagamentos</h2>
  <table>
    <thead><tr><th>Viajante</th><th>Parcelas</th><th>Situação</th><th>Pago estimado</th><th>Saldo estimado</th><th>Comprovantes</th></tr></thead>
    <tbody>${tableRows || '<tr><td colspan="6">Nenhum viajante cadastrado nesta viagem.</td></tr>'}</tbody>
  </table>
  <footer>Os valores são estimados a partir do preço individual e da proporção de parcelas pagas. Use a opção “Salvar como PDF” na janela de impressão para arquivar o relatório.</footer>
</body>
</html>`
}

export function printPaymentReport(data: PaymentReportData) {
  const reportWindow = window.open('', '_blank')
  if (!reportWindow) return false
  reportWindow.opener = null
  reportWindow.document.write(buildPaymentReportHtml(data))
  reportWindow.document.close()
  reportWindow.focus()
  reportWindow.print()
  return true
}
