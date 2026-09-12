import type { AuthUser } from '../../auth/model/authTypes'
import { useTrip } from '../../trips/hooks/useTrip'
import { AppIcon } from '../../../shared/components/AppIcon'

interface TopbarProps {
  isMenuOpen: boolean
  onOpenMenu: () => void
  pageTitle: string
  user: AuthUser
}

export function Topbar({
  isMenuOpen,
  onOpenMenu,
  pageTitle,
  user,
}: TopbarProps) {
  const { activeTrip, isLoading, openSelector } = useTrip()

  return (
    <header className="app-topbar">
      <div className="topbar-title">
        <button
          aria-controls="app-sidebar"
          aria-expanded={isMenuOpen}
          aria-label="Abrir menu"
          className="mobile-menu-button"
          onClick={onOpenMenu}
          type="button"
        >
          <AppIcon name="menu" />
        </button>
        <div>
          <span>Igreja Viagens</span>
          <h1>{pageTitle}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="active-trip-button"
          disabled={isLoading}
          onClick={openSelector}
          type="button"
        >
          <span className="active-trip-button__icon">
            <AppIcon name="plane" />
          </span>
          <span>
            <small>Viagem ativa</small>
            <strong>
              {isLoading
                ? 'Carregando...'
                : (activeTrip?.name ?? 'Selecionar viagem')}
            </strong>
          </span>
          <AppIcon name="chevronRight" />
        </button>
        <span className="topbar-avatar" title={user.name}>
          {user.name.charAt(0).toUpperCase()}
        </span>
      </div>
    </header>
  )
}
