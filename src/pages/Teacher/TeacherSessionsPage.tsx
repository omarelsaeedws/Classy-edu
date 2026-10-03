import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, Plus, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatGroupTime, getWeekdayLabel } from '@/features/teacher-groups/types'
import { teacherGroupService } from '@/features/teacher-groups/teacherGroupService'
import type { TeacherGroup } from '@/features/teacher-groups/types'
import { attendanceService } from '@/features/attendance/attendanceService'
import type { TeacherClassSession } from '@/features/attendance/types'

const panel = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const timeLabel = (value: string) => new Date(`2000-01-01T${value.slice(0, 5)}:00`).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })
const todayInCairo = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
const sessionErrorText = (message: string) => {
  if (message.includes('overlaps')) return 'يتعارض الموعد مع حصة أخرى في المجموعة.'
  if (message.includes('past')) return 'لا يمكن إنشاء حصة بتاريخ سابق.'
  if (message.includes('active group')) return 'المجموعة غير نشطة أو لا تخص حسابك.'
  if (message.includes('active teacher subscription')) return 'تحتاج إلى اشتراك Classy فعال لإدارة الحصص.'
  if (message.includes('time range')) return 'تأكد أن وقت النهاية بعد وقت البداية.'
  return 'تعذّر تنفيذ العملية. راجع البيانات وحاول مرة أخرى.'
}

