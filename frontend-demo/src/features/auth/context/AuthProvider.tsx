import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { clearActiveTripId } from '../../trips/storage/activeTripStorage'
import { getCurrentUser, logout } from '../api/authApi'
import type { AuthUser } from '../model/authTypes'
import { AuthContext } from './authContext'
import './authSessionLoading.css'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const clearAuthenticatedState = useCallback(() => { clearActiveTripId(); setUser(null) }, [])

  useEffect(() => {
    void getCurrentUser().then(setUser).catch(clearAuthenticatedState).finally(() => setIsInitializing(false))
  }, [clearAuthenticatedState])

  const signIn = useCallback((authenticatedUser: AuthUser) => setUser(authenticatedUser), [])
  const signOut = useCallback(async () => { try { await logout() } finally { clearAuthenticatedState() } }, [clearAuthenticatedState])
  const contextValue = useMemo(() => ({ user, signIn, signOut }), [signIn, signOut, user])

  if (isInitializing) return <main className="auth-session-loading" role="status"><span aria-hidden="true" className="auth-session-loading__spinner" /><span>Preparando demonstração...</span></main>
  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
