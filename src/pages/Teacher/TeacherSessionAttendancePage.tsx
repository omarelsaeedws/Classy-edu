import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, QrCode, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AttendanceCountdown } from '@/components/attendance/AttendanceCountdown'
import { AttendanceQRCode } from '@/components/attendance/AttendanceQRCode'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { attendanceService } from '@/features/attendance/attendanceService'
import type { TeacherSessionAttendance } from '@/features/attendance/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const timeLabel = (value: string) => new Date(`2000-01-01T${value.slice(0, 5)}:00`).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })

export const TeacherSessionAttendancePage: React.FC = () => {
  const { id } = useParams()
  const [session, setSession] = useState<TeacherSessionAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(0)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (!id || loadingRef.current) return
    loadingRef.current = true
    try {
      setSession(await attendanceService.getTeacherSession(id))
      setError('')
    }
    catch (loadError) {
      console.error('Could not load teacher attendance session:', loadError)
      setError('تعذّر تحميل شاشة الحضور. تأكد من تسجيل الدخول بحساب المدرس صاحب الحصة.')
    } finally { loadingRef.current = false; setLoading(false) }
  }, [id])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (session?.status !== 'OPEN') return
    const timer = window.setInterval(() => { void load() }, 4000)
    return () => window.clearInterval(timer)
  }, [load, session?.status])
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const closeAttendance = async () => {
    if (!id) return
    setClosing(true)
    setError('')
    try {
      await attendanceService.closeSession(id)
      setNotice('تم إغلاق الحضور. لم يعد QR أو الكود صالحًا للتسجيل.')
      await load()
    } catch (closeError) {
      console.error('Could not close class attendance:', closeError)
      setError('تعذّر إغلاق الحضور. ربما أغلقته بالفعل.')
    } finally { setClosing(false) }
  }

  const extendAttendance = async () => {
    if (!id) return
    setExtending(true)
    setError('')
    setNotice('')
    try {
      await attendanceService.extendAttendance(id)
      setNotice('تم تمديد وقت الحضور خمس دقائق.')
      await load()
    } catch (extendError) {
      console.error('Could not extend class attendance:', extendError)
      setError('تعذّر تمديد الحضور. تأكد أن الحصة ما زالت مفتوحة وحاول مرة أخرى.')
    } finally { setExtending(false) }
  }

  const qrPayload = session?.attendance_code && session.status === 'OPEN' && session.attendance_code_expires_at
    && new Date(session.attendance_code_expires_at).getTime() > now
    ? (() => {
      const url = new URL(`/student/attendance/${session.id}`, window.location.origin)
      url.searchParams.set('code', session.attendance_code ?? '')
      return url.toString()
    })()
    : null
  const percentage = session?.active_students ? Math.round(session.present_count * 100 / session.active_students) : 0

  return <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/teacher/sessions" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة للحصص</Link>
      {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</div>}
      {loading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل الحصة...</p> : !session ? <section className={`${panel} text-center`}><h1 className="font-semibold">الحصة غير موجودة أو لا تخص حسابك</h1></section> : <>
        <section className={`${panel} space-y-3`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-bold">{session.group_name}</h1><p className="mt-1 flex items-center gap-2 text-sm text-[#64748B] dark:text-[#94A3B8]"><CalendarDays className="h-4 w-4" />{new Date(`${session.session_date}T12:00:00`).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="mt-1 flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-[#64748B]" />{timeLabel(session.start_time)} – {timeLabel(session.end_time)}</p></div><Badge variant={session.status === 'OPEN' ? 'success' : session.status === 'CANCELLED' ? 'warning' : 'primary'}>{session.status === 'OPEN' ? 'الحضور مفتوح' : session.status === 'COMPLETED' ? 'الحضور مغلق' : session.status === 'CANCELLED' ? 'الحصة ملغاة' : 'الحصة مجدولة'}</Badge></div>
          {session.status === 'OPEN' && session.attendance_code_expires_at && <p role="status" className="text-sm font-medium text-[#B45309] dark:text-amber-300"><AttendanceCountdown expiresAt={session.attendance_code_expires_at} /></p>}
        </section>
        {qrPayload && session.attendance_code && <section className={`${panel} grid gap-6 md:grid-cols-2`}><div className="space-y-4 text-center"><div className="flex items-center justify-center gap-2"><QrCode className="h-5 w-5 text-[#2563EB]" /><h2 className="font-semibold">كود الحضور</h2></div><p className="text-4xl font-bold tracking-[0.3em] text-[#2563EB] dark:text-[#60A5FA]" dir="ltr">{session.attendance_code}</p><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">يعرض هذا الكود للطلاب المسجلين في المجموعة فقط. صلاحيته عشر دقائق، ويمكن تمديده خمس دقائق.</p></div><div className="space-y-2 text-center"><h2 className="font-semibold">امسح QR أو أدخل الكود يدويًا</h2><AttendanceQRCode value={qrPayload} /></div><div className="flex flex-wrap justify-center gap-2 md:col-span-2"><Button type="button" variant="outline" disabled={extending || closing} onClick={() => void extendAttendance()}>{extending ? 'جارٍ التمديد...' : 'تمديد الحضور 5 دقائق'}</Button><Button type="button" variant="outline" disabled={closing || extending} onClick={() => void closeAttendance()}>{closing ? 'جارٍ الإغلاق...' : 'إغلاق الحضور'}</Button></div></section>}
        {session.status === 'OPEN' && !qrPayload && <section className={`${panel} space-y-3`}><p role="status" className="text-sm text-[#B45309] dark:text-amber-300">انتهت صلاحية الكود. لن يقبل النظام تسجيلات جديدة حتى تمديدها.</p><div className="flex flex-wrap gap-2"><Button type="button" disabled={extending || closing} onClick={() => void extendAttendance()}>{extending ? 'جارٍ التمديد...' : 'تمديد الحضور 5 دقائق'}</Button><Button type="button" variant="outline" disabled={closing || extending} onClick={() => void closeAttendance()}>{closing ? 'جارٍ الإغلاق...' : 'إغلاق الحضور'}</Button></div></section>}
        <section className={`${panel} space-y-4`}><div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#2563EB]" /><h2 className="font-semibold">إحصاءات الحضور</h2></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[#F8FAFC] p-4 dark:bg-[#111827]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">طلاب باشتراك سارٍ وقت الحصة</p><p className="mt-1 text-2xl font-bold">{session.active_students}</p></div><div className="rounded-lg bg-[#F8FAFC] p-4 dark:bg-[#111827]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">سجلوا الحضور</p><p className="mt-1 text-2xl font-bold">{session.present_count}</p></div><div className="rounded-lg bg-[#F8FAFC] p-4 dark:bg-[#111827]"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">نسبة الحضور</p><p className="mt-1 text-2xl font-bold">{percentage}%</p></div></div></section>
        <section className={`${panel} space-y-3`}><h2 className="font-semibold">قائمة الطلاب</h2>{session.attendance.length === 0 ? <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">لا يوجد طلاب مشتركين لهذه الحصة.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr className="border-b border-[#E2E8F0] text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]"><th className="p-3">الطالب</th><th className="p-3">الحالة</th><th className="p-3">وقت التسجيل</th></tr></thead><tbody>{session.attendance.map((item) => <tr key={item.student_id} className="border-b border-[#E2E8F0] last:border-0 dark:border-[#334155]"><td className="p-3">{item.student_name}</td><td className="p-3">{item.status === 'PRESENT' ? 'حاضر' : item.status === 'LATE' ? 'متأخر' : 'لم يسجل'}</td><td className="p-3">{item.attended_at ? new Date(item.attended_at).toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }) : '—'}</td></tr>)}</tbody></table></div>}</section>
      </>}
    </div>
  </main>
}
