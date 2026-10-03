import type { User } from '@supabase/supabase-js'
import type { UserRole, TeacherStatus } from '@/lib/supabase/types'

export interface UserProfile {
  id: string
  full_name: string
  phone: string | null
  role: UserRole
  teacher_status: TeacherStatus | null
  onboarding_completed: boolean
  profile_setup_completed: boolean
  stage: string | null
  grade: string | null
  subjects: string[] | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface AccountSetupData {
  fullName: string
  phone: string
  role: 'STUDENT' | 'TEACHER'
}

export interface StudentOnboardingData {
  stage: string
  grade: string
}

export interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}
