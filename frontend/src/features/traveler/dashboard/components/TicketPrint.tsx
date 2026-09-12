import { printTicket } from '../utils/printTicket'

interface TicketPrintProps {
  compact?: boolean
}

export function TicketPrint({ compact = false }: TicketPrintProps) {
  return (
    <button
      className={`ticket-print-button ${compact ? 'is-compact' : ''}`}
      onClick={printTicket}
      type="button"
    >
      Baixar / imprimir passagem
    </button>
  )
}
