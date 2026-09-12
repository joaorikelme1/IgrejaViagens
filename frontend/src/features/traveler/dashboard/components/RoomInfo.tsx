import type { TravelerRoomView } from '../model/travelerDashboardTypes'

export function RoomInfo({ room }: { room: TravelerRoomView | null }) {
  if (!room) {
    return (
      <>
        <div className="ticket-field">
          <span>Hotel / Quarto</span>
          <strong>Não atribuído</strong>
        </div>
        <div className="ticket-field">
          <span>Companheiros de quarto</span>
          <strong>—</strong>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="ticket-field">
        <span>Hotel / Quarto</span>
        <strong>{room.label}</strong>
      </div>
      <div className="ticket-field">
        <span>Companheiros de quarto</span>
        <strong className="ticket-multiline">
          {room.companions.length
            ? room.companions.map((companion) => (
                <span key={companion}>{companion}</span>
              ))
            : 'Quarto individual'}
        </strong>
      </div>
    </>
  )
}
