import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Save, UserRound } from 'lucide-react'
import { AccountDeletionSection } from '@/components/account/AccountDeletionSection'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'
import { isValidEgyptianPhone } from '@/lib/validations'

export const AccountSettingsPage = () => {
  const { profile, user, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = fullName.trim()
    const trimmedPhone = phone.trim()
    const invalidName = trimmedName.length < 2 || trimmedName.length > 120
    const invalidPhone = !isValidEgyptianPhone(trimmedPhone)
    setNameError(invalidName ? 'أدخل اسمًا من حرفين إلى 120 حرفًا.' : '')
    setPhoneError(invalidPhone ? 'رقم الموبايل غير صحيح.' : '')
    setMessage('')
    setError('')
    if (invalidName || invalidPhone) return

    setSaving(true)
    try {
      const { error: updateError } = await supabase.rpc('update_my_account_profile', {
        p_full_name: trimmedName,
        p_phone: trimmedPhone,
      })
      if (updateError) throw updateError
      await refreshProfile()
      setFullName(trimmedName)
      setPhone(trimmedPhone)
      setMessage('تم حفظ التغييرات بنجاح.')
    } catch (saveError) {
      console.error('Could not update account profile:', saveError)
      setError('حدث خطأ أثناء حفظ البيانات. حاول مرة أخرى.')
    } finally {
      setSaving(false)
    }
  }

  const dashboard = profile?.role === 'TEACHER' ? '/teacher' : '/student'

  return <main dir="rtl" className="min-h-screen bg-[#F8FAFC] p-4 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:p-8">
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={dashboard} className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة للوحة التحكم</Link>
      <header><h1 className="text-2xl font-bold">إعدادات الحساب</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">إدارة معلومات الدخول والبيانات الأساسية.</p></header>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]" aria-labelledby="account-info-heading">
        <h2 id="account-info-heading" className="mb-4 flex items-center gap-2 font-semibold"><UserRound className="h-5 w-5 text-[#2563EB]" />معلومات الحساب</h2>
        <form onSubmit={(event) => void saveProfile(event)} className="space-y-4">
          <Input label="الاسم" value={fullName} onChange={(event) => setFullName(event.target.value)} error={nameError} autoComplete="name" maxLength={120} required />
          <Input label="رقم الموبايل" value={phone} onChange={(event) => setPhone(event.target.value)} error={phoneError} autoComplete="tel" inputMode="tel" maxLength={11} required />
          <Input label="البريد الإلكتروني" value={user?.email ?? ''} readOnly disabled helperText="تغيير البريد الإلكتروني غير متاح من الإعدادات حاليًا." />
          {message && <p role="status" className="text-sm text-green-700 dark:text-green-300">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <Button type="submit" disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</Button>
        </form>
      </section>

      {profile?.role === 'TEACHER' && <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]"><h2 className="font-semibold">الملف التعليمي</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">تعديل الصورة والمواد والعنوان والمجموعات من صفحة بيانات المدرس الحالية.</p><Link className="mt-3 inline-block text-sm text-[#2563EB] dark:text-[#60A5FA]" to="/teacher/profile">الانتقال إلى بيانات المدرس</Link></section>}
      <AccountDeletionSection />
    </div>
  </main>
}
