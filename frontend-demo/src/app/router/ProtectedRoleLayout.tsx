import type { UserRole } from '../../features/auth/model/authTypes'
import { AppLayout } from '../../features/navigation/components/AppLayout'
import { TripProvider } from '../../features/trips/context/TripProvider'

interface ProtectedRoleLayoutProps {
  role: UserRole
}

export function ProtectedRoleLayout({ role }: ProtectedRoleLayoutProps) {
  return (
    <TripProvider>
      <AppLayout role={role} />
    </TripProvider>
  )
}
