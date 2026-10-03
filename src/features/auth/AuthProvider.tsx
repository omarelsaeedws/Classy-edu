import React, { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { authService } from './services/authService'
import type { AccountSetupData, UserProfile, StudentOnboardingData } from './types'
import { AuthContext } from './AuthContext'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserProfile = useCallback(async (authUser: User): Promise<UserProfile | null> => {
    try {
      const p = await authService.getProfile(authUser.id)
      setProfile(p)
      return p
    } catch (err) {
      console.error('Error loading profile:', err)
      return null
    }
  }, [])

  // Initialize session and listen to auth changes
  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && isMounted) {
          setUser(session.user)
          await loadUserProfile(session.user)
        } else if (isMounted) {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Session init error:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return

        if (session?.user) {
          setUser(session.user)
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            setLoading(true)
            window.setTimeout(() => {
              if (!isMounted) return
              void loadUserProfile(session.user).finally(() => {
                if (isMounted) setLoading(false)
              })
            }, 0)
          }
        } else {
          setUser(null)
          setProfile(null)
          if (event !== 'INITIAL_SESSION') setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadUserProfile])

  const signInWithGoogle = async () => authService.signInWithGoogle()

  const signInAsAdmin = async (email: string, password: string): Promise<UserProfile> => {
    const result = await authService.signInAsAdmin(email, password)
    setUser(result.user)
    setProfile(result.profile)
    setLoading(false)
    return result.profile
  }

  const completeAccountSetup = async (data: AccountSetupData): Promise<UserProfile> => {
    if (!user) throw new Error('يجب تسجيل الدخول بحساب Google أولاً.')
    const updated = await authService.completeAccountSetup(data)
    setProfile(updated)
    return updated
  }

  const logout = async () => {
    setLoading(true)
    try {
      await authService.signOut()
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null
    return await loadUserProfile(user)
  }

  const completeStudentOnboarding = async (data: StudentOnboardingData): Promise<UserProfile> => {
    if (!user) throw new Error('المستخدم غير مسجل الدخول.')
    const updated = await authService.completeStudentOnboarding(user.id, data)
    setProfile(updated)
    return updated
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signInAsAdmin,
        completeAccountSetup,
        logout,
        refreshProfile,
        completeStudentOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
