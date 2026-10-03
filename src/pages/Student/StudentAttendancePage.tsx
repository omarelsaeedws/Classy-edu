import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3 } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AttendanceQrScanner } from '@/components/attendance/AttendanceQrScanner'
import { StudentNavigation } from '@/components/navigation/StudentNavigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { attendanceService } from '@/features/attendance/attendanceService'
import type { AttendanceCheckInCode, StudentClassSession } from '@/features/attendance/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const messages: Record<AttendanceCheckInCode, string> = {
  RECORDED: 'تم تسجيل حضورك بنجاح.',
  ALREADY_ATTENDED: 'تم تسجيل حضورك مسبقًا لهذه الحصة.',
  EXPIRED: 'انتهى وقت تسجيل الحضور.',
  SESSION_CLOSED: 'تم إغلاق الحضور لهذه الحصة.',
  INVALID_CODE: 'كود الحضور غير صحيح.',
  SESSION_NOT_FOUND: 'لم نعثر على الحصة المطلوبة.',
  NO_ACTIVE_SUBSCRIPTION: 'لا يمكنك تسجيل الحضور لهذه المجموعة لأن اشتراكك غير نشط.',
  UNAUTHORIZED: 'يجب تسجيل الدخول بحساب طالب لتسجيل الحضور.',
  RATE_LIMITED: 'أدخلت أكوادًا غير صحيحة مرات كثيرة. انتظر 5 دقائق ثم حاول مرة أخرى.',
  NETWORK_ERROR: 'تعذّر الاتصال بخدمة الحضور. حاول مرة أخرى.',
}
const timeLabel = (value: string) => new Date(`2000-01-01T${value.slice(0, 5)}:00`).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })

export const StudentAttendancePage: React.FC = () => {
  const { sessionId = null } = useParams()
  const [searchParams] = useSearchParams()
  const queryCode = searchParams.get('code') ?? ''
  const [code, setCode] = useState(queryCode)
  const [sessions, setSessions] = useState<StudentClassSession[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [checking, setChecking] = useState(false)
  const [resultCode, setResultCode] = useState<AttendanceCheckInCode | null>(null)
  const [listError, setListError] = useState('')
  const requestKey = useRef('')

  const loadSessions = useCallback(async () => {
    try {
      const studentSessions = await attendanceService.listStudentSessions()
      setSessions(studentSessions)
    }
    catch (error) {
      console.error('Could not load student class sessions:', error)
      setListError('تعذّر تحميل حصصك. تأكد من تطبيق ترحيل Phase 06 وحاول مرة أخرى.')
    } finally { setLoadingList(false) }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSessions() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSessions])

  const submitCode = useCallback(async (attendanceCode: string, requestedSessionId: string | null) => {
    const normalizedCode = attendanceCode.trim()
    if (!/^\d{6}$/.test(normalizedCode)) {
      setResultCode('INVALID_CODE')
      return
    }
    setChecking(true)
    setResultCode(null)
    try {
      const result = await attendanceService.checkIn({ sessionId: requestedSessionId, code: normalizedCode })
      setResultCode(result.code)
      if (result.ok) await loadSessions()
    } finally { setChecking(false) }
  }, [loadSessions])

  useEffect(() => {
    if (!queryCode) return
    const attemptId = `${sessionId ?? 'manual'}:${queryCode}`
    if (requestKey.current === attemptId) return
    requestKey.current = attemptId
    const timer = window.setTimeout(() => { void submitCode(queryCode, sessionId) }, 0)
    return () => window.clearTimeout(timer)
  }, [queryCode, sessionId, submitCode])

  const handleQrPayload = (payload: string) => {
    try {
      const url = new URL(payload)
      const scannedCode = url.searchParams.get('code') ?? ''
      const pathSessionId = url.pathname.match(/\/student\/attendance\/([^/]+)/)?.[1] ?? null
      setCode(scannedCode)
      void submitCode(scannedCode, pathSessionId)
    } catch {
      if (/^\d{6}$/.test(payload.trim())) {
        setCode(payload.trim())
        void submitCode(payload.trim(), null)
      } else setResultCode('INVALID_CODE')
    }
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitCode(code, sessionId)
  }

  return <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]" dir="rtl">
    <StudentNavigation />
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <Link to="/student" className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة للوحة الطالب</Link>
      <section className={`${panel} space-y-4`}><div><h1 className="text-2xl font-bold">تسجيل الحضور</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">امسح QR الظاهر لدى المدرس، أو أدخل كود الحضور يدويًا. يلزم اشتراك نشط في المجموعة.</p></div>
        <AttendanceQrScanner onPayload={handleQrPayload} />
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Input label="كود الحضور" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setResultCode(null) }} placeholder="أدخل الكود المكوّن من 6 أرقام" required /><Button type="submit" disabled={checking || code.length !== 6}>{checking ? 'جارٍ التحقق...' : 'تسجيل الحضور'}</Button></form>
        {resultCode && <p role={resultCode === 'RECORDED' ? 'status' : 'alert'} className={`rounded-lg border p-3 text-sm ${resultCode === 'RECORDED' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'}`}>{messages[resultCode]}</p>}
      </section>
      <section className={`${panel} space-y-3`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">حصصك القادمة والحديثة</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">تظهر حصص المجموعات التي لديك اشتراك سارٍ فيها وقت الحصة.</p></div><Link to="/student/attendance/history" className="text-sm font-medium text-[#2563EB] dark:text-[#60A5FA]">سجل الحضور والغياب حسب المادة</Link></div>
        {listError && <p role="alert" className="text-sm text-[#B91C1C]">{listError}</p>}
        {loadingList ? <p className="text-sm text-[#64748B]">جارٍ تحميل الحصص...</p> : sessions.length === 0 ? <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">لا توجد حصص قريبة لمجموعاتك المشتركة.</p> : <div className="space-y-3">{sessions.map((session) => <article key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]"><div><h3 className="font-medium">{session.group_name}</h3><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8]"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(`${session.session_date}T12:00:00`).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeLabel(session.start_time)} – {timeLabel(session.end_time)}</span></p><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">المدرس: {session.teacher_name}</p></div>
          {session.attended ? <span className="text-sm text-green-700 dark:text-green-300">تم تسجيل حضورك</span> : session.attendance_open ? <Link to={`/student/attendance/${session.id}`}><Button type="button" size="sm">تسجيل الحضور</Button></Link> : <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{session.status === 'CANCELLED' ? 'ملغاة' : session.status === 'COMPLETED' ? 'انتهت' : 'مجدولة'}</span>}
        </article>)}</div>}
      </section>
    </main>
  </div>
}
