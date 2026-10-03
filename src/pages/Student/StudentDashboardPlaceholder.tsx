import React, { useEffect, useState } from 'react'
import { GraduationCap, LogOut, CheckCircle2, Search, CreditCard, CalendarCheck2, Settings, Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { studentTeacherService } from '@/features/student-teachers/studentTeacherService'
import type { StudentSubscriptionSummary } from '@/features/student-teachers/types'
import { attendanceService } from '@/features/attendance/attendanceService'
import type { StudentAttendanceSummary, StudentClassSession, StudentWeeklyGroupSchedule } from '@/features/attendance/types'
import { getWeekdayLabel } from '@/features/teacher-groups/types'
import { reviewService } from '@/features/reviews/reviewService'
import type { StudentReviewListItem } from '@/features/reviews/types'
import { RatingStars } from '@/features/reviews/components/RatingStars'
import { useNotifications } from '@/features/notifications/notificationContext'

const cairoDate = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export const StudentDashboardPlaceholder: React.FC = () => {
  const { profile, logout } = useAuth()
  const { notifications, loading: notificationsLoading, error: notificationsError } = useNotifications()
  const [now, setNow] = useState<number | null>(null)
  const [subscriptions, setSubscriptions] = useState<StudentSubscriptionSummary[]>([])
  const [attendanceSummary, setAttendanceSummary] = useState<StudentAttendanceSummary | null>(null)
  const [sessions, setSessions] = useState<StudentClassSession[]>([])
  const [weeklySchedules, setWeeklySchedules] = useState<StudentWeeklyGroupSchedule[]>([])
  const [myReviews, setMyReviews] = useState<StudentReviewListItem[]>([])
  const [myReviewsLoading, setMyReviewsLoading] = useState(true)
  const [myReviewsError, setMyReviewsError] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void studentTeacherService.listSubscriptions()
        .then(setSubscriptions)
        .catch((error: unknown) => console.error('Could not load student subscription summary:', error))
      void reviewService.listMine()
        .then(setMyReviews)
        .catch((error: unknown) => { console.error('Could not load student reviews:', error); setMyReviewsError(true) })
        .finally(() => setMyReviewsLoading(false))
      void Promise.all([attendanceService.getStudentSummary(), attendanceService.listStudentSessions(), attendanceService.listStudentWeeklySchedules()])
        .then(([summary, upcomingSessions, schedules]) => {
          setAttendanceSummary(summary)
          setSessions(upcomingSessions.filter((session) => session.session_date >= cairoDate()).slice(0, 3))
          setWeeklySchedules(schedules)
        })
        .catch((error: unknown) => console.error('Could not load student attendance summary:', error))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const activeCount = subscriptions.filter((item) => item.status === 'ACTIVE').length
  const pendingCount = subscriptions.filter((item) => item.status === 'PENDING_PAYMENT' || item.status === 'UNDER_REVIEW').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] p-4 sm:p-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1E293B] p-4 sm:p-6 rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                مرحباً، {profile?.full_name || 'بك'}
              </h1>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                حساب الطالب: {profile?.full_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="success">طالب معتمد</Badge>
            <Link to="/student/settings"><Button variant="outline" size="sm" aria-label="الإعدادات"><Settings className="h-4 w-4" /><span className="hidden sm:inline">الإعدادات</span></Button></Link>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut className="w-4 h-4 rtl:rotate-180" />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </Button>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-[#1E293B] p-6 sm:p-8 rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-xs text-right">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              تم استكمال ملف الطالب بنجاح
            </h2>
          </div>

          <div className="my-6">
            <div className="p-4 rounded-lg bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155]">
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mb-1">
                المرحلة والصف:
              </span>
              <span className="font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                {profile?.stage} — {profile?.grade}
              </span>
            </div>

          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/student/teachers" className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] p-4 text-sm font-medium hover:border-[#2563EB] dark:border-[#334155] dark:hover:border-[#3B82F6]"><Search className="h-5 w-5 text-[#2563EB]" />اكتشف المدرسين والمجموعات</Link>
            <Link to="/student/subscriptions" className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] p-4 text-sm font-medium hover:border-[#2563EB] dark:border-[#334155] dark:hover:border-[#3B82F6]"><CreditCard className="h-5 w-5 text-[#2563EB]" />متابعة اشتراكاتي ودفعاتي</Link>
            <Link to="/student/attendance" className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] p-4 text-sm font-medium hover:border-[#2563EB] dark:border-[#334155] dark:hover:border-[#3B82F6]"><CalendarCheck2 className="h-5 w-5 text-[#2563EB]" />حصصي وتسجيل الحضور</Link>
            <Link to="/student/attendance/history" className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] p-4 text-sm font-medium hover:border-[#2563EB] dark:border-[#334155] dark:hover:border-[#3B82F6]"><CalendarCheck2 className="h-5 w-5 text-[#2563EB]" />سجل الحضور والغياب حسب المادة</Link>
          </div>
          <section className="mt-6 space-y-3" aria-labelledby="student-notifications-heading">
            <div className="flex items-center justify-between gap-3"><h2 id="student-notifications-heading" className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-[#2563EB]" />آخر الإشعارات</h2><Link to="/notifications" className="text-sm text-[#2563EB] dark:text-[#60A5FA]">عرض الكل</Link></div>
            {notificationsLoading && notifications.length === 0 ? <p role="status" className="rounded-lg border border-[#E2E8F0] p-4 text-sm text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">جارٍ تحميل الإشعارات...</p> : notificationsError ? <p role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300">تعذّر تحميل الإشعارات.</p> : notifications.length === 0 ? <p className="rounded-lg border border-[#E2E8F0] p-4 text-sm text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">لا توجد إشعارات جديدة.</p> : notifications.slice(0, 3).map((notification) => <article key={notification.id} className="rounded-lg border border-[#E2E8F0] p-3 dark:border-[#334155]"><h3 className="text-sm font-semibold">{notification.title}</h3><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{notification.message}</p><time className="mt-1 block text-xs text-[#64748B] dark:text-[#94A3B8]" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString('ar-EG')}</time></article>)}
          </section>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">اشتراكات نشطة</p><p className="mt-1 text-2xl font-bold">{activeCount}</p></div>
            <div className="rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">طلبات تحتاج متابعة</p><p className="mt-1 text-2xl font-bold">{pendingCount}</p></div>
          </div>
          <section className="mt-6 space-y-3" aria-labelledby="student-attendance-heading">
            <div className="flex items-center justify-between gap-3"><h2 id="student-attendance-heading" className="font-semibold">الحصص القادمة</h2><Link to="/student/attendance" className="text-sm text-[#2563EB] dark:text-[#60A5FA]">سجل الحضور</Link></div>
            {sessions.length === 0 ? <p className="rounded-lg border border-[#E2E8F0] p-4 text-sm text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">لا توجد حصص منشأة قادمة.</p> : sessions.map((session) => <article key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><div><p className="font-medium">{session.group_name} · {session.teacher_name}</p><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">{new Date(`${session.session_date}T12:00:00`).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long' })} · {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}</p></div>{session.attendance_open && !session.attended ? <Link to={`/student/attendance/${session.id}`}><Button size="sm">تسجيل الحضور</Button></Link> : <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{session.attended ? 'تم تسجيل الحضور' : session.status === 'COMPLETED' ? 'انتهت' : 'مجدولة'}</span>}</article>)}
            <div className="space-y-2 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><h3 className="text-sm font-semibold">مواعيد مجموعاتك الأسبوعية</h3>{weeklySchedules.length === 0 ? <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">لا توجد مواعيد لمجموعات باشتراك نشط.</p> : weeklySchedules.map((slot) => <p key={`${slot.group_id}-${slot.weekday}-${slot.start_time}`} className="flex flex-wrap justify-between gap-2 text-sm"><span>{getWeekdayLabel(slot.weekday)} · {slot.group_name} · {slot.teacher_name}</span><span className="text-[#64748B] dark:text-[#94A3B8]">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</span></p>)}<p className="text-xs text-[#64748B] dark:text-[#94A3B8]">هذه مواعيد أسبوعية للمجموعة؛ يجب على المدرس إنشاء الحصة لظهورها كحصة فعلية وفتح تسجيل الحضور.</p></div>
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">إجمالي الحصص</p><p className="mt-1 text-xl font-bold">{attendanceSummary?.total_sessions ?? '—'}</p></div><div className="rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">الحضور</p><p className="mt-1 text-xl font-bold">{attendanceSummary?.present_sessions ?? '—'}</p></div><div className="rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">نسبة الحضور</p><p className="mt-1 text-xl font-bold">{attendanceSummary ? `${attendanceSummary.attendance_percentage}%` : '—'}</p></div></div>
            {attendanceSummary?.recent.slice(0, 3).map((item) => <div key={item.session_id} className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] py-2 text-sm last:border-0 dark:border-[#334155]"><span>{item.teacher_name} · {item.group_name}</span><span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{new Date(`${item.session_date}T12:00:00`).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short' })} · حاضر</span></div>)}
          </section>
          {subscriptions.slice(0, 5).map((item) => {
            const daysLeft = item.expires_at && now !== null ? Math.ceil((new Date(item.expires_at).getTime() - now) / 86400000) : null
            const status = item.status === 'ACTIVE' && daysLeft !== null && daysLeft <= 7 ? 'قارب على الانتهاء' : item.status === 'ACTIVE' ? 'نشط' : item.status === 'UNDER_REVIEW' ? 'قيد المراجعة' : item.status === 'PENDING_PAYMENT' ? 'بانتظار الدفع' : item.status === 'EXPIRED' ? 'منتهي' : item.status === 'REJECTED' ? 'مرفوض' : 'ملغي'
            return <Link key={item.subscription_id} to={`/student/subscriptions/${item.subscription_id}`} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] p-3 text-sm hover:border-[#2563EB] dark:border-[#334155] dark:hover:border-[#3B82F6]"><span>{item.teacher_name} · {item.subject} · {item.group_name}</span><span className="text-[#64748B] dark:text-[#94A3B8]">{status}{item.expires_at ? ` · ينتهي ${new Date(item.expires_at).toLocaleDateString('ar-EG')}` : ''}</span></Link>
          })}
          <section className="mt-6 space-y-3" aria-labelledby="my-reviews-heading">
            <h2 id="my-reviews-heading" className="font-semibold">تقييماتي ({myReviews.length})</h2>
            {myReviewsLoading ? <p className="rounded-lg border border-[#E2E8F0] p-4 text-sm text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">جارٍ تحميل تقييماتك...</p> : myReviewsError ? <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">تعذّر تحميل تقييماتك الآن.</p> : myReviews.length === 0 ? <p className="rounded-lg border border-[#E2E8F0] p-4 text-sm text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">لم تقم بإضافة أي تقييمات بعد.</p> : myReviews.map((review) => <article key={review.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><div><Link to={`/teachers/${review.teacher_id}`} className="font-medium text-[#2563EB] dark:text-[#60A5FA]">{review.teacher_name}</Link><div className="mt-1"><RatingStars rating={review.rating} /></div>{review.comment && <p className="mt-2 text-sm text-[#475569] dark:text-[#CBD5E1]">{review.comment}</p>}<p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">{new Date(review.updated_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><Link to={`/teachers/${review.teacher_id}`} className="text-sm text-[#2563EB] dark:text-[#60A5FA]">تعديل التقييم</Link></article>)}
          </section>
        </div>
      </div>
    </div>
  )
}
