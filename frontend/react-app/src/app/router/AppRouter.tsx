import { Route, Routes } from 'react-router'
import { AdminDashboardPage } from '../../features/admin/dashboard/pages/AdminDashboardPage'
import { TripSettingsPage } from '../../features/admin/settings/pages/TripSettingsPage'
import { TravelerDashboardPage } from '../../features/traveler/dashboard/pages/TravelerDashboardPage'
import { BusManagementPage } from '../../features/operations/pages/BusManagementPage'
import { HotelManagementPage } from '../../features/operations/pages/HotelManagementPage'
import { AdminPaymentsPage } from '../../features/payments/pages/AdminPaymentsPage'
import { TravelerPaymentPage } from '../../features/payments/pages/TravelerPaymentPage'
import { GlobalUsersPage } from '../../features/users/pages/GlobalUsersPage'
import { TripTravelersPage } from '../../features/users/pages/TripTravelersPage'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { LoginRoute } from './LoginRoute'
import { ProtectedRoleLayout } from './ProtectedRoleLayout'
import { RequireRole } from './guards/RequireRole'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LoginRoute />} />

      <Route element={<RequireRole role="admin" />}>
        <Route element={<ProtectedRoleLayout role="admin" />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
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
  )
}
