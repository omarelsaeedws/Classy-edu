import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'

interface ProtectedRouteProps {
  children: React.ReactNode
  loginPath?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, loginPath = '/login' }) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0F172A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={loginPath} state={{ from: location }} replace />
  }

  if (!profile) {
    return <Navigate to="/auth/callback" replace />
  }

  return <>
    <div className="fixed left-4 top-4 z-50"><NotificationBell /></div>
    {children}
  </>
}
