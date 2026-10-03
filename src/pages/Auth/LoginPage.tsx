import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { GoogleAuthButton } from '@/components/ui/GoogleAuthButton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const LoginPage: React.FC = () => {
  const { signInWithGoogle } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (authError) {
      console.error('Google sign-in error:', authError)
      setError('تعذّر بدء تسجيل الدخول بحساب Google. حاول مرة أخرى.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] dark:bg-[#0F172A] transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] mb-6 transition-colors">
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة للرئيسية</span>
        </Link>
        <div className="mb-3 flex justify-center"><BrandLogo className="h-10" /></div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">تسجيل الدخول</h1>
        <p className="mt-2 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
          أول مرة تستخدم Classy؟{' '}
          <Link to="/register" className="font-medium text-[#2563EB] dark:text-[#3B82F6] hover:underline">إنشاء حساب</Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#1E293B] py-8 px-4 shadow-xs sm:rounded-xl sm:px-10 border border-[#E2E8F0] dark:border-[#334155]">
          <p className="mb-6 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">سجّل الدخول بأمان باستخدام حساب Google.</p>
          {error && <div role="alert" className="mb-5 p-3 rounded-lg bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#991B1B]/50 text-sm text-[#DC2626] dark:text-[#FCA5A5] text-right">{error}</div>}
          <GoogleAuthButton disabled={isSubmitting} onClick={handleGoogleSignIn}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحويل إلى Google...</> : 'المتابعة باستخدام Google'}
          </GoogleAuthButton>
        </div>
      </div>
    </div>
  )
}
