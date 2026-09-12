import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useTrip } from '../../trips/hooks/useTrip'
import { useAuth } from './useAuth'

export function useLogout() {
  const { signOut } = useAuth()
  const { clearActiveTrip } = useTrip()
  const navigate = useNavigate()

  return useCallback(async () => {
    try {
      await signOut()
    } catch {
      // O estado local ainda é encerrado no AuthProvider. O cookie HttpOnly
      // só pode ser invalidado pelo backend quando a conexão está disponível.
    } finally {
      clearActiveTrip()
      void navigate('/', { replace: true })
    }
  }, [clearActiveTrip, navigate, signOut])
}
