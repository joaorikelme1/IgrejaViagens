import { useState } from 'react'
import { Link } from 'react-router'
import { AppIcon } from '../../../shared/components/AppIcon'
import { useLogout } from '../../auth/hooks/useLogout'
import type { UserRole } from '../../auth/model/authTypes'
import { useTrip } from '../hooks/useTrip'
import type { Trip } from '../model/tripTypes'
import { DeleteTripConfirmModal } from './DeleteTripConfirmModal'
import { TripFormModal } from './TripFormModal'

interface TripSelectorModalProps {
  isOpen: boolean
  role: UserRole
}

function formatDate(value: string) {
  if (!value) return 'Data não informada'

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR').format(date)
}

export function TripSelectorModal({ isOpen, role }: TripSelectorModalProps) {
  const [tripBeingEdited, setTripBeingEdited] = useState<Trip | null>(null)
  const [tripBeingDeleted, setTripBeingDeleted] = useState<Trip | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const {
    activeTrip,
    availableTrips,
    closeSelector,
    errorMessage,
    isLoading,
    reloadTrips,
    selectTrip,
  } = useTrip()
  const logout = useLogout()

  if (!isOpen) return null

  if (isCreating || tripBeingEdited) {
    return (
      <TripFormModal
        onClose={() => {
          setIsCreating(false)
          setTripBeingEdited(null)
        }}
        trip={tripBeingEdited ?? undefined}
      />
    )
  }

  if (tripBeingDeleted) {
    return (
      <DeleteTripConfirmModal
        onClose={() => setTripBeingDeleted(null)}
        trip={tripBeingDeleted}
      />
    )
  }

  const canClose = activeTrip !== null
  const isAdmin = role === 'admin'

  return (
    <div className="trip-selector-overlay">
      <section
        aria-labelledby="trip-selector-title"
        aria-modal="true"
        className="trip-selector"
        role="dialog"
      >
        <header className="trip-selector__header">
          <div>
            <h2 id="trip-selector-title">
              <AppIcon name="plane" />
              {isAdmin ? 'Selecionar viagem' : 'Suas viagens'}
            </h2>
            <p>
              {isAdmin
                ? 'Escolha uma viagem para gerenciar'
                : 'Escolha qual viagem deseja acessar'}
            </p>
          </div>
          <div className="trip-selector__header-actions">
            {isAdmin ? (
              <button
                className="trip-selector__new"
                onClick={() => setIsCreating(true)}
                type="button"
              >
                Nova viagem
              </button>
            ) : null}
            {canClose ? (
              <button
                aria-label="Fechar seletor de viagem"
                className="trip-selector__close"
                onClick={closeSelector}
                type="button"
              >
                <AppIcon name="x" />
              </button>
            ) : null}
          </div>
        </header>

        <div className="trip-selector__body">
          {isLoading ? (
            <div className="trip-selector__status" role="status">
              <span className="layout-spinner" aria-hidden="true" />
              Carregando viagens...
            </div>
          ) : null}

          {!isLoading && errorMessage ? (
            <div className="trip-selector__status" role="alert">
              <AppIcon name="info" />
              <p>{errorMessage}</p>
              <button onClick={reloadTrips} type="button">
                Tentar novamente
              </button>
            </div>
          ) : null}

          {!isLoading && !errorMessage && availableTrips.length === 0 ? (
            <div className="trip-selector__status">
              <AppIcon name="plane" />
              <p>
                {isAdmin
                  ? 'Nenhuma viagem cadastrada.'
                  : 'Você ainda não foi adicionado a nenhuma viagem. Aguarde o administrador.'}
              </p>
            </div>
          ) : null}

          {!isLoading && !errorMessage
            ? availableTrips.map((trip) => (
                <div
                  className={`trip-option ${
                    activeTrip?.id === trip.id ? 'is-active' : ''
                  }`}
                  key={trip.id}
                >
                  <button
                    aria-label={`Selecionar viagem ${trip.name}`}
                    className="trip-option__select"
                    onClick={() => selectTrip(trip.id)}
                    type="button"
                  >
                    <span className="trip-option__icon">
                      <AppIcon name="plane" />
                    </span>
                    <span className="trip-option__content">
                      <strong>{trip.name}</strong>
                      <span>
                        {trip.destination || 'Destino não informado'} ·{' '}
                        {formatDate(trip.date)}
                        {isAdmin
                          ? ` · ${trip.travelerCpfs.length} viajante(s)`
                          : ''}
                      </span>
                    </span>
                    {activeTrip?.id === trip.id ? (
                      <AppIcon name="check" />
                    ) : (
                      <AppIcon name="chevronRight" />
                    )}
                  </button>
                  {isAdmin ? (
                    <div className="trip-option__actions">
                      <button
                        aria-label={`Editar viagem ${trip.name}`}
                        onClick={() => setTripBeingEdited(trip)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        aria-label={`Excluir viagem ${trip.name}`}
                        onClick={() => setTripBeingDeleted(trip)}
                        type="button"
                      >
                        Excluir
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            : null}
        </div>

        <footer className="trip-selector__footer">
          {isAdmin ? (
            <Link onClick={closeSelector} to="/admin/cadastros">
              <AppIcon name="folder" />
              Cadastro global
            </Link>
          ) : (
            <span />
          )}
          <button
            onClick={() => {
              void logout()
            }}
            type="button"
          >
            <AppIcon name="logout" />
            Sair
          </button>
        </footer>
      </section>
    </div>
  )
}
