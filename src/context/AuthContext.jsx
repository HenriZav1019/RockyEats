import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // False until the stored session has been read. Without this, the first
  // render treats a logged-in user as logged out, ProtectedRoute bounces them
  // to /login, and Login forwards to /dashboard, so a refresh on any
  // dashboard page (Settings, Menu, Queue...) landed back on Orders.
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionReady(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionReady(true)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    if (!session) {
      setProfile(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    supabase
      .from('profiles')
      .select('id, role, restaurant_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        setProfile(error ? null : data)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, sessionReady])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