export const TeacherSessionsPage: React.FC = () => {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<TeacherGroup[]>([])
  const [sessions, setSessions] = useState<TeacherClassSession[]>([])
  const [groupId, setGroupId] = useState('')
  const [date, setDate] = useState(todayInCairo())
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('18:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    setError('')
    try {
      const [teacherGroups, teacherSessions] = await Promise.all([
        teacherGroupService.getOwnGroups(),
        attendanceService.listTeacherSessions(),
      ])
      const activeGroups = teacherGroups.filter((group) => group.status === 'ACTIVE')
      setGroups(activeGroups)
      setSessions(teacherSessions)
      setGroupId((current) => current || activeGroups[0]?.id || '')
    } catch (loadError) {
      console.error('Could not load teacher sessions:', loadError)
      setError('تعذّر تحميل الحصص. تحقق من تطبيق ترحيل Phase 06 وحاول مرة أخرى.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!sessions.some((session) => session.status === 'OPEN')) return
    const timer = window.setInterval(() => { void load() }, 5000)
    return () => window.clearInterval(timer)
  }, [load, sessions])

  const selectedGroup = groups.find((group) => group.id === groupId) ?? null
  const today = todayInCairo()
  const categorized = useMemo(() => ({
    today: sessions.filter((item) => item.session_date === today),
    upcoming: sessions.filter((item) => item.session_date > today && item.status !== 'CANCELLED'),
    previous: sessions.filter((item) => item.session_date < today || item.status === 'CANCELLED'),
  }), [sessions, today])

  const createSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await attendanceService.createSession({ groupId, date, startTime, endTime })
      setNotice('تم إنشاء الحصة. افتح الحضور في يوم انعقادها.')
      await load()
    } catch (saveError) {
      console.error('Could not create teacher session:', saveError)
      setError(sessionErrorText(saveError instanceof Error ? saveError.message : ''))
    } finally { setSaving(false) }
  }

  const openAttendance = async (session: TeacherClassSession) => {
    setError('')
    try {
      await attendanceService.openAttendance(session.id)
      navigate(`/teacher/sessions/${session.id}/attendance`)
    } catch (openError) {
      console.error('Could not open class attendance:', openError)
      const message = openError instanceof Error ? openError.message : ''
      setError(message.includes('session date')
        ? 'يمكن فتح الحضور في يوم انعقاد الحصة فقط.'
        : sessionErrorText(message))
    }
  }

  const cancelSession = async (session: TeacherClassSession) => {
    if (!window.confirm('هل تريد إلغاء هذه الحصة؟')) return
    setError('')
    try {
      await attendanceService.cancelSession(session.id)
      setNotice('تم إلغاء الحصة.')
      await load()
    } catch (cancelError) {
      console.error('Could not cancel teacher session:', cancelError)
      setError(sessionErrorText(cancelError instanceof Error ? cancelError.message : ''))
    }
  }

  const renderSession = (session: TeacherClassSession) => {
    const isExpiredOpen = session.status === 'OPEN' && session.attendance_code_expires_at !== null
      && new Date(session.attendance_code_expires_at).getTime() <= now
    const statusLabel = session.status === 'OPEN'
      ? isExpiredOpen ? 'انتهى وقت الحضور' : 'الحضور مفتوح'
      : session.status === 'COMPLETED' ? 'مكتملة' : session.status === 'CANCELLED' ? 'ملغاة' : 'مجدولة'
    return <article key={session.id} className={`${panel} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{session.group_name}</h3><p className="mt-1 flex items-center gap-2 text-sm text-[#64748B] dark:text-[#94A3B8]"><CalendarDays className="h-4 w-4" />{new Date(`${session.session_date}T12:00:00`).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div><Badge variant={session.status === 'OPEN' ? 'success' : session.status === 'CANCELLED' ? 'warning' : 'primary'}>{statusLabel}</Badge></div>
      <p className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-[#64748B]" />{timeLabel(session.start_time)} – {timeLabel(session.end_time)}</p>
      {(session.status === 'OPEN' || session.status === 'COMPLETED') && <p className="flex items-center gap-2 text-sm text-[#64748B] dark:text-[#94A3B8]"><Users className="h-4 w-4" />الحضور: {session.present_count} من {session.active_students} · {session.active_students ? Math.round(session.present_count * 100 / session.active_students) : 0}%</p>}
      <div className="flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-3 dark:border-[#334155]">
        {session.status === 'SCHEDULED' && session.session_date === today && <Button type="button" size="sm" onClick={() => void openAttendance(session)}>فتح الحضور</Button>}
        {session.status === 'SCHEDULED' && session.session_date !== today && <span className="self-center text-xs text-[#64748B] dark:text-[#94A3B8]">يفتح الحضور في يوم الحصة</span>}
        {session.status === 'OPEN' && <Link to={`/teacher/sessions/${session.id}/attendance`}><Button type="button" size="sm" variant="outline">عرض الحضور</Button></Link>}
        {session.status === 'SCHEDULED' && <Button type="button" size="sm" variant="outline" onClick={() => void cancelSession(session)}>إلغاء الحصة</Button>}
      </div>
    </article>
  }

  return <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
    <div className="mx-auto max-w-5xl space-y-6">
      <header><Link to="/teacher" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />العودة للوحة المدرس</Link><h1 className="text-2xl font-bold">إدارة الحصص والحضور</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">أنشئ موعد الحصة لكل مجموعة. مواعيد المجموعة الأسبوعية تساعدك في الاختيار ولا تنشئ حصصًا تلقائيًا.</p></header>
      {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</div>}
      <form onSubmit={(event) => void createSession(event)} className={`${panel} grid gap-4 sm:grid-cols-2`}>
        <div className="sm:col-span-2"><h2 className="flex items-center gap-2 font-semibold"><Plus className="h-5 w-5 text-[#2563EB]" />إنشاء حصة</h2></div>
        <Select label="المجموعة" placeholder="اختر مجموعة نشطة" options={groups.map((group) => ({ value: group.id, label: `${group.name} — ${group.subject} — ${group.grade ?? ''}` }))} value={groupId} onChange={(event) => setGroupId(event.target.value)} required />
        <Input label="تاريخ الحصة" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} required />
        <Input label="وقت البداية" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        <Input label="وقت النهاية" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
        {selectedGroup && <div className="rounded-lg bg-[#F8FAFC] p-3 text-xs text-[#64748B] dark:bg-[#111827] dark:text-[#94A3B8] sm:col-span-2"><p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">مواعيد المجموعة الأسبوعية — للاستئناس</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{selectedGroup.schedule.map((slot) => <span key={`${slot.weekday}-${slot.start_time}`}>{getWeekdayLabel(slot.weekday)}: {formatGroupTime(slot.start_time)}–{formatGroupTime(slot.end_time)}</span>)}</div></div>}
        <div className="sm:col-span-2"><Button type="submit" disabled={saving || !groups.length}>{saving ? 'جارٍ الإنشاء...' : 'إنشاء الحصة'}</Button>{groups.length === 0 && <p className="mt-2 text-xs text-[#64748B]">أنشئ مجموعة نشطة أولًا قبل جدولة الحصص.</p>}</div>
      </form>
      {loading ? <p className="py-10 text-center text-sm text-[#64748B]">جارٍ تحميل الحصص...</p> : <div className="space-y-7">
        {([{ title: 'حصص اليوم', items: categorized.today }, { title: 'الحصص القادمة', items: categorized.upcoming }, { title: 'الحصص السابقة والملغاة', items: categorized.previous }] as const).map((section) => <section key={section.title} className="space-y-3"><h2 className="font-semibold">{section.title} <span className="text-xs text-[#64748B]">({section.items.length})</span></h2>{section.items.length ? <div className="grid gap-3 md:grid-cols-2">{section.items.map(renderSession)}</div> : <div className={`${panel} text-sm text-[#64748B] dark:text-[#94A3B8]`}>لا توجد حصص في هذا القسم.</div>}</section>)}
      </div>}
    </div>
  </main>
}
