function cityAbbreviation(value: string) {
  const words = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return words.map((word) => word[0]).join('').slice(0, 3).toUpperCase() || '---'
}

interface TicketRouteProps {
  date: string
  destination: string
  origin: string
}

function formatDate(value: string) {
  if (!value) return 'Data não informada'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR').format(date)
}

export function TicketRoute({ date, destination, origin }: TicketRouteProps) {
  const originLabel = origin || 'Origem não informada'
  const destinationLabel = destination || 'Destino não informado'

  return (
    <div className="ticket-route">
      <div className="ticket-city">
        <strong>{cityAbbreviation(origin)}</strong>
        <span>{originLabel}</span>
      </div>
      <div className="ticket-route__path">
        <span aria-hidden="true">✈</span>
        <i />
        <small>{formatDate(date)}</small>
      </div>
      <div className="ticket-city is-destination">
        <strong>{cityAbbreviation(destination)}</strong>
        <span>{destinationLabel}</span>
      </div>
    </div>
  )
}
