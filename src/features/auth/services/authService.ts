import { supabase } from '@/lib/supabase/client'
import type { AccountSetupData, UserProfile, StudentOnboardingData } from '../types'

export class ProfileLoadError extends Error {
  constructor() {
    super('تم تسجيل الدخول لكن تعذّر تحميل الملف الشخصي. يرجى المحاولة لاحقًا.')
    this.name = 'ProfileLoadError'
  }
}

export class AdminAccessDeniedError extends Error {
  constructor() {
    super('هذا الحساب غير مخوّل للوصول إلى لوحة الإدارة.')
    this.name = 'AdminAccessDeniedError'
  }
}

export const authService = {
  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      throw error
    }
  },

  async signInAsAdmin(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
    if (!data.user) throw new ProfileLoadError()

    try {
      const profile = await this.getProfile(data.user.id)
      if (!profile || !profile.profile_setup_completed || profile.role !== 'ADMIN') {
        throw new AdminAccessDeniedError()
      }
      return { user: data.user, profile }
    } catch (profileError) {
      await supabase.auth.signOut()
      throw profileError
    }
  },

  async completeAccountSetup(data: AccountSetupData): Promise<UserProfile> {
    const { error } = await supabase.rpc('complete_google_profile_setup', {
      selected_role: data.role,
      full_name: data.fullName.trim(),
      phone: data.phone.trim(),
    })

    if (error) throw error

    const { data: authData, error: userError } = await supabase.auth.getUser()
    if (userError || !authData.user) throw new ProfileLoadError()

    const profile = await this.getProfile(authData.user.id)
    if (!profile || !profile.profile_setup_completed || profile.role !== data.role) {
      throw new ProfileLoadError()
    }
    return profile
  },

  /**
   * Log out user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
  },

  /**
   * Fetch current user's profile
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data as UserProfile | null
  },

  /**
   * Update student onboarding details
   */
  async completeStudentOnboarding(
    userId: string,
    onboarding: StudentOnboardingData
  ): Promise<UserProfile> {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user || user.id !== userId) throw new Error('المستخدم غير مسجل الدخول.')

    const { error } = await supabase.rpc('complete_student_onboarding', {
      p_stage: onboarding.stage,
      p_grade: onboarding.grade,
    })
    if (error) throw error

    const profile = await this.getProfile(user.id)
    if (!profile?.onboarding_completed) throw new ProfileLoadError()
    return profile
  },
}
