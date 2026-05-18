import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from '../data/supabaseClient'
import { adminEmailsSet, isCompetenciaEditLockEnabled } from '../config/admins'

/** @typedef {{ session: import('@supabase/supabase-js').Session | null, loading: boolean, canEditCompetencia: boolean, adminLockActive: boolean, signInWithOtp: (email: string) => Promise<{ error?: import('@supabase/supabase-js').AuthError }>, signOut: () => Promise<void> }} AuthState */

/** @type {React.Context<AuthState | null>} */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(/** @type {import('@supabase/supabase-js').Session | null} */ (null))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSession(s)
        setLoading(false)
      }
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const adminLockActive = isCompetenciaEditLockEnabled()

  const canEditCompetencia = useMemo(() => {
    if (!adminLockActive) return true
    const email = session?.user?.email?.trim().toLowerCase()
    if (!email) return false
    return adminEmailsSet.has(email)
  }, [adminLockActive, session])

  const signInWithOtp = useCallback(async (email) => {
    if (!supabase) return { error: { message: 'Supabase no configurado', status: 0 } }
    const redirectTo = `${window.location.origin}${window.location.pathname || '/'}`
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })
    return { error: error ?? undefined }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      session,
      loading,
      canEditCompetencia,
      adminLockActive,
      signInWithOtp,
      signOut,
    }),
    [session, loading, canEditCompetencia, adminLockActive, signInWithOtp, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
