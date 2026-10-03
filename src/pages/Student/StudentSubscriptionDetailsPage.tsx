import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, ReceiptText } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StudentNavigation } from '@/components/navigation/StudentNavigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getPaymentProviderLabel } from '@/features/teacher-subscriptions/types'
import { formatGroupTime, getWeekdayLabel } from '@/features/teacher-groups/types'
import { studentTeacherService } from '@/features/student-teachers/studentTeacherService'
import type { StudentSubscriptionDetails } from '@/features/student-teachers/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const statusLabel: Record<StudentSubscriptionDetails['status'], string> = { PENDING_PAYMENT: 'بانتظار الدفع', UNDER_REVIEW: 'قيد مراجعة المدرس', ACTIVE: 'نشط', REJECTED: 'مرفوض', CANCELLED: 'ملغي', EXPIRED: 'منتهي' }

export const StudentSubscriptionDetailsPage: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState<StudentSubscriptionDetails | null>(null)
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const result = await studentTeacherService.getSubscription(id)
      setSubscription(result)
      if (result?.available_payment_methods[0]) setMethodId((current) => current || result.available_payment_methods[0].id)
    } catch (loadError) {
      console.error('Could not load student subscription detail:', loadError)
      setError('تعذّر تحميل بيانات الاشتراك. تأكد من تطبيق ترحيل المرحلة الخامسة وحاول مرة أخرى.')
    } finally { setLoading(false) }
  }, [id])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !receipt) { setError('اختر صورة إيصال التحويل.'); return }
    setSending(true)
    setError('')
    setNotice('')
    try {
      await studentTeacherService.submitPayment({ subscriptionId: id, paymentMethodId: methodId, transferredAmount: Number(amount), receipt, notes })
      setNotice('تم إرسال بيانات الدفع للمدرس. يمكنك متابعة حالة الطلب من هذه الصفحة.')
      void load()
    } catch (submitError) {
      console.error('Could not submit student payment:', submitError)
      const message = submitError instanceof Error ? submitError.message : ''
      setError(message.includes('5 MB') || message.includes('Unsupported')
        ? 'الإيصال يجب أن يكون JPG أو PNG أو WEBP وألا يتجاوز 5 ميجابايت.'
        : 'تعذّر إرسال بيانات الدفع. تحقق من وسيلة الدفع والمبلغ والإيصال ثم حاول مرة أخرى.')
    } finally { setSending(false) }
  }

  const retry = async () => {
    if (!subscription) return
    setSending(true)
    setError('')
    try { const nextId = await studentTeacherService.createRequest(subscription.group_id); navigate(`/student/subscriptions/${nextId}`) }
    catch (retryError) {
      console.error('Could not retry student subscription:', retryError)
      setError('تعذّر إنشاء طلب جديد. قد تكون المجموعة ممتلئة أو لديك طلب قائم.')
    } finally { setSending(false) }
  }

  return <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]" dir="rtl">
    <StudentNavigation />
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <Link to="/student/subscriptions" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة لاشتراكاتي</Link>
      {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</div>}
      {loading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل الاشتراك...</p> : !subscription ? <section className={`${panel} text-center`}><h1 className="font-semibold">الاشتراك غير موجود</h1><p className="mt-2 text-sm text-[#64748B]">تأكد من تسجيل الدخول بالحساب الذي أنشأ الطلب.</p></section> : <>
        <section className={`${panel} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">{subscription.group_name}</h1><span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-sm text-[#1D4ED8] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]">{statusLabel[subscription.status]}</span></div><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{subscription.teacher_name} · {subscription.subject} · {subscription.educational_stage} · {subscription.grade}</p><p className="font-semibold">السعر المسجل وقت الطلب: {subscription.monthly_price.toLocaleString('ar-EG')} جنيه شهريًا</p><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{subscription.teaching_area} — {subscription.teaching_address}</p><div className="space-y-1 border-t border-[#E2E8F0] pt-3 dark:border-[#334155]">{subscription.schedule.map((slot) => <p key={`${slot.weekday}-${slot.start_time}`} className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-[#64748B]" />{getWeekdayLabel(slot.weekday)} · {formatGroupTime(slot.start_time)} – {formatGroupTime(slot.end_time)}</p>)}</div>
          {subscription.status === 'ACTIVE' && subscription.expires_at && <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300"><Clock3 className="h-4 w-4" />الاشتراك نشط حتى {new Date(subscription.expires_at).toLocaleDateString('ar-EG')}</p>}
          {subscription.rejection_reason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">سبب الرفض: {subscription.rejection_reason}</p>}
        </section>
        {subscription.status === 'PENDING_PAYMENT' && <form onSubmit={(event) => void submitPayment(event)} className={`${panel} space-y-4`}><div><h2 className="font-semibold">إرسال إثبات التحويل</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">حوّل المبلغ إلى إحدى الوسائل التالية، ثم أرسل بيانات التحويل والإيصال لمراجعة المدرس.</p></div>{subscription.available_payment_methods.length === 0 ? <p role="alert" className="text-sm text-[#B91C1C]">لا توجد وسيلة دفع فعّالة حاليًا. تواصل مع المدرس.</p> : <>
          <Select label="حوّلت إلى" placeholder="اختر وسيلة الدفع" options={subscription.available_payment_methods.map((method) => ({ value: method.id, label: `${getPaymentProviderLabel(method.provider)} — ${method.account_holder}` }))} value={methodId} onChange={(event) => setMethodId(event.target.value)} required />
          {subscription.available_payment_methods.filter((method) => method.id === methodId).map((method) => <div key={method.id} className="rounded-lg bg-[#F8FAFC] p-4 text-sm dark:bg-[#111827]"><p><strong>بيانات الحساب:</strong> {method.account_identifier}</p>{method.instructions && <p className="mt-1">{method.instructions}</p>}</div>)}
          <Input label="المبلغ المحوّل (جنيه)" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <Input label="صورة الإيصال" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} required helperText="JPG أو PNG أو WEBP، بحد أقصى 5 ميجابايت. الإيصال خاص ولا يراه إلا أنت والمدرس المعني." />
          <label className="block text-sm font-medium">ملاحظات (اختياري)<textarea className="mt-1.5 h-24 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm dark:border-[#334155] dark:bg-[#1E293B]" maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <Button type="submit" disabled={sending || !methodId} className="w-full">{sending ? 'جارٍ إرسال الإيصال...' : 'إرسال للمراجعة'}</Button>
        </>}</form>}
        {subscription.status === 'UNDER_REVIEW' && <section className={`${panel} flex items-start gap-3`}><ReceiptText className="mt-0.5 h-5 w-5 text-[#2563EB]" /><div><h2 className="font-semibold">وصلت بيانات الدفع للمدرس</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">سيتم تحديث حالة الاشتراك بعد قبول الدفع أو رفضه.</p></div></section>}
        {subscription.payment && <section className={`${panel} space-y-3`}><h2 className="font-semibold">بيانات الدفع</h2><p className="text-sm">{getPaymentProviderLabel(subscription.payment.provider)} · {subscription.payment.transferred_amount.toLocaleString('ar-EG')} جنيه</p><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">الحالة: {subscription.payment.status === 'PENDING' ? 'قيد المراجعة' : subscription.payment.status === 'APPROVED' ? 'مقبول' : 'مرفوض'}</p>{subscription.payment.rejection_reason && <p className="text-sm text-[#B91C1C]">سبب الرفض: {subscription.payment.rejection_reason}</p>}{subscription.payment.receipt_url && <a href={subscription.payment.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ReceiptText className="h-4 w-4" />عرض الإيصال الخاص</a>}</section>}
        {subscription.status === 'REJECTED' && <Button type="button" disabled={sending} onClick={() => void retry()}>{sending ? 'جارٍ إنشاء طلب جديد...' : 'إنشاء طلب اشتراك جديد'}</Button>}
      </>}
    </main>
  </div>
}
