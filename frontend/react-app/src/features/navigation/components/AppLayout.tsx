import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth'
import { TripSelectorModal } from '../../trips/components/TripSelectorModal'
import { useTrip } from '../../trips/hooks/useTrip'
import type { UserRole } from '../../auth/model/authTypes'
import { getNavigationItem } from '../config/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import './layout.css'

interface AppLayoutProps {
  role: UserRole
}

export function AppLayout({ role }: AppLayoutProps) {
  const { user } = useAuth()
  const trip = useTrip()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const page = getNavigationItem(role, location.pathname)

  useEffect(() => {
    if (!isSidebarOpen) return undefined

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isSidebarOpen])

  if (!user) return null

  const tripIsRequired = page?.requiresTrip ?? false
  const showTripSelector =
    trip.isSelectorOpen ||
    (tripIsRequired && !trip.isLoading && trip.activeTrip === null)

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        onNavigate={() => setIsSidebarOpen(false)}
        role={role}
        user={user}
      />
      <button
        aria-label="Fechar menu"
        className={`sidebar-backdrop ${isSidebarOpen ? 'is-visible' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
        type="button"
      />

      <div className="app-content">
        <Topbar
          isMenuOpen={isSidebarOpen}
          onOpenMenu={() => setIsSidebarOpen(true)}
          pageTitle={page?.pageTitle ?? 'Igreja Viagens'}
          user={user}
        />
        <div className="app-page">
          <Outlet />
        </div>
      </div>

      <TripSelectorModal isOpen={showTripSelector} role={role} />
    </div>
  )
}
