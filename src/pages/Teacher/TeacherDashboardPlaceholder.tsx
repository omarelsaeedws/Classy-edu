import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Briefcase, CalendarDays, CreditCard, LogOut, Settings, Star, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { analyticsService, getAnalyticsRange, type AnalyticsRange, type TeacherAnalytics } from '@/features/analytics/analyticsService'
import { AnalyticsBars, AnalyticsControls, RatingDistribution } from '@/components/analytics/AnalyticsControls'
import { RatingStars } from '@/features/reviews/components/RatingStars'
import { useNotifications } from '@/features/notifications/notificationContext'

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير متاح'
const subscriptionStatusLabel = (value: string | null) => ({ ACTIVE: 'نشط', EXPIRED: 'منتهي', APPROVED: 'معتمد', PENDING_PAYMENT: 'بانتظار الدفع', PAYMENT_SUBMITTED: 'تم إرسال الدفع', UNDER_REVIEW: 'قيد المراجعة', REJECTED: 'مرفوض', CANCELLED: 'ملغي' }[value ?? ''] ?? 'لا يوجد اشتراك')

export const TeacherDashboardPlaceholder = () => {
  const { profile, logout } = useAuth()
  const { notifications, loading: notificationsLoading } = useNotifications()
  const [range, setRange] = useState<AnalyticsRange>(() => getAnalyticsRange('30'))
  const [groupId, setGroupId] = useState('')
  const [groupOptions, setGroupOptions] = useState<Array<{ id: string; name: string }>>([])
  const [data, setData] = useState<TeacherAnalytics | null>(null)
  const [dataKey, setDataKey] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const queryKey = `${range.start}:${range.end}:${groupId}`
  const loading = dataKey !== queryKey && errorKey !== queryKey
  const error = errorKey === queryKey

  useEffect(() => {
    let active = true
    analyticsService.getTeacher(range, groupId).then((analytics) => { if (active) { setData(analytics); setGroupOptions((current) => current.length ? current : analytics.groups.map(({ id, name }) => ({ id, name }))); setDataKey(queryKey); setErrorKey('') } })
      .catch((loadError: unknown) => { console.error('Could not load teacher analytics:', loadError); if (active) setErrorKey(queryKey) })
    return () => { active = false }
  }, [range, groupId, queryKey])

  const metrics = data?.metrics
  const cards = [
    ['الطلاب النشطون', metrics?.active_students], ['المجموعات النشطة', metrics?.active_groups],
    ['الحصص خلال الفترة', metrics?.sessions], ['سجلات الحضور', metrics?.attendance_records],
    ['نسبة الحضور', metrics ? `${metrics.attendance_rate}%` : undefined], ['طلبات تحتاج مراجعة', metrics?.pending_requests],
    ['متوسط التقييم', metrics?.average_rating === null ? '—' : metrics?.average_rating?.toFixed(1)], ['عدد التقييمات', metrics?.review_count],
  ] as const

  return <main dir="rtl" className="min-h-screen bg-[#F8FAFC] p-4 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]">
        <div><div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-[#2563EB]" /><h1 className="text-xl font-bold">لوحة تحكم المدرس</h1></div><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">مرحبًا، {profile?.full_name}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="success">مدرس نشط</Badge><Link to="/teacher/settings"><Button variant="outline" size="sm"><Settings className="h-4 w-4" />الإعدادات</Button></Link><Button variant="outline" size="sm" onClick={() => void logout()}><LogOut className="h-4 w-4" />خروج</Button></div>
      </header>

      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/teacher/profile" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm hover:border-[#2563EB] dark:border-[#334155] dark:bg-[#1E293B]"><Users className="h-4 w-4 text-[#2563EB]" />بيانات المدرس والمجموعات</Link>
        <Link to="/teacher/sessions" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm hover:border-[#2563EB] dark:border-[#334155] dark:bg-[#1E293B]"><CalendarDays className="h-4 w-4 text-[#2563EB]" />الحصص والحضور</Link>
        <Link to="/teacher/students" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm hover:border-[#2563EB] dark:border-[#334155] dark:bg-[#1E293B]"><CreditCard className="h-4 w-4 text-[#2563EB]" />طلبات الاشتراك</Link>
        <Link to="/teacher/subscription" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm hover:border-[#2563EB] dark:border-[#334155] dark:bg-[#1E293B]"><Star className="h-4 w-4 text-[#2563EB]" />اشتراك Classy</Link>
      </nav>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]" aria-labelledby="teacher-latest-notifications"><div className="flex items-center justify-between gap-3"><h2 id="teacher-latest-notifications" className="font-semibold">آخر الإشعارات</h2><Link to="/notifications" className="text-sm text-[#2563EB] dark:text-[#60A5FA]">عرض الكل</Link></div>{notificationsLoading && notifications.length === 0 ? <p role="status" className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل الإشعارات...</p> : notifications.length === 0 ? <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">لا توجد إشعارات حاليًا.</p> : <ul className="mt-3 space-y-2">{notifications.slice(0, 3).map((notification) => <li key={notification.id} className="rounded-lg border border-[#E2E8F0] p-3 dark:border-[#334155]"><p className="text-sm font-medium">{notification.title}</p><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{notification.message}</p></li>)}</ul>}</section>

      <AnalyticsControls range={range} onChange={setRange} groups={groupOptions} groupId={groupId} onGroupChange={setGroupId} />
      {loading ? <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm dark:border-[#334155] dark:bg-[#1E293B]" role="status">جارٍ تحميل إحصائيات المدرس...</div>
        : error || !data ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">تعذّر تحميل الإحصائيات. حاول تحديث الصفحة.</div>
          : <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="ملخص أداء المدرس">
              {cards.map(([label, value]) => <article key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]"><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{label}</p><p className="mt-2 text-2xl font-bold">{value ?? '—'}</p></article>)}
            </section>
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]"><h2 className="font-semibold">اشتراك Classy</h2><div className="mt-2 flex flex-wrap gap-5 text-sm"><p>الحالة: <strong>{subscriptionStatusLabel(metrics?.classy_subscription_status ?? null)}</strong></p><p>ينتهي في: <strong>{dateLabel(metrics?.classy_subscription_expires_at ?? null)}</strong></p></div></section>
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]"><h2 className="mb-3 font-semibold">ملخص الاشتراكات</h2><div className="grid gap-3 sm:grid-cols-3"><p className="rounded-lg bg-[#F8FAFC] p-3 text-sm dark:bg-[#111827]">طلبات مرفوضة: <strong>{metrics?.rejected_subscriptions ?? 0}</strong></p><p className="rounded-lg bg-[#F8FAFC] p-3 text-sm dark:bg-[#111827]">اشتراكات منتهية: <strong>{metrics?.expired_subscriptions ?? 0}</strong></p><p className="rounded-lg bg-[#F8FAFC] p-3 text-sm dark:bg-[#111827]">متوسط التقييم: <strong>{metrics?.average_rating?.toFixed(1) ?? 'لا توجد تقييمات'}</strong></p></div></section>
            <div className="grid gap-4 lg:grid-cols-2"><AnalyticsBars title="نسبة الحضور حسب المجموعة" rows={data.groups.map((group) => ({ label: `${group.name} · ${group.subject} (%)`, value: group.attendance_rate }))} emptyText="لا توجد حصص مكتملة ضمن الفترة المحددة." /><RatingDistribution distribution={metrics?.rating_distribution ?? { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }} /></div>
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]" aria-labelledby="teacher-recent-reviews"><h2 id="teacher-recent-reviews" className="font-semibold">أحدث تقييمات الطلاب</h2>{metrics?.recent_reviews.length ? <div className="mt-3 space-y-3">{metrics.recent_reviews.map((review) => <article key={`${review.created_at}-${review.display_name}`} className="rounded-lg border border-[#E2E8F0] p-3 dark:border-[#334155]"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{review.display_name}</strong><RatingStars rating={review.rating} /></div>{review.comment && <p className="mt-2 text-sm text-[#475569] dark:text-[#CBD5E1]">{review.comment}</p>}<time className="mt-2 block text-xs text-[#64748B] dark:text-[#94A3B8]" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('ar-EG')}</time></article>)}</div> : <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">لا توجد تقييمات في هذه الفترة.</p>}</section>
            <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white dark:border-[#334155] dark:bg-[#1E293B]" aria-labelledby="teacher-analytics-students"><div className="border-b border-[#E2E8F0] p-5 dark:border-[#334155]"><h2 id="teacher-analytics-students" className="font-semibold">تحليلات الطلاب والاشتراكات</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">تظهر هنا بيانات الطلاب المرتبطين بمجموعاتك فقط.</p></div>{data.students.length === 0 ? <p className="p-5 text-sm text-[#64748B] dark:text-[#94A3B8]">لا توجد اشتراكات لهذه المجموعة.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-[#F8FAFC] text-[#64748B] dark:bg-[#111827] dark:text-[#94A3B8]"><tr><th className="p-3">الطالب</th><th className="p-3">المجموعة والمادة</th><th className="p-3">حالة الاشتراك</th><th className="p-3">الحضور</th><th className="p-3">انتهاء الاشتراك</th></tr></thead><tbody>{data.students.map((student) => <tr key={`${student.student_id}-${student.group_id}`} className="border-t border-[#E2E8F0] dark:border-[#334155]"><td className="p-3 font-medium">{student.student_name}</td><td className="p-3">{student.group_name} · {student.subject}</td><td className="p-3">{subscriptionStatusLabel(student.subscription_status)}</td><td className="p-3">{student.attendance_rate === null ? '—' : `${student.attendance_rate}%`}</td><td className="p-3">{dateLabel(student.expires_at)}</td></tr>)}</tbody></table></div>}</section>
            <div className="grid gap-3 sm:grid-cols-2">{data.groups.map((group) => <article key={group.id} className="rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm dark:border-[#334155] dark:bg-[#1E293B]"><h3 className="font-semibold">{group.name} · {group.subject}</h3><p className="mt-2 text-[#64748B] dark:text-[#94A3B8]">{group.educational_stage ?? ''} {group.grade ?? ''} · طلاب نشطون {group.active_students} · طلبات معلقة {group.pending_requests} · حصص {group.sessions}</p></article>)}</div>
          </>}
      <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]"><BarChart3 className="h-4 w-4" />القيم محسوبة من سجلات المجموعات والاشتراكات والحصص والتقييمات الفعلية.</div>
    </div>
  </main>
}
