import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { LoginPage } from '../../features/auth/pages/LoginPage'
import { getRoleHomePath } from '../../features/navigation/config/navigation'

export function LoginRoute() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()

  if (user) return <Navigate replace to={getRoleHomePath(user.role)} />

  return (
    <LoginPage
      onAuthenticated={(authenticatedUser) => {
        signIn(authenticatedUser)
        void navigate(getRoleHomePath(authenticatedUser.role), { replace: true })
      }}
    />
  )
}
