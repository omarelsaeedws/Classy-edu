import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { getPostAuthPath } from '@/features/auth/postAuthPath'

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile, loading, logout } = useAuth()

  useEffect(() => {
    if (loading) return
    if (profile) {
      navigate(getPostAuthPath(profile), { replace: true })
    }
  }, [loading, navigate, profile])

  if (!loading && !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A] px-4" dir="rtl">
        <section className="w-full max-w-md rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-8 text-center">
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">لم يكتمل تسجيل الدخول</h1>
          <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">ارجع وسجّل الدخول باستخدام Google مرة أخرى.</p>
          <Link className="mt-6 inline-block text-sm font-semibold text-[#2563EB] dark:text-[#3B82F6]" to="/login">العودة لتسجيل الدخول</Link>
        </section>
      </main>
    )
  }

  if (!loading && user && !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A] px-4" dir="rtl">
        <section className="w-full max-w-md rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-8 text-center">
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">تعذّر تجهيز ملف الحساب</h1>
          <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">تم تسجيل الدخول إلى Google، لكن تعذّر تحميل ملف Classy. تأكد من تطبيق ترحيل قاعدة البيانات ثم حاول مرة أخرى.</p>
          <button type="button" onClick={() => void logout()} className="mt-6 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white">العودة لتسجيل الدخول</button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0F172A]" dir="rtl">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent" />
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تجهيز حسابك...</p>
      </div>
    </main>
  )
}
