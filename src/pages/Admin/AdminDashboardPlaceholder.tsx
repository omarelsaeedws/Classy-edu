import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CreditCard, LogOut, Settings2, ShieldCheck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { analyticsService, getAnalyticsRange, type AdminAnalytics, type AnalyticsRange } from '@/features/analytics/analyticsService'
import { AnalyticsBars, AnalyticsControls, RatingDistribution } from '@/components/analytics/AnalyticsControls'

export const AdminDashboardPlaceholder = () => {
  const { profile, logout } = useAuth()
  const [range, setRange] = useState<AnalyticsRange>(() => getAnalyticsRange('30'))
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [dataKey, setDataKey] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const queryKey = `${range.start}:${range.end}`
  const loading = dataKey !== queryKey && errorKey !== queryKey
  const error = errorKey === queryKey

  useEffect(() => {
    let active = true
    analyticsService.getAdmin(range).then((analytics) => { if (active) { setData(analytics); setDataKey(queryKey); setErrorKey('') } })
      .catch((loadError: unknown) => { console.error('Could not load admin analytics:', loadError); if (active) setErrorKey(queryKey) })
    return () => { active = false }
  }, [range, queryKey])

  const m = data?.metrics
  const cards = [
    ['إجمالي الطلاب', m?.total_students], ['طلاب جدد بالفترة', m?.new_students],
    ['إجمالي المدرسين', m?.total_teachers], ['مدرسون نشطون', m?.active_teachers],
    ['مدرسون بانتظار التفعيل', m?.pending_teachers], ['اشتراكات طلاب نشطة', m?.active_student_subscriptions],
    ['مجموعات نشطة', m?.active_groups], ['حصص بالفترة', m?.sessions],
    ['نسبة الحضور', m ? `${m.attendance_rate}%` : undefined], ['متوسط التقييم', m?.average_rating?.toFixed(1) ?? '—'],
    ['التقييمات بالفترة', m?.review_count], ['اشتراكات Classy المنتهية', m?.expired_classy_subscriptions],
  ] as const

  return <main dir="rtl" className="min-h-screen bg-[#F8FAFC] p-4 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#2563EB]" /><h1 className="text-xl font-bold">لوحة تحليلات الإدارة</h1></div><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">مرحبًا، {profile?.full_name}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="primary">مدير النظام</Badge><Button variant="outline" size="sm" onClick={() => void logout()}><LogOut className="h-4 w-4" />خروج</Button></div>
      </header>
      <nav className="grid gap-3 sm:grid-cols-3">
        <Link to="/admin/subscriptions" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm dark:border-[#334155] dark:bg-[#1E293B]"><CreditCard className="h-4 w-4 text-[#2563EB]" />مراجعة اشتراكات المدرسين</Link>
        <Link to="/admin/settings/plans" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm dark:border-[#334155] dark:bg-[#1E293B]"><Settings2 className="h-4 w-4 text-[#2563EB]" />أسعار الخطط</Link>
        <Link to="/admin/settings/payment-methods" className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm dark:border-[#334155] dark:bg-[#1E293B]"><Wallet className="h-4 w-4 text-[#2563EB]" />بيانات التحويل</Link>
      </nav>
      <AnalyticsControls range={range} onChange={setRange} />
      {loading ? <div role="status" className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm dark:border-[#334155] dark:bg-[#1E293B]">جارٍ تحميل إحصائيات المنصة...</div>
        : error || !data ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">تعذّر تحميل إحصائيات المنصة. تحقق من ترحيل Phase 09 ثم أعد المحاولة.</div>
          : <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="إحصائيات المنصة">
              {cards.map(([label, value]) => <article key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]"><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{label}</p><p className="mt-2 text-2xl font-bold">{value ?? '—'}</p></article>)}
            </section>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]"><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">اشتراكات الطلاب المنتهية</p><p className="mt-2 text-xl font-bold">{m?.expired_student_subscriptions}</p></article>
              <article className="rounded-lg border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]"><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">حضور مسجل بالفترة</p><p className="mt-2 text-xl font-bold">{m?.attendance_records}</p></article>
              <article className="rounded-lg border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]"><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">المدرسون الجدد بالفترة</p><p className="mt-2 text-xl font-bold">{m?.new_teachers}</p></article>
              <article className="rounded-lg border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]"><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">متوسط تقييم المدرسين</p><p className="mt-2 text-xl font-bold">{m?.average_rating?.toFixed(1) ?? '—'}</p></article>
            </section>
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]" aria-label="نشاط المنصة الشهري"><h2 className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="h-5 w-5 text-[#2563EB]" />نشاط المنصة حسب الشهر</h2><div className="grid gap-4 lg:grid-cols-2"><AnalyticsBars title="مستخدمون جدد" rows={data.monthly_activity.map((item) => ({ label: new Date(`${item.month}T12:00:00`).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' }), value: item.new_users }))} /><AnalyticsBars title="اشتراكات الطلاب" rows={data.monthly_activity.map((item) => ({ label: new Date(`${item.month}T12:00:00`).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' }), value: item.student_subscriptions }))} /><AnalyticsBars title="الحصص المنشأة" rows={data.monthly_activity.map((item) => ({ label: new Date(`${item.month}T12:00:00`).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' }), value: item.sessions }))} /><AnalyticsBars title="التقييمات الجديدة" rows={data.monthly_activity.map((item) => ({ label: new Date(`${item.month}T12:00:00`).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' }), value: item.reviews }))} /></div></section>
            <RatingDistribution distribution={data.rating_distribution} />
          </>}
    </div>
  </main>
}
