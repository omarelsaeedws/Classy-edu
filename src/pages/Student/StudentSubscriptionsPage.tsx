import React, { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, CreditCard, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { StudentNavigation } from '@/components/navigation/StudentNavigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { studentTeacherService } from '@/features/student-teachers/studentTeacherService'
import type { StudentSubscriptionRenewalSummary, StudentSubscriptionSummary, StudentSubscriptionStatus } from '@/features/student-teachers/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const statusText: Record<StudentSubscriptionStatus, string> = {
  PENDING_PAYMENT: 'بانتظار الدفع', UNDER_REVIEW: 'قيد مراجعة المدرس', ACTIVE: 'نشط',
  REJECTED: 'مرفوض', CANCELLED: 'ملغي', EXPIRED: 'منتهي',
}
const badgeVariant = (status: StudentSubscriptionStatus) => status === 'ACTIVE' ? 'success' : status === 'REJECTED' || status === 'EXPIRED' ? 'warning' : 'primary'

export const StudentSubscriptionsPage: React.FC = () => {
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState<StudentSubscriptionSummary[]>([])
  const [renewals, setRenewals] = useState<StudentSubscriptionRenewalSummary[]>([])
  const [renewingId, setRenewingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    try {
      const [items, pendingRenewals] = await Promise.all([
        studentTeacherService.listSubscriptions(), studentTeacherService.listStudentRenewals(),
      ])
      setSubscriptions(items)
      setRenewals(pendingRenewals)
    }
    catch (loadError) {
      console.error('Could not load student subscriptions:', loadError)
      setError('تعذّر تحميل الاشتراكات. تأكد من تطبيق ترحيل المرحلة الخامسة وحاول مرة أخرى.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const startRenewal = async (subscriptionId: string) => {
    setRenewingId(subscriptionId)
    setError('')
    try {
      const renewalId = await studentTeacherService.createRenewal(subscriptionId)
      navigate(`/student/subscriptions/renewals/${renewalId}`)
    } catch (renewalError) {
      console.error('Could not create student renewal:', renewalError)
      setError('تعذّر بدء التجديد. قد يكون هناك طلب تجديد قائم أو انتهى الاشتراك.')
    } finally { setRenewingId(null) }
  }

  return <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]" dir="rtl">
    <StudentNavigation />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header><h1 className="text-2xl font-bold">اشتراكاتي</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">تابع طلبات الاشتراك والمدفوعات ومدة الاشتراكات النشطة.</p></header>
      {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {loading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل الاشتراكات...</p> : subscriptions.length === 0 ? <section className={`${panel} py-12 text-center`}><CreditCard className="mx-auto h-9 w-9 text-[#64748B]" /><h2 className="mt-3 font-semibold">لا توجد اشتراكات بعد</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">اكتشف المدرسين واختر مجموعة مناسبة لصفك.</p><Link to="/student/teachers" className="mt-4 inline-flex"><Button>اكتشف المدرسين</Button></Link></section> : <section className="space-y-4">{subscriptions.map((item) => <article key={item.subscription_id} className={`${panel} flex flex-wrap items-center gap-4`}>
        {item.teacher_avatar_url ? <img src={item.teacher_avatar_url} alt={`صورة ${item.teacher_name}`} className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E3A8A]/40"><UserRound /></div>}
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.teacher_name}</h2><Badge variant={badgeVariant(item.status)}>{statusText[item.status]}</Badge></div><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{item.group_name} · {item.subject} · {item.grade}</p><p className="mt-1 text-sm">{item.monthly_price.toLocaleString('ar-EG')} جنيه / شهر</p>{item.status === 'ACTIVE' && item.expires_at && <p className="mt-1 flex items-center gap-1 text-xs text-[#15803D]"><CalendarClock className="h-4 w-4" />ينتهي في {new Date(item.expires_at).toLocaleDateString('ar-EG')}</p>}{item.rejection_reason && <p className="mt-2 text-xs text-[#B91C1C]">سبب الرفض: {item.rejection_reason}</p>}</div>
        {item.status === 'ACTIVE' && item.expires_at && (() => {
          const renewal = renewals.find((entry) => entry.subscription_id === item.subscription_id)
          return renewal
            ? <Link to={`/student/subscriptions/renewals/${renewal.renewal_id}`}><Button size="sm" variant="outline">{renewal.status === 'UNDER_REVIEW' ? 'متابعة التجديد' : 'استكمال التجديد'}</Button></Link>
            : <Button type="button" size="sm" disabled={renewingId === item.subscription_id} onClick={() => void startRenewal(item.subscription_id)}>{renewingId === item.subscription_id ? 'جارٍ بدء التجديد...' : 'تجديد الاشتراك'}</Button>
        })()}
        <Link to={`/student/subscriptions/${item.subscription_id}`}><Button variant="outline" size="sm">التفاصيل <ArrowLeft className="h-4 w-4" /></Button></Link>
      </article>)}</section>}
    </main>
  </div>
}
