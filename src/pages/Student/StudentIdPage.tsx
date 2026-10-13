import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IdCard, Printer, RefreshCw, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AttendanceQRCode } from '@/components/attendance/AttendanceQRCode'
import { studentIdService, type StudentIdData, type StudentIdSubscription } from '@/features/student-id/studentIdService'

const subscriptionStatus: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'ساري', className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300' },
  EXPIRED: { label: 'منتهي', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' },
  PENDING_PAYMENT: { label: 'في انتظار الدفع', className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300' },
  UNDER_REVIEW: { label: 'قيد المراجعة', className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300' },
  REJECTED: { label: 'مرفوض', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' },
  CANCELLED: { label: 'ملغي', className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300' },
}

const statusFor = (subscription: StudentIdSubscription) => {
  if (subscription.status === 'ACTIVE' && (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() <= Date.now())) return 'EXPIRED'
  return subscription.status
}

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(new Date(value))
  : 'غير محدد'

export const StudentIdPage = () => {
  const [data, setData] = useState<StudentIdData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await studentIdService.getMyCards())
    } catch (loadError) {
      console.error('Could not load student ID cards:', loadError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const subjects = data
    ? [...new Set(data.subscriptions.map((subscription) => subscription.subject || 'غير محددة'))]
    : []
  const activeSubject = selectedSubject && subjects.includes(selectedSubject) ? selectedSubject : subjects[0]
  const visibleSubscriptions = data?.subscriptions.filter(
    (subscription) => (subscription.subject || 'غير محددة') === activeSubject,
  ) ?? []

  return <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]">
    <main dir="rtl" className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div><h1 className="text-2xl font-bold">بطاقات الطالب</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">اختر المادة لعرض بطاقة اشتراكها.</p></div>
        {!loading && !error && data?.avatarUrl && visibleSubscriptions.length > 0 && <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة بطاقة {activeSubject}</Button>}
      </header>

      {loading && <div role="status" className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]">جارٍ تحميل بطاقة الطالب...</div>}
      {error && <section role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-center dark:border-red-900 dark:bg-[#1E293B]"><p className="text-sm text-red-700 dark:text-red-300">تعذّر تحميل بيانات بطاقة الطالب. تحقق من الاتصال ثم أعد المحاولة.</p><Button className="mt-4" variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" />إعادة المحاولة</Button></section>}

      {!loading && !error && data && !data.avatarUrl && <section className="mx-auto max-w-xl rounded-xl border border-[#E2E8F0] bg-white p-8 text-center dark:border-[#334155] dark:bg-[#1E293B] print:hidden">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]"><UserRound className="h-8 w-8" /></div>
        <h2 className="mt-4 text-xl font-bold">أضف صورتك الشخصية أولاً</h2>
        <p className="mt-2 text-sm leading-6 text-[#64748B] dark:text-[#94A3B8]">يجب إضافة صورة شخصية إلى حسابك حتى تتمكن من عرض بطاقة الطالب والتحقق من اشتراكاتك التعليمية.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3"><Link to="/student/settings#profile-picture"><Button>إضافة صورة شخصية</Button></Link><Link to="/student"><Button variant="outline">العودة إلى لوحة التحكم</Button></Link></div>
      </section>}

      {!loading && !error && data?.avatarUrl && <section id="student-id-print-area" className="space-y-4">
        {data.subscriptions.length === 0 ? <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center dark:border-[#334155] dark:bg-[#1E293B]"><IdCard className="mx-auto h-9 w-9 text-[#64748B]" /><h2 className="mt-3 font-semibold">لا توجد بطاقات اشتراك حاليًا</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">ستظهر بطاقاتك هنا بعد إنشاء طلب اشتراك مع مدرس.</p><Link className="mt-4 inline-block text-sm text-[#2563EB] dark:text-[#60A5FA] print:hidden" to="/student/teachers">اكتشف المدرسين والمجموعات</Link></div> : <>
          <nav aria-label="اختيار مادة البطاقة" className="flex flex-wrap gap-2 print:hidden">
            {subjects.map((subject) => <button
              key={subject}
              type="button"
              aria-pressed={subject === activeSubject}
              onClick={() => setSelectedSubject(subject)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${subject === activeSubject
                ? 'border-[#2563EB] bg-[#2563EB] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]'
                : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#2563EB] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:border-[#3B82F6]'}`}
            >{subject}</button>)}
          </nav>
          <div aria-live="polite" className="space-y-4">
            {visibleSubscriptions.map((subscription) => <StudentIdCard key={`${subscription.subject}-${subscription.teacherName}-${subscription.groupName}-${subscription.startedAt}-${subscription.expiresAt}`} data={data} subscription={subscription} />)}
          </div>
        </>}
      </section>}
    </main>
  </div>
}

const StudentIdCard = ({ data, subscription }: { data: StudentIdData; subscription: StudentIdSubscription }) => {
  const statusKey = statusFor(subscription)
  const status = subscriptionStatus[statusKey] ?? { label: statusKey || 'غير معروف', className: 'border-slate-200 bg-slate-50 text-slate-700' }
  return <article className="break-inside-avoid rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B] print:border-slate-400 print:bg-white print:text-black print:shadow-none">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <img src={data.avatarUrl ?? undefined} alt={`صورة ${data.fullName}`} className="h-16 w-16 rounded-full border border-[#E2E8F0] object-cover dark:border-[#334155] print:border-slate-400" />
        <div><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">بطاقة الطالب التعليمية</p><h2 className="mt-1 text-lg font-bold">{data.fullName}</h2><p className="mt-1 font-mono text-sm text-[#2563EB] dark:text-[#60A5FA]">{data.studentIdentifier}</p></div>
      </div>
      <span className={`rounded-md border px-3 py-1 text-sm font-medium ${status.className}`}>{status.label}</span>
    </div>
    <div className="mt-5 grid gap-3 border-t border-[#E2E8F0] pt-4 text-sm dark:border-[#334155] sm:grid-cols-2 print:border-slate-300">
      <p><span className="text-[#64748B] dark:text-[#94A3B8]">المادة: </span><strong>{subscription.subject || 'غير محددة'}</strong></p>
      <p><span className="text-[#64748B] dark:text-[#94A3B8]">المدرس: </span><strong>{subscription.teacherName || 'غير محدد'}</strong></p>
      <p><span className="text-[#64748B] dark:text-[#94A3B8]">المجموعة: </span><strong>{subscription.groupName || 'غير محددة'}</strong></p>
      <p><span className="text-[#64748B] dark:text-[#94A3B8]">انتهاء الاشتراك: </span><strong>{dateLabel(subscription.expiresAt)}</strong></p>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[#F8FAFC] p-4 dark:bg-[#111827] print:bg-white print:text-black">
      <div><p className="text-sm font-medium">رمز QR للرقم التعريفي</p><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">امسحه لعرض اشتراك الطالب لدى المدرس.</p></div>
      <div className="rounded-lg bg-white p-2"><AttendanceQRCode value={subscription.qrPayload} alt={`رمز QR للرقم التعريفي للطالب ${data.studentIdentifier}`} className="h-32 w-32" /></div>
    </div>
    <p className="mt-3 text-xs text-[#64748B] dark:text-[#94A3B8]">الرمز لا يثبت سريان الاشتراك وحده؛ يتحقق المدرس من الحالة الحالية عند المسح.</p>
  </article>
}
