import type { TravelerSeatGroup } from '../model/travelerDashboardTypes'

export function SeatInfo({ seats }: { seats: TravelerSeatGroup[] }) {
  if (seats.length === 0) return <span>Não atribuído</span>

  return (
    <span className="ticket-multiline">
      {seats.map((seat) => (
        <span key={`${seat.busId}-${seat.floor}`}>
          Ônibus {seat.busId} · Piso {seat.floor} · Assento(s){' '}
          {seat.seatNumbers.join(', ')}
        </span>
      ))}
    </span>
  )
}
