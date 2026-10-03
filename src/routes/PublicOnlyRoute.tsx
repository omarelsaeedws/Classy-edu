import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface PublicOnlyRouteProps {
  children: React.ReactNode
}

export const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0F172A]">
        <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user && profile) {
    if (!profile.profile_setup_completed) {
      return <Navigate to="/register/complete" replace />
    }
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
          to={profile.teacher_status === 'ACTIVE' ? '/teacher' : '/teacher/pending'}
          replace
        />
      )
    }
    if (profile.role === 'ADMIN') {
      return <Navigate to="/admin" replace />
    }
  }

  if (user && !profile) {
    return <Navigate to="/auth/callback" replace />
  }

  return <>{children}</>
}
