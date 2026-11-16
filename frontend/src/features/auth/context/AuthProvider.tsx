import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { supabase } from '../../../infrastructure/supabase/client'
import { clearActiveTripId } from '../../trips/storage/activeTripStorage'
import { getCurrentUser, logout } from '../api/authApi'
import type { AuthUser } from '../model/authTypes'
import { AuthContext } from './authContext'
import './authSessionLoading.css'

const LEGACY_AUTH_SESSION_KEY = 'igreja-viagens:auth-session'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const clearAuthenticatedState = useCallback(() => {
    clearActiveTripId()
    setUser(null)
  }, [])

  useEffect(() => {
    // Limpeza de transição: a sessão do servidor já substituiu todos os
    // consumidores deste registro local legado.
    sessionStorage.removeItem(LEGACY_AUTH_SESSION_KEY)
  }, [])

  useEffect(() => {
    let isCurrent = true

    void getCurrentUser()
      .then((authenticatedUser) => {
        if (isCurrent) setUser(authenticatedUser)
      })
      .catch(() => {
        if (isCurrent) clearAuthenticatedState()
      })
      .finally(() => {
        if (isCurrent) setIsInitializing(false)
      })

    return () => {
      isCurrent = false
    }
  }, [clearAuthenticatedState])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) clearAuthenticatedState()
    })
    return () => data.subscription.unsubscribe()
  }, [clearAuthenticatedState])

  const signIn = useCallback((authenticatedUser: AuthUser) => {
    setUser(authenticatedUser)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logout()
    } finally {
      clearAuthenticatedState()
    }
  }, [clearAuthenticatedState])

  const contextValue = useMemo(
    () => ({ user, signIn, signOut }),
    [signIn, signOut, user],
  )

  if (isInitializing) {
    return (
      <main className="auth-session-loading" role="status">
        <span aria-hidden="true" className="auth-session-loading__spinner" />
        <span>Verificando sessão...</span>
      </main>
    )
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}
