import React, { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StudentNavigation } from '@/components/navigation/StudentNavigation'
import { attendanceService } from '@/features/attendance/attendanceService'
import type { AttendanceHistorySession, StudentAttendanceSubject } from '@/features/attendance/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const timeLabel = (value: string) => new Date(`2000-01-01T${value.slice(0, 5)}:00`).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })

export const StudentAttendanceHistoryPage: React.FC = () => {
  const [subjects, setSubjects] = useState<StudentAttendanceSubject[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<StudentAttendanceSubject | null>(null)
  const [sessions, setSessions] = useState<AttendanceHistorySession[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void attendanceService.listStudentAttendanceSubjects().then((result) => {
        if (!cancelled) setSubjects(result)
      }).catch((loadError: unknown) => {
        console.error('Could not load student attendance subjects:', loadError)
        if (!cancelled) setError('تعذّر تحميل سجل الحضور. تأكد من تطبيق الترحيل الجديد وحاول مرة أخرى.')
      }).finally(() => { if (!cancelled) setLoading(false) })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (!selectedPeriod) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setDetailLoading(true)
      void attendanceService.getStudentSubscriptionAttendance(selectedPeriod.subscription_id).then((result) => {
        if (!cancelled) setSessions(result)
      }).catch((loadError: unknown) => {
        console.error('Could not load subject attendance:', loadError)
        if (!cancelled) setError('تعذّر تحميل حصص المادة. حاول مرة أخرى.')
      }).finally(() => { if (!cancelled) setDetailLoading(false) })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [selectedPeriod])

  const dateLabel = (value: string) => new Date(value).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric' })

  const statusLabel = (status: AttendanceHistorySession['status']) => status === 'ABSENT' ? 'غائب' : status === 'LATE' ? 'متأخر' : 'حاضر'
  const statusClass = (status: AttendanceHistorySession['status']) => status === 'ABSENT'
    ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
    : status === 'LATE' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
      : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'

  return <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]" dir="rtl">
    <StudentNavigation />
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
      <Link to="/student/attendance" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة للحصص وتسجيل الحضور</Link>
      <header><h1 className="text-2xl font-bold">سجل الحضور والغياب</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">اختر المادة لعرض الحصص التي حضرتها أو تغيبت عنها.</p></header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {selectedPeriod ? <section className={`${panel} space-y-4`}>
        <button type="button" onClick={() => { setSelectedPeriod(null); setSessions([]); setError('') }} className="text-sm font-medium text-[#2563EB] dark:text-[#60A5FA]">← كل فترات الاشتراك</button>
        <h2 className="text-xl font-semibold">{selectedPeriod.subject}</h2>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">فترة الاشتراك: {dateLabel(selectedPeriod.started_at)} – {dateLabel(selectedPeriod.expires_at)}</p>
        {detailLoading ? <p className="py-8 text-center text-sm text-[#64748B]">جارٍ تحميل سجل المادة...</p> : sessions.length === 0 ? <p className="py-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">لا توجد حصص مكتملة لهذه المادة حتى الآن.</p> : <div className="space-y-3">
          {sessions.map((session) => <article key={session.session_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]">
            <div><h3 className="font-medium">{session.group_name}</h3><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">{session.teacher_name}</p><p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8]"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(`${session.session_date}T12:00:00`).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeLabel(session.start_time)}–{timeLabel(session.end_time)}</span></p></div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(session.status)}`}>{statusLabel(session.status)}</span>
          </article>)}
        </div>}
      </section> : loading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل المواد...</p> : subjects.length === 0 ? <section className={`${panel} py-12 text-center text-sm text-[#64748B] dark:text-[#94A3B8]`}>لا توجد فترات اشتراك لها حصص مكتملة حتى الآن.</section> : <section className="grid gap-4 sm:grid-cols-2">
        {subjects.map((item) => <button key={item.subscription_id} type="button" onClick={() => { setSelectedPeriod(item); setError('') }} className={`${panel} text-right transition-colors hover:border-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]`}>
          <span className="text-lg font-semibold">{item.subject}</span>
          <span className="mt-2 block text-xs text-[#64748B] dark:text-[#94A3B8]">{item.groups.map((group) => `${group.group_name} · ${group.teacher_name}`).join('، ')}</span>
          <span className="mt-2 block text-xs text-[#64748B] dark:text-[#94A3B8]">فترة الاشتراك: {dateLabel(item.started_at)} – {dateLabel(item.expires_at)}</span>
          <span className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">{item.groups.map((group) => <React.Fragment key={group.group_id}><span className="rounded-lg bg-[#F8FAFC] p-2 dark:bg-[#111827]">إجمالي الحصص<br /><strong className="mt-1 inline-block text-sm">{group.total_sessions}</strong></span><span className="rounded-lg bg-green-50 p-2 text-green-800 dark:bg-green-950/30 dark:text-green-300">حضور<br /><strong className="mt-1 inline-block text-sm">{group.present_count}</strong></span><span className="rounded-lg bg-red-50 p-2 text-red-800 dark:bg-red-950/30 dark:text-red-300">غياب<br /><strong className="mt-1 inline-block text-sm">{group.absent_count}</strong></span></React.Fragment>)}</span>
        </button>)}
      </section>}
    </main>
  </div>
}
