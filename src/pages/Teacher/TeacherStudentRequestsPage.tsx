import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, Image, Users, X, Ban } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getPaymentProviderLabel } from '@/features/teacher-subscriptions/types'
import { studentTeacherService } from '@/features/student-teachers/studentTeacherService'
import type { TeacherStudentRenewal, TeacherStudentRequest } from '@/features/student-teachers/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'

export const TeacherStudentRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<TeacherStudentRequest[]>([])
  const [renewals, setRenewals] = useState<TeacherStudentRenewal[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    setError('')
    try {
      const [items, renewalItems] = await Promise.all([
        studentTeacherService.listTeacherRequests(), studentTeacherService.listTeacherRenewals(),
      ])
      setRequests(items)
      setRenewals(renewalItems)
    }
    catch (loadError) {
      console.error('Could not load student requests:', loadError)
      setError('تعذّر تحميل طلبات الطلاب. تأكد من تطبيق ترحيل المرحلة الخامسة وأن اشتراك المنصة نشط.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const review = async (request: TeacherStudentRequest, approve: boolean) => {
    const reason = reasons[request.subscription_id]?.trim() ?? ''
    if (!approve && reason.length < 3) {
      setError('اكتب سبب الرفض في الحقل المخصص قبل رفض الطلب.')
      return
    }
    setWorkingId(request.subscription_id)
    setError('')
    setNotice('')
    try {
      await studentTeacherService.reviewRequest(request.subscription_id, approve, reason)
      setNotice(approve ? 'تم قبول الدفع وتفعيل اشتراك الطالب لمدة شهر.' : 'تم رفض الدفع وإبلاغ الطالب بسبب الرفض.')
      await load()
    } catch (reviewError) {
      console.error('Could not review student payment:', reviewError)
      const message = reviewError instanceof Error ? reviewError.message : ''
      setError(message.includes('full') ? 'المجموعة وصلت إلى الحد الأقصى للطلاب؛ لم يتم تفعيل الاشتراك.' : 'تعذّرت مراجعة الطلب. ربما تمت مراجعته بالفعل أو لم يعد متاحًا.')
    } finally { setWorkingId(null) }
  }

  const reviewRenewal = async (renewal: TeacherStudentRenewal, approve: boolean) => {
    const reason = reasons[renewal.renewal_id]?.trim() ?? ''
    if (!approve && reason.length < 3) { setError('اكتب سبب الرفض قبل رفض طلب التجديد.'); return }
    setWorkingId(renewal.renewal_id)
    setError('')
    setNotice('')
    try {
      await studentTeacherService.reviewRenewal(renewal.renewal_id, approve, reason)
      setNotice(approve ? 'تم قبول التجديد وإضافة شهر لاشتراك الطالب.' : 'تم رفض التجديد وإبلاغ الطالب بسبب الرفض.')
      await load()
    } catch (reviewError) {
      console.error('Could not review student renewal:', reviewError)
      setError('تعذّرت مراجعة التجديد. قد يكون الاشتراك أُلغي أو تمت مراجعة الطلب بالفعل.')
    } finally { setWorkingId(null) }
  }

  const cancelSubscription = async (request: TeacherStudentRequest) => {
    if (!window.confirm(`هل تريد إلغاء اشتراك الطالب ${request.student_name} في مجموعة ${request.group_name} الآن؟`)) return
    setWorkingId(request.subscription_id)
    setError('')
    setNotice('')
    try {
      await studentTeacherService.cancelStudentSubscription(request.subscription_id)
      setNotice('تم إلغاء اشتراك الطالب وإيقاف إمكانية تسجيل الحضور والتجديد.')
      await load()
    } catch (cancelError) {
      console.error('Could not cancel student subscription:', cancelError)
      setError('تعذّر إلغاء الاشتراك. ربما انتهى أو تم إلغاؤه بالفعل.')
    } finally { setWorkingId(null) }
  }

  return <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
    <div className="mx-auto max-w-5xl space-y-6">
      <header><Link to="/teacher" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة للوحة المدرس</Link><h1 className="text-2xl font-bold">طلبات اشتراك الطلاب</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">راجع مبلغ التحويل والإيصال، ثم اقبل الدفع أو ارفضه مع توضيح السبب.</p></header>
      {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</div>}
      {loading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل الطلبات...</p> : <>
      {renewals.length > 0 && <section className="space-y-4"><h2 className="text-lg font-semibold">طلبات تجديد الاشتراك</h2>{renewals.map((renewal) => <article key={renewal.renewal_id} className={`${panel} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{renewal.student_name}</h3><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">تجديد {renewal.group_name} · {renewal.subject}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">طلب تجديد قيد المراجعة</span></div>
        <div className="grid gap-3 rounded-lg bg-[#F8FAFC] p-4 text-sm dark:bg-[#111827] sm:grid-cols-2"><p>قيمة التجديد: <strong>{renewal.amount.toLocaleString('ar-EG')} جنيه</strong></p><p>المبلغ المحوّل: <strong>{renewal.transferred_amount.toLocaleString('ar-EG')} جنيه</strong></p><p>وسيلة الدفع: {getPaymentProviderLabel(renewal.payment_provider)}</p><p>الحساب المحوّل إليه: {renewal.account_identifier}</p>{renewal.notes && <p className="sm:col-span-2">ملاحظات الطالب: {renewal.notes}</p>}</div>
        {renewal.receipt_url && <a href={renewal.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><Image className="h-4 w-4" />عرض إيصال التجديد</a>}
        <label className="block text-sm font-medium">سبب الرفض (مطلوب عند الرفض)<textarea className="mt-1.5 h-20 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm dark:border-[#334155] dark:bg-[#1E293B]" value={reasons[renewal.renewal_id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [renewal.renewal_id]: event.target.value }))} maxLength={1000} /></label>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={workingId === renewal.renewal_id} onClick={() => void reviewRenewal(renewal, true)}><Check className="h-4 w-4" />قبول التجديد وإضافة شهر</Button><Button type="button" variant="outline" disabled={workingId === renewal.renewal_id} onClick={() => void reviewRenewal(renewal, false)}><X className="h-4 w-4" />رفض التجديد</Button></div>
      </article>)}</section>}
      {requests.length === 0 && renewals.length === 0 ? <section className={`${panel} py-12 text-center`}><Users className="mx-auto h-9 w-9 text-[#64748B]" /><h2 className="mt-3 font-semibold">لا توجد طلبات أو اشتراكات حتى الآن</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">ستظهر هنا طلبات الطلاب بعد إرسال إيصال الدفع.</p></section> : requests.length > 0 && <section className="space-y-4"><h2 className="text-lg font-semibold">اشتراكات وطلبات الطلاب</h2>{requests.map((request) => {
        const awaiting = request.subscription_status === 'UNDER_REVIEW' && request.payment_status === 'PENDING'
        return <article key={request.subscription_id} className={`${panel} space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{request.student_name}</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{request.group_name} · {request.subject} · {request.educational_stage} — {request.grade}</p></div><span className={`rounded-full px-3 py-1 text-xs ${awaiting ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : request.subscription_status === 'ACTIVE' ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300' : 'bg-[#F1F5F9] text-[#475569] dark:bg-[#111827] dark:text-[#CBD5E1]'}`}>{awaiting ? 'بانتظار المراجعة' : request.subscription_status === 'ACTIVE' ? 'اشتراك نشط' : request.subscription_status === 'REJECTED' ? 'مرفوض' : request.subscription_status === 'EXPIRED' ? 'منتهي' : 'بانتظار الدفع'}</span></div>
          {request.payment_id && <div className="grid gap-3 rounded-lg bg-[#F8FAFC] p-4 text-sm dark:bg-[#111827] sm:grid-cols-2"><p>المبلغ المحوّل: <strong>{request.transferred_amount?.toLocaleString('ar-EG')} جنيه</strong></p><p>وسيلة الدفع: <strong>{request.payment_provider ? getPaymentProviderLabel(request.payment_provider) : '—'}</strong></p><p>الحساب المحوّل إليه: {request.account_identifier}</p><p>سعر الشهر: {request.monthly_price.toLocaleString('ar-EG')} جنيه</p></div>}
          {request.receipt_url && <a href={request.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><Image className="h-4 w-4" />عرض إيصال الطالب الخاص</a>}
          {request.rejection_reason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">سبب الرفض: {request.rejection_reason}</p>}
          {awaiting && <div className="space-y-3 border-t border-[#E2E8F0] pt-4 dark:border-[#334155]"><label className="block text-sm font-medium">سبب الرفض (مطلوب عند الرفض)<textarea className="mt-1.5 h-24 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm dark:border-[#334155] dark:bg-[#1E293B]" value={reasons[request.subscription_id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [request.subscription_id]: event.target.value }))} maxLength={1000} placeholder="اكتب سببًا واضحًا للطالب" /></label><div className="flex flex-wrap gap-2"><Button type="button" disabled={workingId === request.subscription_id} onClick={() => void review(request, true)}><Check className="h-4 w-4" />{workingId === request.subscription_id ? 'جارٍ الحفظ...' : 'قبول الدفع وتفعيل شهر'}</Button><Button type="button" variant="outline" disabled={workingId === request.subscription_id} onClick={() => void review(request, false)}><X className="h-4 w-4" />رفض الدفع</Button></div></div>}
          {request.subscription_status === 'ACTIVE' && <Button type="button" variant="outline" disabled={workingId === request.subscription_id} onClick={() => void cancelSubscription(request)}><Ban className="h-4 w-4 text-[#DC2626]" />إلغاء اشتراك الطالب</Button>}
        </article>
      })}</section>}
      </>}
    </div>
  </main>
}
