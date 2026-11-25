import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { LoginRoute } from './LoginRoute'
import { ProtectedRoleLayout } from './ProtectedRoleLayout'
import { RequireRole } from './guards/RequireRole'

const AdminDashboardPage = lazy(() => import('../../features/admin/dashboard/pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))
const TripSettingsPage = lazy(() => import('../../features/admin/settings/pages/TripSettingsPage').then((module) => ({ default: module.TripSettingsPage })))
const AdminAssistantPage = lazy(() => import('../../features/assistant/pages/AdminAssistantPage').then((module) => ({ default: module.AdminAssistantPage })))
const TravelerDashboardPage = lazy(() => import('../../features/traveler/dashboard/pages/TravelerDashboardPage').then((module) => ({ default: module.TravelerDashboardPage })))
const BusManagementPage = lazy(() => import('../../features/operations/pages/BusManagementPage').then((module) => ({ default: module.BusManagementPage })))
const HotelManagementPage = lazy(() => import('../../features/operations/pages/HotelManagementPage').then((module) => ({ default: module.HotelManagementPage })))
const AdminPaymentsPage = lazy(() => import('../../features/payments/pages/AdminPaymentsPage').then((module) => ({ default: module.AdminPaymentsPage })))
const TravelerPaymentPage = lazy(() => import('../../features/payments/pages/TravelerPaymentPage').then((module) => ({ default: module.TravelerPaymentPage })))
const GlobalUsersPage = lazy(() => import('../../features/users/pages/GlobalUsersPage').then((module) => ({ default: module.GlobalUsersPage })))
const TripTravelersPage = lazy(() => import('../../features/users/pages/TripTravelersPage').then((module) => ({ default: module.TripTravelersPage })))

export function AppRouter() {
  return (
    <Suspense fallback={<main className="auth-session-loading" role="status">Carregando página...</main>}>
    <Routes>
      <Route path="/" element={<LoginRoute />} />

      <Route element={<RequireRole role="admin" />}>
        <Route element={<ProtectedRoleLayout role="admin" />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/assistente" element={<AdminAssistantPage />} />
          <Route
            path="/admin/minha-passagem"
            element={<TravelerDashboardPage />}
          />
          <Route
            path="/admin/viajantes"
            element={<TripTravelersPage />}
          />
          <Route
            path="/admin/pagamentos"
            element={<AdminPaymentsPage />}
          />
          <Route
            path="/admin/transporte"
            element={<BusManagementPage />}
          />
          <Route
            path="/admin/hotel"
            element={<HotelManagementPage />}
          />
          <Route
            path="/admin/cadastros"
            element={<GlobalUsersPage />}
          />
          <Route
            path="/admin/configuracoes"
            element={<TripSettingsPage />}
          />
        </Route>
      </Route>

      <Route element={<RequireRole role="traveler" />}>
        <Route element={<ProtectedRoleLayout role="traveler" />}>
          <Route
            path="/viajante"
            element={<TravelerDashboardPage />}
          />
          <Route
            path="/viajante/pagamento"
            element={<TravelerPaymentPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  )
}
