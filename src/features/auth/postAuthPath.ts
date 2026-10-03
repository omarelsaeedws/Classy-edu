import type { UserProfile } from './types'

export const getPostAuthPath = (profile: UserProfile): string => {
  if (!profile.profile_setup_completed) return '/register/complete'

  if (profile.role === 'STUDENT') {
    return profile.onboarding_completed ? '/student' : '/student/onboarding'
  }

  if (profile.role === 'TEACHER') {
    return profile.teacher_status === 'ACTIVE' ? '/teacher' : '/teacher/pending'
  }

  return '/admin'
}
