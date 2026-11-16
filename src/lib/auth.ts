import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { cloudConfigured, supabase } from './supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(cloudConfigured)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      setError(undefined)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const sendEmailCode = useCallback(async (email: string) => {
    if (!supabase) return false
    setError(undefined)
    const { error: authError } = await supabase.auth.signInWithOtp({ email })
    if (authError) {
      setError(authError.message)
      return false
    }
    return true
  }, [])

  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    if (!supabase) return false
    setError(undefined)
    const { error: authError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (authError) {
      setError(authError.message)
      return false
    }
    return true
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setError(undefined)
    const { error: authError } = await supabase.auth.signOut()
    if (authError) setError(authError.message)
  }, [])

  return { user, loading, error, sendEmailCode, verifyEmailCode, signOut, cloudConfigured }
}
