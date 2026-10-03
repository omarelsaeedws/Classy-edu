import React, { useEffect, useState } from 'react'
import { Briefcase, GraduationCap, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { getPostAuthPath } from '@/features/auth/postAuthPath'
import { isValidEgyptianPhone } from '@/lib/validations'

type NewUserRole = 'STUDENT' | 'TEACHER'

export const CompleteAccountSetupPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile, loading, completeAccountSetup, logout } = useAuth()
  const [role, setRole] = useState<NewUserRole | null>(null)
  const [step, setStep] = useState<'role' | 'details'>('role')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (profile?.profile_setup_completed) {
      navigate(getPostAuthPath(profile), { replace: true })
    }
  }, [navigate, profile])

  const selectRole = (selectedRole: NewUserRole) => {
    setRole(selectedRole)
    setStep('details')
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError('الاسم بالكامل مطلوب.')
      return
    }
    if (!isValidEgyptianPhone(phone)) {
      setError('أدخل رقم هاتف مصري صحيحًا، مثل 01012345678.')
      return
    }
    if (!role) {
      setStep('role')
      return
    }

    setIsSubmitting(true)
    try {
      const completedProfile = await completeAccountSetup({ role, fullName, phone })
      navigate(getPostAuthPath(completedProfile), { replace: true })
    } catch (setupError) {
      console.error('Account setup error:', setupError)
      setError('تعذّر حفظ بيانات الحساب. راجع رقم الهاتف وحاول مرة أخرى.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || !user || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0F172A]" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent" />
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل الحساب...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] dark:bg-[#0F172A]" dir="rtl">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center"><BrandLogo className="h-10" /></div>
          <p className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">إعداد حسابك في Classy</p>
          <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">خطوة واحدة ونبدأ رحلتك التعليمية.</p>
        </div>

        <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span className={step === 'role' ? 'font-semibold text-[#2563EB]' : ''}>١. نوع الحساب</span>
            <span aria-hidden="true">←</span>
            <span className={step === 'details' ? 'font-semibold text-[#2563EB]' : ''}>٢. بياناتك</span>
          </div>

          {step === 'role' ? (
            <div>
              <h1 className="text-center text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">اختر نوع حسابك</h1>
              <p className="mt-2 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">هل تستخدم Classy كطالب أم كمدرس؟</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => selectRole('STUDENT')} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] p-4 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30">
                  <GraduationCap className="h-5 w-5 text-[#2563EB]" />
                  <span>طالب</span>
                </button>
                <button type="button" onClick={() => selectRole('TEACHER')} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] p-4 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30">
                  <Briefcase className="h-5 w-5 text-[#2563EB]" />
                  <span>مدرس</span>
                </button>
              </div>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">بيانات {role === 'STUDENT' ? 'الطالب' : 'المدرس'}</h1>
                <button type="button" onClick={() => setStep('role')} className="text-xs font-medium text-[#2563EB] dark:text-[#3B82F6]">تغيير النوع</button>
              </div>
              <Input label="الاسم بالكامل" placeholder="مثال: أحمد محمد علي" value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={isSubmitting} />
              <Input label="رقم الهاتف" placeholder="010XXXXXXXX" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={isSubmitting} />
              {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#DC2626] dark:border-[#991B1B]/50 dark:bg-[#7F1D1D]/30 dark:text-[#FCA5A5]">{error}</p>}
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ حفظ البيانات...</> : 'حفظ ومتابعة'}
              </Button>
            </form>
          )}

          {step === 'role' && error && <p role="alert" className="mt-4 text-sm text-[#DC2626]">{error}</p>}
          <button type="button" onClick={() => void logout()} className="mt-6 w-full text-center text-xs text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]">تسجيل الخروج</button>
        </section>
      </div>
    </main>
  )
}
