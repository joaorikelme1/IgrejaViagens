import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../../features/auth/hooks/useAuth'
import type { UserRole } from '../../../features/auth/model/authTypes'
import { getRoleHomePath } from '../../../features/navigation/config/navigation'

interface RequireRoleProps {
  role: UserRole
}

export function RequireRole({ role }: RequireRoleProps) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/" />
  }

  if (user.role !== role) {
    return <Navigate replace to={getRoleHomePath(user.role)} />
  }

  return <Outlet />
}
