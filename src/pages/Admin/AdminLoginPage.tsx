import React, { useState } from 'react'
import { ArrowRight, Loader2, LockKeyhole } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AdminAccessDeniedError } from '@/features/auth/services/authService'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const AdminLoginPage: React.FC = () => {
  const { signInAsAdmin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signInAsAdmin(email, password)
      navigate('/admin', { replace: true })
    } catch (signInError) {
      if (signInError instanceof AdminAccessDeniedError) {
        setError(signInError.message)
      } else {
        setError('بيانات الدخول غير صحيحة أو تعذّر الاتصال. راجع البريد وكلمة المرور وحاول مرة أخرى.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center bg-[#F8FAFC] px-4 py-12 transition-colors dark:bg-[#0F172A] sm:px-6" dir="rtl">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] transition-colors hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]">
          <ArrowRight className="h-3.5 w-3.5" />العودة للرئيسية
        </Link>
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E3A8A]/50 dark:text-[#3B82F6]"><LockKeyhole className="h-5 w-5" /></div>
          <div className="mt-2 flex items-center justify-center gap-2"><BrandLogo className="h-7" /><span className="text-sm font-semibold text-[#2563EB] dark:text-[#3B82F6]">الإدارة</span></div>
          <h1 className="mt-2 text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">دخول مدير المنصة</h1>
          <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">هذه الصفحة مخصصة لحسابات الإدارة المعتمدة.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xs dark:border-[#334155] dark:bg-[#1E293B] sm:p-8">
          {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
          <Input
            label="البريد الإلكتروني"
            type="email"
            name="email"
            autoComplete="username"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="كلمة المرور"
            type="password"
            name="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" disabled={submitting} className="w-full justify-center">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحقق...</> : 'تسجيل الدخول إلى لوحة الإدارة'}
          </Button>
        </form>
      </div>
    </main>
  )
}
