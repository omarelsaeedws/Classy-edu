import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Clock3, CreditCard, FileImage, LogOut, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { subscriptionService, MAX_RECEIPT_SIZE, ALLOWED_RECEIPT_TYPES } from '@/features/teacher-subscriptions/subscriptionService'
import { getPaymentProviderLabel } from '@/features/teacher-subscriptions/types'

const cardClass = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const mainClass = 'min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6'

const getReadableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('active teacher subscription')) return 'لديك اشتراك فعّال بالفعل.'
  if (message.includes('already in progress')) return 'لديك طلب اشتراك قيد المراجعة بالفعل.'
  if (message.includes('plan is unavailable')) return 'هذه الخطة غير متاحة حالياً. تواصل مع الإدارة.'
  if (message.includes('payment method is unavailable')) return 'وسيلة الدفع لم تعد متاحة. حدّث الصفحة واختر وسيلة أخرى.'
  return 'تعذّر إكمال الطلب. تحقق من البيانات والاتصال ثم حاول مرة أخرى.'
}

export const TeacherSubscriptionPage: React.FC = () => {
  const { user, profile, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof subscriptionService.getTeacherOverview>> | null>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [clockNow, setClockNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [data, hasActive] = await Promise.all([
        subscriptionService.getTeacherOverview(user.id),
        subscriptionService.hasActiveSubscription(),
      ])
      setOverview(data)
      setActive(hasActive)
      setPaymentMethodId((current) => current || data.paymentMethods[0]?.id || '')
      const openRequest = data.subscriptions.find((item) => item.status === 'PENDING_PAYMENT')
      if (openRequest) setAmount(String(openRequest.amount_due))
    } catch (loadError) {
      console.error('Could not load teacher subscription:', loadError)
      setError('تعذّر تحميل حالة الاشتراك. أعد المحاولة بعد قليل.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const latestSubscription = overview?.subscriptions[0]
  const currentPayment = latestSubscription
    ? overview?.payments.find((payment) => payment.subscription_id === latestSubscription.id)
    : undefined
  const availablePlans = overview?.plans.filter((plan) => plan.is_active) ?? []
  const isAwaitingReview = latestSubscription?.status === 'PAYMENT_SUBMITTED' || latestSubscription?.status === 'UNDER_REVIEW'

  const startSubscription = async (durationMonths: number) => {
    setSaving(true)
    setError('')
    try {
      await subscriptionService.createSubscription(durationMonths)
      await reload()
    } catch (startError) {
      setError(getReadableError(startError))
    } finally {
      setSaving(false)
    }
  }

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!user || !latestSubscription || latestSubscription.status !== 'PENDING_PAYMENT') return
    const transferredAmount = Number(amount)
    if (!Number.isFinite(transferredAmount) || transferredAmount <= 0) {
      setError('أدخل مبلغاً صحيحاً أكبر من صفر.')
      return
    }
    if (!receipt) {
      setError('ارفع صورة إيصال التحويل أولاً.')
      return
    }
    if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type) || receipt.size > MAX_RECEIPT_SIZE) {
      setError('يجب أن تكون صورة الإيصال JPG أو PNG أو WebP وألا يتجاوز حجمها 5 ميجابايت.')
      return
    }
    if (!paymentMethodId) {
      setError('اختر وسيلة التحويل.')
      return
    }

    setSaving(true)
    try {
      await subscriptionService.submitPayment({
        teacherId: user.id,
        subscriptionId: latestSubscription.id,
        paymentMethodId,
        transferredAmount,
        receipt,
        notes,
      })
      setReceipt(null)
      setNotes('')
      await reload()
    } catch (submitError) {
      console.error('Could not submit teacher payment:', submitError)
      setError(getReadableError(submitError))
    } finally {
      setSaving(false)
    }
  }

  const activeSubscription = overview?.subscriptions.find((item) => item.status === 'APPROVED')

  const remainingTime = (expiresAt: string | null) => {
    if (!expiresAt) return 'غير محدد'
    const millisecondsRemaining = Date.parse(expiresAt) - clockNow
    if (!Number.isFinite(millisecondsRemaining) || millisecondsRemaining <= 0) return 'انتهى الاشتراك'
    const hoursRemaining = Math.ceil(millisecondsRemaining / (60 * 60 * 1000))
    const days = Math.floor(hoursRemaining / 24)
    const hours = hoursRemaining % 24
    const formatCount = (count: number) => new Intl.NumberFormat('ar-EG').format(count)
    const dayLabel = days === 1 ? 'يوم' : days === 2 ? 'يومين' : days <= 10 ? 'أيام' : 'يومًا'
    const hourLabel = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : hours <= 10 ? 'ساعات' : 'ساعة'
    if (days === 0) return `${formatCount(Math.max(1, hours))} ${hourLabel}`
    return hours > 0
      ? `${formatCount(days)} ${dayLabel} و${formatCount(hours)} ${hourLabel}`
      : `${formatCount(days)} ${dayLabel}`
  }

  if (loading && !overview) {
    return <main className={`${mainClass} flex items-center justify-center`} dir="rtl"><p>جارٍ تحميل بيانات الاشتراك...</p></main>
  }

  return (
    <main className={mainClass} dir="rtl">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/teacher/pending" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#3B82F6]">
              <ArrowRight className="h-4 w-4" /> العودة
            </Link>
            <h1 className="text-2xl font-bold">اشتراك المدرس في Classy</h1>
            <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">أهلاً {profile?.full_name}، تابع حالة اشتراك المنصة من هنا.</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="gap-2"><LogOut className="h-4 w-4" />تسجيل الخروج</Button>
        </header>

        {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

        {active && activeSubscription ? (
          <section className={cardClass}>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[#16A34A]" />
              <div>
                <h2 className="text-lg font-semibold">اشتراكك فعّال</h2>
                <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">الخطة: {activeSubscription.duration_months} {activeSubscription.duration_months === 1 ? 'شهر' : 'أشهر'} · ينتهي في {activeSubscription.expires_at ? new Date(activeSubscription.expires_at).toLocaleDateString('ar-EG') : '—'}</p>
                <p className="mt-1 text-sm font-medium text-[#166534] dark:text-green-300">المدة المتبقية: {remainingTime(activeSubscription.expires_at)}</p>
              </div>
            </div>
            <Link to="/teacher" className="mt-5 inline-block text-sm font-medium text-[#2563EB] dark:text-[#3B82F6]">الانتقال إلى لوحة المدرس</Link>
          </section>
        ) : isAwaitingReview ? (
          <section className={cardClass}>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-1 h-6 w-6 shrink-0 text-[#F59E0B]" />
              <div>
                <h2 className="text-lg font-semibold">طلبك قيد المراجعة</h2>
                <p className="mt-1 text-sm leading-6 text-[#64748B] dark:text-[#94A3B8]">استلمنا بيانات التحويل وسيقوم فريق الإدارة بمراجعتها. لن يتم تفعيل الحساب قبل اعتماد الدفع.</p>
                {currentPayment && <p className="mt-3 text-sm">المبلغ المسجل: {currentPayment.transferred_amount} جنيه مصري</p>}
              </div>
            </div>
          </section>
        ) : latestSubscription?.status === 'PENDING_PAYMENT' ? (
          <section className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">إتمام بيانات التحويل</h2>
              <Button variant="ghost" size="sm" disabled={saving} onClick={async () => {
                setSaving(true)
                try {
                  await subscriptionService.cancelSubscription(latestSubscription.id)
                  await reload()
                } catch (cancelError) {
                  setError(getReadableError(cancelError))
                } finally {
                  setSaving(false)
                }
              }}>إلغاء الطلب واختيار خطة أخرى</Button>
            </div>
            <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">قيمة الخطة المحددة: {latestSubscription.amount_due} جنيه مصري لمدة {latestSubscription.duration_months} {latestSubscription.duration_months === 1 ? 'شهر' : 'أشهر'}.</p>
            <div className="my-5 grid gap-3 sm:grid-cols-2">
              {overview?.paymentMethods.map((method) => (
                <label key={method.id} className={`cursor-pointer rounded-lg border p-4 ${paymentMethodId === method.id ? 'border-[#2563EB] bg-[#EFF6FF] dark:border-[#3B82F6] dark:bg-blue-950/30' : 'border-[#E2E8F0] dark:border-[#334155]'}`}>
                  <input className="ml-2 accent-[#2563EB]" type="radio" name="payment-method" value={method.id} checked={paymentMethodId === method.id} onChange={() => setPaymentMethodId(method.id)} />
                  <span className="font-medium">{getPaymentProviderLabel(method.provider)}</span>
                  <p className="mt-2 text-sm">{method.account_holder}</p>
                  <p dir="ltr" className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{method.account_identifier}</p>
                  {method.instructions && <p className="mt-2 text-xs leading-5 text-[#64748B] dark:text-[#94A3B8]">{method.instructions}</p>}
                </label>
              ))}
            </div>
            {!overview?.paymentMethods.length && <p className="mb-4 text-sm text-[#B45309]">لم تضف الإدارة وسائل دفع بعد.</p>}
            <form onSubmit={submitPayment} className="space-y-4">
              <Input label="المبلغ المحوّل بالجنيه المصري" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              <label className="block text-sm font-medium">
                <span className="mb-1.5 block">صورة إيصال التحويل (حتى 5 ميجابايت)</span>
                <span className="flex min-h-11 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-sm dark:border-[#334155] dark:bg-[#1E293B]">
                  <FileImage className="h-4 w-4 text-[#64748B]" />
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} required />
                </span>
              </label>
              <label className="block text-sm font-medium">ملاحظات (اختياري)
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm dark:border-[#334155] dark:bg-[#1E293B]" />
              </label>
              <Button type="submit" disabled={saving || !overview?.paymentMethods.length} className="w-full"><CreditCard className="h-4 w-4" />{saving ? 'جارٍ إرسال الطلب...' : 'إرسال طلب المراجعة'}</Button>
            </form>
          </section>
        ) : (
          <section className={cardClass}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">اختر خطة الاشتراك</h2>
              <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">يبدأ التفعيل بعد مراجعة الإدارة لإيصال التحويل.</p>
            </div>
            {latestSubscription?.status === 'REJECTED' && currentPayment?.rejection_reason && (
              <div role="status" className="mb-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                رُفض طلبك السابق: {currentPayment.rejection_reason}. يمكنك إنشاء طلب جديد بعد مراجعة بيانات التحويل.
              </div>
            )}
            {availablePlans.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {availablePlans.map((plan) => (
                  <div key={plan.duration_months} className="rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]">
                    <h3 className="font-semibold">اشتراك {plan.duration_months} {plan.duration_months === 1 ? 'شهر' : 'أشهر'}</h3>
                    <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">تفعيل حساب المدرس لمدة {plan.duration_months} {plan.duration_months === 1 ? 'شهر' : 'أشهر'}.</p>
                    <p className="mt-2 text-xl font-bold text-[#2563EB] dark:text-[#3B82F6]">{plan.price} <span className="text-xs font-normal text-[#64748B]">جنيه</span></p>
                    <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">السعر الحالي لاشتراك المنصة</p>
                    <Button className="mt-4 w-full" disabled={saving} onClick={() => void startSubscription(plan.duration_months)}>{latestSubscription?.status === 'REJECTED' ? 'إرسال طلب جديد' : 'اختيار الخطة'}</Button>
                  </div>
                ))}
              </div>
            ) : <p className="rounded-lg bg-[#F8FAFC] p-4 text-sm text-[#64748B] dark:bg-[#111827] dark:text-[#94A3B8]">لا توجد خطط متاحة حالياً. ستظهر الخطط هنا بعد إعدادها من الإدارة.</p>}
          </section>
        )}

        {loading && overview && <p className="text-center text-xs text-[#64748B] dark:text-[#94A3B8]">جارٍ تحديث الحالة...</p>}
      </div>
    </main>
  )
}
