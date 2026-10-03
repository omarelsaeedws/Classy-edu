import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { UserRole } from '@/lib/supabase/types'

interface RoleRouteProps {
  children: React.ReactNode
  allowedRole: UserRole
  allowOnboardingOnly?: boolean
  allowPendingOnly?: boolean
  allowTeacherSubscription?: boolean
}

export const RoleRoute: React.FC<RoleRouteProps> = ({
  children,
  allowedRole,
  allowOnboardingOnly = false,
  allowPendingOnly = false,
  allowTeacherSubscription = false,
}) => {
  const { profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0F172A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!profile.profile_setup_completed) {
    return <Navigate to="/register/complete" replace />
  }

  // If user role does not match allowed role, redirect to appropriate home
  if (profile.role !== allowedRole) {
    if (profile.role === 'STUDENT') {
      return (
        <Navigate
          to={profile.onboarding_completed ? '/student' : '/student/onboarding'}
          replace
        />
      )
    }
    if (profile.role === 'TEACHER') {
      return (
        <Navigate
          to={profile.teacher_status === 'ACTIVE' ? '/teacher' : '/teacher/subscription'}
          replace
        />
      )
    }
    if (profile.role === 'ADMIN') {
      return <Navigate to="/admin" replace />
    }
    return <Navigate to="/" replace />
  }

  // Student specific onboarding enforcement
  if (allowedRole === 'STUDENT') {
    if (!profile.onboarding_completed && !allowOnboardingOnly) {
      return <Navigate to="/student/onboarding" replace />
    }
    if (profile.onboarding_completed && allowOnboardingOnly) {
      return <Navigate to="/student" replace />
    }
  }

  // Teacher specific status enforcement
  if (allowedRole === 'TEACHER') {
    const isActive = profile.teacher_status === 'ACTIVE'
    if (!isActive && !allowPendingOnly && !allowTeacherSubscription) {
      return <Navigate to="/teacher/subscription" replace />
    }
    if (isActive && allowPendingOnly) {
      return <Navigate to="/teacher" replace />
    }
  }

  return <>{children}</>
}
