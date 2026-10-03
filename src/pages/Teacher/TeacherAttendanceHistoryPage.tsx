import React, { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, Search, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { attendanceService } from '@/features/attendance/attendanceService'
import type { AttendanceHistorySession, TeacherAttendanceStudent, TeacherStudentAttendanceHistory } from '@/features/attendance/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const timeLabel = (value: string) => new Date(`2000-01-01T${value.slice(0, 5)}:00`).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })

export const TeacherAttendanceHistoryPage: React.FC = () => {
  const { studentId } = useParams()
  const [search, setSearch] = useState('')
  const [students, setStudents] = useState<TeacherAttendanceStudent[]>([])
  const [history, setHistory] = useState<TeacherStudentAttendanceHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (studentId) {
      let cancelled = false
      const timer = window.setTimeout(() => {
        void attendanceService.getTeacherStudentAttendance(studentId).then((result) => {
          if (!cancelled) setHistory(result)
        }).catch((loadError: unknown) => {
          console.error('Could not load student attendance history:', loadError)
          if (!cancelled) setError('تعذّر تحميل سجل الطالب. تأكد أن الطالب مشترك معك.')
        }).finally(() => { if (!cancelled) setLoading(false) })
      }, 0)
      return () => { cancelled = true; window.clearTimeout(timer) }
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      void attendanceService.listTeacherAttendanceStudents(search).then((result) => {
        if (!cancelled) setStudents(result)
      }).catch((loadError: unknown) => {
        console.error('Could not load teacher attendance roster:', loadError)
        if (!cancelled) setError('تعذّر تحميل الطلاب. تأكد من تطبيق ترحيل سجل الحضور الجديد.')
      }).finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [studentId, search])

  const statusLabel = (status: AttendanceHistorySession['status']) => status === 'ABSENT' ? 'غائب' : status === 'LATE' ? 'متأخر' : 'حاضر'
  const statusClass = (status: AttendanceHistorySession['status']) => status === 'ABSENT'
    ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
    : status === 'LATE' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
      : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
  const dateLabel = (value?: string) => value
    ? new Date(value).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  const periodSessions = history?.sessions.reduce<Record<string, AttendanceHistorySession[]>>((periods, session) => {
    const id = session.subscription_id ?? session.group_id
    periods[id] ??= []
    periods[id].push(session)
    return periods
  }, {}) ?? {}

  return <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to={studentId ? '/teacher/attendance/history' : '/teacher'} className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />{studentId ? 'العودة لقائمة الطلاب' : 'العودة للوحة المدرس'}</Link>
      {studentId ? <>
        <header><h1 className="text-2xl font-bold">سجل حضور الطالب</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">كل اشتراك معروض كسجل مستقل من بدايته حتى انتهائه.</p></header>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        {loading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل سجل الطالب...</p> : !history ? <section className={`${panel} text-center`}>لم نعثر على سجل لهذا الطالب.</section> : <>
          <section className={`${panel} space-y-3`}><h2 className="font-semibold">سجل الاشتراكات والحصص</h2>{history.sessions.length === 0 ? <p className="py-8 text-center text-sm text-[#64748B]">لا توجد حصص مكتملة لهذا الطالب حتى الآن.</p> : Object.entries(periodSessions).map(([periodId, sessions]) => {
            const first = sessions[0]
            const present = sessions.filter((session) => session.status !== 'ABSENT').length
            const absent = sessions.length - present
            return <div key={periodId} className="space-y-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]">
              <div><h3 className="font-semibold">{first.subject} · {first.group_name}</h3><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">فترة الاشتراك: {dateLabel(first.subscription_started_at)} – {dateLabel(first.subscription_expires_at)}</p><p className="mt-2 text-sm">إجمالي الحصص: {sessions.length} · حضور: {present} · غياب: {absent}</p></div>
              {sessions.map((session) => <article key={session.session_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] p-3 dark:bg-[#111827]"><div><p className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(`${session.session_date}T12:00:00`).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeLabel(session.start_time)}–{timeLabel(session.end_time)}</span></p></div><span className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(session.status)}`}>{statusLabel(session.status)}</span></article>)}
            </div>
          })}</section>
        </>}
      </> : <>
        <header><h1 className="text-2xl font-bold">سجلات حضور الطلاب</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">ابحث عن طالب مشترك في مجموعاتك وافتح سجل حضوره وغيابه.</p></header>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <section className={`${panel} space-y-4`}>
          <label className="relative block"><span className="sr-only">البحث باسم الطالب</span><Search className="absolute right-3 top-3 h-4 w-4 text-[#64748B]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الطالب" className="pr-10" /></label>
          {loading ? <p className="py-10 text-center text-sm text-[#64748B]">جارٍ تحميل الطلاب...</p> : students.length === 0 ? <div className="py-10 text-center"><Users className="mx-auto h-8 w-8 text-[#94A3B8]" /><p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">لا يوجد طلاب مطابقون للبحث.</p></div> : <div className="space-y-3">{students.map((student) => <article key={student.student_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><div><h2 className="font-semibold">{student.student_name}</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">{student.groups.map((group) => `${group.subject} · ${group.group_name}`).join('، ')}</p><p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">سجل الحضور والغياب مقسّم حسب فترة الاشتراك.</p></div><Link to={`/teacher/attendance/history/${student.student_id}`}><Button type="button" variant="outline" size="sm">عرض السجل</Button></Link></article>)}</div>}
        </section>
      </>}
    </div>
  </main>
}
