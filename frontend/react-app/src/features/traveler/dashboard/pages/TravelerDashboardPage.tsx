import { useEffect, useState } from 'react'
import { useAuth } from '../../../auth/hooks/useAuth'
import { useTrip } from '../../../trips/hooks/useTrip'
import type { Trip } from '../../../trips/model/tripTypes'
import { loadTravelerDashboard } from '../api/travelerDashboardApi'
import { DigitalTicket } from '../components/DigitalTicket'
import { TicketPrint } from '../components/TicketPrint'
import { TripRules } from '../components/TripRules'
import { buildTravelerDashboard } from '../lib/buildTravelerDashboard'
import type { TravelerDashboardSource } from '../model/travelerDashboardTypes'
import './travelerDashboard.css'

interface TravelerDashboardContentProps {
  cpf: string
  travelerName: string
  trip: Trip
}

function TravelerDashboardContent({
  cpf,
  travelerName,
  trip,
}: TravelerDashboardContentProps) {
  const { openSelector } = useTrip()
  const [source, setSource] = useState<TravelerDashboardSource | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true

    void loadTravelerDashboard(cpf, trip.id)
      .then((loadedSource) => {
        if (isCurrent) setSource(loadedSource)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar sua passagem.',
        )
      })

    return () => {
      isCurrent = false
    }
  }, [cpf, reloadKey, trip.id])

  if (errorMessage) {
    return (
      <div className="traveler-dashboard-status" role="alert">
        <h2>Não foi possível carregar sua passagem</h2>
        <p>{errorMessage}</p>
        <button
          onClick={() => {
            setErrorMessage(null)
            setSource(null)
            setReloadKey((key) => key + 1)
          }}
          type="button"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!source) {
    return (
      <div className="traveler-dashboard-status" role="status">
        <span className="layout-spinner" aria-hidden="true" />
        Carregando sua passagem...
      </div>
    )
  }

  const view = buildTravelerDashboard(cpf, trip, source)

  return (
    <div className="traveler-dashboard">
      <header className="traveler-dashboard__intro">
        <div>
          <span>Passagem digital</span>
          <h2>Olá, {travelerName.split(' ')[0] || 'viajante'}</h2>
          <p>Confira os dados disponíveis para a sua viagem.</p>
        </div>
        <div className="traveler-dashboard__actions">
          <TicketPrint />
          <button onClick={openSelector} type="button">
            Trocar viagem
          </button>
        </div>
      </header>

      <DigitalTicket travelerName={travelerName} trip={trip} view={view} />
      <TripRules rules={trip.rules} />
    </div>
  )
}

export function TravelerDashboardPage() {
  const { user } = useAuth()
  const { activeTrip } = useTrip()
  if (!user || !activeTrip) return null

  return (
    <TravelerDashboardContent
      cpf={user.cpf}
      key={`${user.cpf}-${activeTrip.id}`}
      travelerName={user.name}
      trip={activeTrip}
    />
  )
}
