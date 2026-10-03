import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CreditCard, FileImage } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StudentNavigation } from '@/components/navigation/StudentNavigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getPaymentProviderLabel } from '@/features/teacher-subscriptions/types'
import { studentTeacherService } from '@/features/student-teachers/studentTeacherService'
import type { StudentSubscriptionRenewalDetails } from '@/features/student-teachers/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'

export const StudentSubscriptionRenewalPage: React.FC = () => {
  const { renewalId = '' } = useParams()
  const navigate = useNavigate()
  const [renewal, setRenewal] = useState<StudentSubscriptionRenewalDetails | null>(null)
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!renewalId) return
    setError('')
    try {
      const result = await studentTeacherService.getRenewal(renewalId)
      setRenewal(result)
      setMethodId((current) => current || result.payment_methods[0]?.id || '')
      setAmount(String(result.amount))
    } catch (loadError) {
      console.error('Could not load subscription renewal:', loadError)
      setError('تعذّر تحميل طلب التجديد. تأكد من تطبيق الترحيل الجديد وحاول مرة أخرى.')
    } finally { setLoading(false) }
  }, [renewalId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!renewal || !receipt || !methodId) { setError('اختر وسيلة الدفع وارفع صورة الإيصال.'); return }
    setSaving(true)
    setError('')
    try {
      await studentTeacherService.submitRenewalPayment({
        renewalId,
        paymentMethodId: methodId,
        transferredAmount: Number(amount),
        receipt,
        notes,
      })
      setReceipt(null)
      setNotice('تم إرسال إثبات التجديد للمدرس لمراجعته.')
      await load()
    } catch (submitError) {
      console.error('Could not submit subscription renewal payment:', submitError)
      const message = submitError instanceof Error ? submitError.message : ''
      setError(message.includes('5 MB') || message.includes('Unsupported')
        ? 'الإيصال يجب أن يكون JPG أو PNG أو WEBP وألا يتجاوز 5 ميجابايت.'
        : 'تعذّر إرسال بيانات التجديد. تحقق من المبلغ ووسيلة الدفع والإيصال.')
    } finally { setSaving(false) }
  }

  const retry = async () => {
    if (!renewal) return
    setSaving(true)
    try {
      const nextId = await studentTeacherService.createRenewal(renewal.subscription_id)
      navigate(`/student/subscriptions/renewals/${nextId}`)
    } catch (retryError) {
      console.error('Could not retry subscription renewal:', retryError)
      setError('تعذّر بدء طلب تجديد جديد. تأكد من أن الاشتراك ما زال نشطًا.')
    } finally { setSaving(false) }
  }

  const statusLabel = renewal?.status === 'PENDING_PAYMENT' ? 'بانتظار الدفع'
    : renewal?.status === 'UNDER_REVIEW' ? 'قيد مراجعة المدرس'
      : renewal?.status === 'APPROVED' ? 'تم قبول التجديد'
        : renewal?.status === 'REJECTED' ? 'مرفوض' : 'ملغي'

  return <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]" dir="rtl">
    <StudentNavigation />
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <Link to="/student/subscriptions" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة لاشتراكاتي</Link>
      <header><h1 className="text-2xl font-bold">تجديد الاشتراك</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">يبدأ الشهر الإضافي بعد اعتماد المدرس، ويضاف إلى تاريخ انتهاء اشتراكك الحالي.</p></header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</p>}
      {loading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل طلب التجديد...</p> : !renewal ? <section className={`${panel} text-center`}>طلب التجديد غير موجود.</section> : <>
        <section className={`${panel} space-y-2`}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{renewal.teacher_name} · {renewal.group_name}</h2><span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs text-[#1D4ED8] dark:bg-blue-950/40 dark:text-blue-300">{statusLabel}</span></div><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{renewal.subject}</p><p className="font-semibold">قيمة التجديد لشهر: {renewal.amount.toLocaleString('ar-EG')} جنيه</p>{renewal.expires_at && <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">موعد الانتهاء الحالي: {new Date(renewal.expires_at).toLocaleDateString('ar-EG')}</p>}{renewal.rejection_reason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">سبب الرفض: {renewal.rejection_reason}</p>}</section>
        {renewal.status === 'PENDING_PAYMENT' && <form onSubmit={(event) => void submit(event)} className={`${panel} space-y-4`}>
          <h2 className="font-semibold">إرسال إثبات التحويل</h2>
          {renewal.payment_methods.length === 0 ? <p role="alert" className="text-sm text-red-700">لا توجد وسيلة دفع فعالة لدى المدرس حاليًا.</p> : <>
            <Select label="حوّلت إلى" placeholder="اختر وسيلة الدفع" options={renewal.payment_methods.map((method) => ({ value: method.id, label: `${getPaymentProviderLabel(method.provider)} — ${method.account_holder}` }))} value={methodId} onChange={(event) => setMethodId(event.target.value)} required />
            {renewal.payment_methods.filter((method) => method.id === methodId).map((method) => <div key={method.id} className="rounded-lg bg-[#F8FAFC] p-4 text-sm dark:bg-[#111827]"><p><strong>بيانات الحساب:</strong> {method.account_identifier}</p>{method.instructions && <p className="mt-1">{method.instructions}</p>}</div>)}
            <Input label="المبلغ المحوّل (جنيه)" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            <label className="block text-sm font-medium"><span className="mb-1.5 block">صورة إيصال التحويل</span><span className="flex min-h-11 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3.5 dark:border-[#334155] dark:bg-[#1E293B]"><FileImage className="h-4 w-4 text-[#64748B]" /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} required /></span><span className="mt-1 block text-xs text-[#64748B]">JPG أو PNG أو WebP بحد أقصى 5 ميجابايت.</span></label>
            <label className="block text-sm font-medium">ملاحظات (اختياري)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm dark:border-[#334155] dark:bg-[#1E293B]" /></label>
            <Button type="submit" disabled={saving || !methodId} className="w-full"><CreditCard className="h-4 w-4" />{saving ? 'جارٍ الإرسال...' : 'إرسال التجديد للمراجعة'}</Button>
          </>}
        </form>}
        {renewal.status === 'UNDER_REVIEW' && <section className={panel}><h2 className="font-semibold">طلبك قيد مراجعة المدرس</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">سيتم تمديد الاشتراك شهرًا بعد اعتماد الدفع.</p></section>}
        {renewal.payment?.receipt_url && <section className={panel}><a href={renewal.payment.receipt_url} target="_blank" rel="noreferrer" className="text-sm text-[#2563EB] dark:text-[#60A5FA]">عرض إيصال التجديد</a></section>}
        {renewal.status === 'APPROVED' && <section className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">تم اعتماد التجديد وإضافة شهر إلى اشتراكك.</section>}
        {renewal.status === 'REJECTED' && <Button type="button" disabled={saving} onClick={() => void retry()}>{saving ? 'جارٍ إنشاء طلب جديد...' : 'إعادة طلب التجديد'}</Button>}
      </>}
    </main>
  </div>
}
