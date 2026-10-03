import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AccountSetupData, StudentOnboardingData, UserProfile } from './types'

export interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInAsAdmin: (email: string, password: string) => Promise<UserProfile>
  completeAccountSetup: (data: AccountSetupData) => Promise<UserProfile>
  logout: () => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
  completeStudentOnboarding: (data: StudentOnboardingData) => Promise<UserProfile>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
