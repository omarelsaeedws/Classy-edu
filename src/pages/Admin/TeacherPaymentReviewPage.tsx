import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, ExternalLink, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { subscriptionService } from '@/features/teacher-subscriptions/subscriptionService'
import { getPaymentProviderLabel, type AdminTeacherPayment } from '@/features/teacher-subscriptions/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'

export const TeacherPaymentReviewPage: React.FC = () => {
  const [items, setItems] = useState<AdminTeacherPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})
  const [receiptLinks, setReceiptLinks] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await subscriptionService.getAdminPaymentQueue())
    } catch (loadError) {
      console.error('Could not load teacher payment queue:', loadError)
      setError('تعذّر تحميل طلبات الدفع. تحقق من صلاحية حساب الأدمن وحاول مجدداً.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const openReceipt = async (item: AdminTeacherPayment) => {
    setError('')
    try {
      const url = await subscriptionService.getReceiptUrl(item.receipt_path)
      setReceiptLinks((current) => ({ ...current, [item.payment_id]: url }))
    } catch (receiptError) {
      console.error('Could not create signed receipt link:', receiptError)
      setError('تعذّر إنشاء رابط آمن للإيصال. أعد المحاولة.')
    }
  }

  const review = async (item: AdminTeacherPayment, approve: boolean) => {
    const reason = rejectionReasons[item.payment_id]?.trim() ?? ''
    if (!approve && reason.length < 3) {
      setError('اكتب سبب الرفض في ثلاثة أحرف على الأقل.')
      return
    }
    const prompt = approve ? `هل أنت متأكد من اعتماد دفع ${item.teacher_name} وتفعيل حسابه؟` : `هل أنت متأكد من رفض دفع ${item.teacher_name}؟`
    if (!window.confirm(prompt)) return
    setBusyId(item.payment_id)
    setError('')
    try {
      await subscriptionService.reviewPayment(item.payment_id, approve, reason)
      await reload()
    } catch (reviewError) {
      console.error('Could not review teacher payment:', reviewError)
      setError('تعذّرت مراجعة الطلب. ربما تمت مراجعته مسبقاً؛ حدّث القائمة.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#3B82F6]"><ArrowRight className="h-4 w-4" />لوحة الإدارة</Link>
          <h1 className="text-2xl font-bold">مراجعة اشتراكات المدرسين</h1>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">راجع بيانات التحويل والإيصال قبل تفعيل حساب المدرس.</p>
        </header>
        {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {loading && <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل الطلبات...</p>}
        {!loading && !items.length && <section className={panel}><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">لا توجد طلبات دفع حتى الآن.</p></section>}
        <div className="space-y-4">
          {items.map((item) => {
            const reviewable = item.payment_status === 'PAYMENT_SUBMITTED' || item.payment_status === 'UNDER_REVIEW'
            return (
              <article key={item.payment_id} className={panel}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] pb-4 dark:border-[#334155]">
                  <div>
                    <h2 className="font-semibold">{item.teacher_name}</h2>
                    <p dir="ltr" className="mt-1 text-right text-sm text-[#64748B] dark:text-[#94A3B8]">{item.teacher_email || '—'}</p>
                  </div>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${reviewable ? 'bg-[#FFFBEB] text-[#92400E] dark:bg-amber-950/50 dark:text-amber-300' : item.payment_status === 'APPROVED' ? 'bg-[#F0FDF4] text-[#166534] dark:bg-green-950/40 dark:text-green-300' : 'bg-[#FEF2F2] text-[#B91C1C] dark:bg-red-950/40 dark:text-red-300'}`}>
                    {item.payment_status === 'PAYMENT_SUBMITTED' || item.payment_status === 'UNDER_REVIEW' ? 'بانتظار المراجعة' : item.payment_status === 'APPROVED' ? 'مقبول' : 'مرفوض'}
                  </span>
                </div>
                <dl className="grid gap-3 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-[#64748B] dark:text-[#94A3B8]">الخطة</dt><dd className="mt-1">{item.duration_months} {item.duration_months === 1 ? 'شهر' : 'أشهر'} · {item.amount_due} جنيه</dd></div>
                  <div><dt className="text-[#64748B] dark:text-[#94A3B8]">المبلغ المحوّل</dt><dd className="mt-1">{item.transferred_amount} جنيه</dd></div>
                  <div><dt className="text-[#64748B] dark:text-[#94A3B8]">وسيلة الدفع</dt><dd className="mt-1">{getPaymentProviderLabel(item.payment_provider)}</dd></div>
                  <div><dt className="text-[#64748B] dark:text-[#94A3B8]">الحساب المحوّل إليه</dt><dd dir="ltr" className="mt-1 text-right">{item.payment_account_identifier}</dd></div>
                  <div><dt className="text-[#64748B] dark:text-[#94A3B8]">تاريخ الطلب</dt><dd className="mt-1">{new Date(item.submitted_at).toLocaleString('ar-EG')}</dd></div>
                  {item.notes && <div><dt className="text-[#64748B] dark:text-[#94A3B8]">ملاحظات المدرس</dt><dd className="mt-1">{item.notes}</dd></div>}
                  {item.rejection_reason && <div className="sm:col-span-2"><dt className="text-[#64748B] dark:text-[#94A3B8]">سبب الرفض</dt><dd className="mt-1">{item.rejection_reason}</dd></div>}
                </dl>
                <div className="flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-4 dark:border-[#334155]">
                  {!receiptLinks[item.payment_id] ? (
                    <Button variant="outline" size="sm" onClick={() => void openReceipt(item)}>إنشاء رابط آمن للإيصال</Button>
                  ) : (
                    <a href={receiptLinks[item.payment_id]} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 text-xs text-[#2563EB] dark:border-[#334155] dark:text-[#3B82F6]">عرض الإيصال <ExternalLink className="h-3.5 w-3.5" /></a>
                  )}
                </div>
                {reviewable && (
                  <div className="mt-4 space-y-3 rounded-lg bg-[#F8FAFC] p-4 dark:bg-[#111827]">
                    <label className="block text-sm font-medium">سبب الرفض (مطلوب عند الرفض)
                      <textarea value={rejectionReasons[item.payment_id] ?? ''} onChange={(event) => setRejectionReasons((current) => ({ ...current, [item.payment_id]: event.target.value }))} maxLength={1000} rows={2} className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm dark:border-[#334155] dark:bg-[#1E293B]" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busyId === item.payment_id} onClick={() => void review(item, true)}><Check className="h-4 w-4" />اعتماد الدفع وتفعيل المدرس</Button>
                      <Button variant="outline" size="sm" disabled={busyId === item.payment_id} onClick={() => void review(item, false)} className="text-[#DC2626]"><X className="h-4 w-4" />رفض الطلب</Button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}
