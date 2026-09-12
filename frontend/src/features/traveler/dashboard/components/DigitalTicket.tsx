import type { Trip } from '../../../trips/model/tripTypes'
import type { TravelerDashboardView } from '../model/travelerDashboardTypes'
import { PaymentStatus } from './PaymentStatus'
import { RoomInfo } from './RoomInfo'
import { SeatInfo } from './SeatInfo'
import { TicketPrint } from './TicketPrint'
import { TicketRoute } from './TicketRoute'

interface DigitalTicketProps {
  travelerName: string
  trip: Trip
  view: TravelerDashboardView
}

export function DigitalTicket({
  travelerName,
  trip,
  view,
}: DigitalTicketProps) {
  return (
    <article
      aria-labelledby="digital-ticket-title"
      className="traveler-ticket"
      id="digital-ticket"
    >
      <header className="traveler-ticket__header">
        <div className="traveler-ticket__brand">
          <img alt="Igreja Viagens" src="/imagens/logo.png" />
          <div>
            <strong>Igreja Viagens</strong>
            <span id="digital-ticket-title">{trip.name || 'Passagem digital'}</span>
          </div>
        </div>
        <PaymentStatus payment={view.payment} />
      </header>

      <TicketRoute
        date={trip.date}
        destination={trip.destination}
        origin={trip.departurePlace}
      />

      <div className="traveler-ticket__divider" />

      <section className="traveler-ticket__details" aria-label="Dados da passagem">
        <div className="ticket-field">
          <span>Passageiro</span>
          <strong>{travelerName || 'Nome não informado'}</strong>
        </div>
        <div className="ticket-field">
          <span>Horário de partida</span>
          <strong>{trip.departureTime || 'Não informado'}</strong>
        </div>
        <div className="ticket-field">
          <span>Assento</span>
          <strong>
            <SeatInfo seats={view.seats} />
          </strong>
        </div>
        <RoomInfo room={view.room} />
        <div className="ticket-field">
          <span>Situação financeira</span>
          <PaymentStatus payment={view.payment} />
        </div>
      </section>

      {view.warnings.length ? (
        <aside className="traveler-ticket__warnings" aria-label="Avisos dos dados">
          {view.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </aside>
      ) : null}

      <footer className="traveler-ticket__footer">
        <div>
          <span>Viagem</span>
          <strong>{trip.name || 'Nome não informado'}</strong>
        </div>
        <TicketPrint compact />
      </footer>
    </article>
  )
}
