import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, IdCard, RefreshCw, ScanLine, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { studentIdService, type TeacherVerificationResult, type VerifiedSubscription } from '@/features/student-id/studentIdService'

const TeacherSubscriptionQrScanner = lazy(() => import('@/components/student-id/TeacherSubscriptionQrScanner').then((module) => ({ default: module.TeacherSubscriptionQrScanner })))

const subscriptionState = (subscription: VerifiedSubscription) => {
  if (subscription.isValid && subscription.status === 'ACTIVE') {
    return { title: 'الاشتراك ساري', detail: 'هذا الطالب لديه اشتراك ساري في مجموعتك أو مادتك.', className: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300', Icon: CheckCircle2 }
  }
  if (subscription.status === 'EXPIRED' || subscription.status === 'ACTIVE') {
    return { title: 'الاشتراك منتهي', detail: 'لا يوجد اشتراك ساري حاليًا في هذه المجموعة.', className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300', Icon: ShieldAlert }
  }
  if (subscription.status === 'UNDER_REVIEW') return { title: 'الاشتراك قيد المراجعة', detail: 'لم يتم اعتماد الاشتراك بعد.', className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300', Icon: ShieldAlert }
  if (subscription.status === 'PENDING_PAYMENT') return { title: 'الاشتراك في انتظار الدفع', detail: 'لم يتم إرسال إثبات الدفع لهذا الاشتراك.', className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300', Icon: ShieldAlert }
  if (subscription.status === 'REJECTED') return { title: 'الاشتراك مرفوض', detail: 'هذا الاشتراك غير ساري.', className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300', Icon: ShieldAlert }
  if (subscription.status === 'CANCELLED') return { title: 'الاشتراك ملغي', detail: 'هذا الاشتراك غير ساري.', className: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300', Icon: ShieldAlert }
  return { title: 'حالة الاشتراك غير متاحة', detail: 'تعذّر تحديد حالة هذا الاشتراك.', className: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300', Icon: ShieldAlert }
}

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(new Date(value))
  : 'غير محدد'

const normalizeIdentifierDigits = (value: string) => value
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))

export const TeacherVerifySubscriptionPage = () => {
  const { profile } = useAuth()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [identifier, setIdentifier] = useState('')
  const [result, setResult] = useState<TeacherVerificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [inputError, setInputError] = useState('')
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    if (!result) return
    closeButtonRef.current?.focus()
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setResult(null)
        return
      }
      if (event.key !== 'Tab') return
      const dialog = closeButtonRef.current?.closest('[role="dialog"]')
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleDialogKeyboard)
    return () => document.removeEventListener('keydown', handleDialogKeyboard)
  }, [result])

  const verify = async (rawIdentifier: string) => {
    const value = normalizeIdentifierDigits(rawIdentifier.trim())
    if (!value) {
      setInputError('أدخل الرقم التعريفي للطالب أو امسح رمز البطاقة.')
      return
    }
    if (!/^[0-9]{6}$/.test(value)) {
      setInputError('الرقم التعريفي يجب أن يتكون من 6 أرقام.')
      return
    }
    setInputError('')
    setRequestError('')
    setLoading(true)
    try {
      const verification = await studentIdService.verifyForTeacher(value)
      setResult(verification)
      if (verification.kind === 'FOUND') setIdentifier('')
    } catch (verifyError) {
      console.error('Could not verify student subscription:', verifyError)
      const errorCode = typeof verifyError === 'object' && verifyError !== null && 'code' in verifyError
        ? String(verifyError.code)
        : ''
      setRequestError(errorCode === '42501'
        ? 'يجب أن يكون حساب المدرس واشتراك المنصة نشطين لإتمام التحقق.'
        : ['PGRST202', '42P01', '42703', '42883'].includes(errorCode)
          ? 'خدمة التحقق غير محدثة في قاعدة البيانات. أعد تطبيق ترحيل التحقق ثم أعد تحميل الصفحة.'
          : errorCode
            ? `تعذّر إتمام التحقق (رمز الخطأ ${errorCode}). أرسل الرمز الظاهر لفحص سبب المشكلة.`
            : 'تعذّر الاتصال بخدمة التحقق. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void verify(identifier)
  }

  return <main dir="rtl" className="min-h-screen bg-[#F8FAFC] p-4 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:p-8">
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/teacher" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة للوحة المدرس</Link>
      <header><div className="flex items-center gap-2"><ScanLine className="h-6 w-6 text-[#2563EB]" /><h1 className="text-2xl font-bold">التحقق من اشتراك طالب</h1></div><p className="mt-2 text-sm leading-6 text-[#64748B] dark:text-[#94A3B8]">تحقق من حالة اشتراك الطالب في مجموعاتك فقط. يتم التأكد من الحالة الحالية مباشرة من قاعدة البيانات.</p></header>

      <section className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B] sm:p-6">
        <Suspense fallback={<p className="rounded-lg border border-[#E2E8F0] p-4 text-sm text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">جارٍ تجهيز ماسح QR...</p>}><TeacherSubscriptionQrScanner disabled={loading} onPayload={(payload) => { setIdentifier(payload); void verify(payload) }} /></Suspense>
        <div className="relative flex items-center gap-3" aria-hidden="true"><div className="h-px flex-1 bg-[#E2E8F0] dark:bg-[#334155]" /><span className="text-xs text-[#64748B] dark:text-[#94A3B8]">أو أدخل الرقم يدويًا</span><div className="h-px flex-1 bg-[#E2E8F0] dark:bg-[#334155]" /></div>
        <form onSubmit={submit} className="space-y-4">
          <Input label="الرقم التعريفي للطالب" value={identifier} onChange={(event) => { setIdentifier(normalizeIdentifierDigits(event.target.value).replace(/[^0-9]/g, '').slice(0, 6)); setInputError('') }} placeholder="أدخل الرقم المكوّن من 6 أرقام أو امسح QR" dir="ltr" autoComplete="off" maxLength={6} inputMode="numeric" error={inputError} />
          <Button type="submit" disabled={loading} className="w-full sm:w-auto"><IdCard className="h-4 w-4" />{loading ? 'جارٍ التحقق...' : 'التحقق من الاشتراك'}</Button>
          {requestError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{requestError} <button type="button" className="ms-2 inline-flex items-center gap-1 font-medium underline" onClick={() => void verify(identifier)}><RefreshCw className="h-3 w-3" />إعادة المحاولة</button></p>}
        </form>
      </section>
    </div>

    {result && <VerificationModal result={result} teacherName={profile?.full_name ?? ''} onClose={() => setResult(null)} closeButtonRef={closeButtonRef} />}
  </main>
}

const VerificationModal = ({ result, teacherName, onClose, closeButtonRef }: {
  result: TeacherVerificationResult
  teacherName: string
  onClose: () => void
  closeButtonRef: RefObject<HTMLButtonElement | null>
}) => <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0F172A]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
  <section role="dialog" aria-modal="true" aria-labelledby="verification-title" className="my-auto w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-lg dark:border-[#334155] dark:bg-[#1E293B]">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">نتيجة التحقق</p><h2 id="verification-title" className="mt-1 text-lg font-bold">{result.kind === 'FOUND' ? 'بيانات الاشتراك' : result.kind === 'NOT_SUBSCRIBED' ? 'لا يوجد اشتراك مرتبط بك لهذا الطالب.' : result.kind === 'RATE_LIMITED' ? 'تم إيقاف التحقق مؤقتًا.' : 'الرقم التعريفي غير صحيح أو لا توجد بطاقة مرتبطة به.'}</h2></div><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="إغلاق نتيجة التحقق" className="rounded-md p-2 text-[#64748B] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:text-[#94A3B8] dark:hover:bg-[#111827]"><X className="h-5 w-5" /></button></div>
    {result.kind === 'FOUND' && <>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-[#F8FAFC] p-4 dark:bg-[#111827]">
        {result.avatarUrl ? <img src={result.avatarUrl} alt={`صورة ${result.fullName}`} className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#64748B] dark:bg-[#1E293B]"><IdCard className="h-6 w-6" /></div>}
        <div><h3 className="font-semibold">{result.fullName}</h3><p className="mt-1 font-mono text-sm text-[#2563EB] dark:text-[#60A5FA]">{result.studentIdentifier}</p></div>
      </div>
      <div className="mt-4 space-y-3">
        {result.subscriptions.map((subscription, index) => {
          const state = subscriptionState(subscription)
          const StateIcon = state.Icon
          return <article key={`${subscription.subject}-${subscription.groupName}-${subscription.expiresAt}-${subscription.status}-${index}`} className={`rounded-lg border p-4 ${state.className}`}>
            <div className="flex items-start gap-2"><StateIcon className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><h3 className="font-bold">{state.title}</h3><p className="mt-1 text-sm">{state.detail}</p></div></div>
            <dl className="mt-3 grid gap-2 border-t border-current/15 pt-3 text-sm sm:grid-cols-2"><div><dt className="opacity-75">المادة والمجموعة</dt><dd className="mt-1 font-medium">{subscription.subject} · {subscription.groupName}</dd></div><div><dt className="opacity-75">المدرس</dt><dd className="mt-1 font-medium">{teacherName || 'أنت'}</dd></div><div className="sm:col-span-2"><dt className="opacity-75">تاريخ انتهاء الاشتراك</dt><dd className="mt-1 font-medium">{dateLabel(subscription.expiresAt)}</dd></div></dl>
          </article>
        })}
      </div>
    </>}
    {result.kind !== 'FOUND' && <p className="mt-3 text-sm leading-6 text-[#64748B] dark:text-[#94A3B8]">{result.kind === 'NOT_SUBSCRIBED' ? 'لم يتم عرض بيانات الطالب؛ لا يوجد اشتراك مرتبط بحسابك.' : result.kind === 'RATE_LIMITED' ? 'وصلت إلى الحد المسموح لمحاولات التحقق. انتظر خمس دقائق ثم حاول مرة أخرى.' : 'راجع الرقم وحاول مرة أخرى. لا يتم عرض بيانات الحسابات غير المرتبطة بك.'}</p>}
    <div className="mt-5 flex justify-end"><Button type="button" variant="outline" onClick={onClose}>إغلاق</Button></div>
  </section>
</div>
