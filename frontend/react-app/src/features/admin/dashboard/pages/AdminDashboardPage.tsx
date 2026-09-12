import { useEffect, useState } from 'react'
import { useTrip } from '../../../trips/hooks/useTrip'
import type { Trip } from '../../../trips/model/tripTypes'
import { loadAdminDashboard } from '../api/adminDashboardApi'
import { DonutChart } from '../components/DonutChart'
import { InstallmentBarChart } from '../components/InstallmentBarChart'
import { StatCard } from '../components/StatCard'
import { calculateAdminDashboard } from '../lib/calculateAdminDashboard'
import type { AdminDashboardSource } from '../model/adminDashboardTypes'
import './adminDashboard.css'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(value: string) {
  if (!value) return 'Data não informada'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR').format(date)
}

function DashboardContent({ trip }: { trip: Trip }) {
  const [source, setSource] = useState<AdminDashboardSource | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true

    void loadAdminDashboard()
      .then((loadedSource) => {
        if (isCurrent) setSource(loadedSource)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o dashboard.',
        )
      })

    return () => {
      isCurrent = false
    }
  }, [reloadKey])

  if (errorMessage) {
    return (
      <div className="dashboard-status" role="alert">
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
      <div className="dashboard-status" role="status">
        <span className="layout-spinner" aria-hidden="true" />
        Carregando indicadores...
      </div>
    )
  }

  const indicators = calculateAdminDashboard(trip, source)
  const hasOperationalData =
    indicators.totalTravelers > 0 ||
    indicators.occupiedSeats > 0 ||
    indicators.paidInstallments > 0 ||
    indicators.pendingInstallments > 0

  return (
    <div className="admin-dashboard">
      <header className="dashboard-intro">
        <div>
          <span>Visão geral</span>
          <h2>{trip.name}</h2>
          <p>
            {trip.departurePlace || 'Origem não informada'} →{' '}
            {trip.destination || 'Destino não informado'} ·{' '}
            {formatDate(trip.date)}
          </p>
        </div>
        {!hasOperationalData ? (
          <p className="dashboard-no-data">Ainda não há dados operacionais para esta viagem.</p>
        ) : null}
      </header>

      <section aria-label="Indicadores da viagem" className="dashboard-stats">
        <StatCard
          detail={`Limite cadastrado: ${trip.maxPeople}`}
          label="Total de viajantes"
          value={indicators.totalTravelers}
        />
        <StatCard
          detail="Valor cadastrado por pessoa"
          label="Valor individual"
          value={formatCurrency(trip.price)}
        />
        <StatCard
          detail={`${Math.max(0, indicators.totalSeats - indicators.occupiedSeats)} livres`}
          label="Ocupação de assentos"
          value={`${indicators.occupiedSeats}/${indicators.totalSeats}`}
        />
        <StatCard
          detail="Aguardando análise administrativa"
          label="Comprovantes pendentes"
          value={indicators.pendingReceipts}
        />
      </section>

      <section className="dashboard-revenue">
        <div>
          <span>Arrecadação</span>
          <strong>{formatCurrency(indicators.collectedAmount)}</strong>
          <small>de {formatCurrency(indicators.arrecadationGoal)}</small>
        </div>
        <div className="dashboard-progress">
          <span>
            <i style={{ width: `${indicators.arrecadationPercentage}%` }} />
          </span>
          <strong>{Math.round(indicators.arrecadationPercentage)}%</strong>
        </div>
      </section>

      <section className="dashboard-charts">
        <article className="dashboard-panel">
          <h3>Situação das parcelas</h3>
          <DonutChart
            accessibleLabel="Parcelas pagas e pendentes"
            slices={[
              { label: 'Pagas', value: indicators.paidInstallments, color: '#00a86b' },
              { label: 'Pendentes', value: indicators.pendingInstallments, color: '#f0a126' },
            ]}
          />
        </article>
        <article className="dashboard-panel">
          <h3>Ocupação dos ônibus</h3>
          <DonutChart
            accessibleLabel="Assentos ocupados e livres"
            slices={[
              { label: 'Ocupados', value: indicators.occupiedSeats, color: '#e1404f' },
              {
                label: 'Livres',
                value: Math.max(0, indicators.totalSeats - indicators.occupiedSeats),
                color: '#00a86b',
              },
            ]}
          />
        </article>
        <article className="dashboard-panel dashboard-panel--wide">
          <h3>Parcelas por viajante</h3>
          <InstallmentBarChart rows={indicators.installmentRows} />
        </article>
      </section>

      <section className="dashboard-panel dashboard-recent">
        <div className="dashboard-panel__heading">
          <h3>Viajantes recentes</h3>
          <small>Ordem de inclusão na viagem</small>
        </div>
        {indicators.recentTravelers.length ? (
          <ul>
            {indicators.recentTravelers.map((traveler) => (
              <li key={traveler.cpf}>
                <span>{traveler.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{traveler.name}</strong>
                  <small>CPF final {traveler.cpf.slice(-4)}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-empty-chart">Nenhum viajante cadastrado.</p>
        )}
      </section>
    </div>
  )
}

export function AdminDashboardPage() {
  const { activeTrip } = useTrip()
  if (!activeTrip) return null
  return <DashboardContent key={activeTrip.id} trip={activeTrip} />
}
