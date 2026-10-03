import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { subscriptionService } from '@/features/teacher-subscriptions/subscriptionService'

export const ActiveTeacherRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<'loading' | 'active' | 'inactive' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    subscriptionService.hasActiveSubscription()
      .then((active) => { if (!cancelled) setState(active ? 'active' : 'inactive') })
      .catch((error: unknown) => {
        console.error('Could not validate active teacher subscription:', error)
        if (!cancelled) setState('error')
      })
    return () => { cancelled = true }
  }, [])

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-white text-sm text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]" dir="rtl">جارٍ التحقق من صلاحية الاشتراك...</div>
  }
  if (state === 'inactive') return <Navigate to="/teacher/subscription" replace />
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center bg-white px-4 text-center text-sm text-[#B91C1C] dark:bg-[#0F172A] dark:text-red-300" dir="rtl">تعذّر التحقق من اشتراكك الآن. أعد تحميل الصفحة للمحاولة مرة أخرى.</div>
  }
  return <>{children}</>
}
