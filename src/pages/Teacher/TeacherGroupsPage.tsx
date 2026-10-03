import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Edit3, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { GRADES_BY_STAGE, STAGE_OPTIONS } from '@/constants/education'
import { teacherGroupService } from '@/features/teacher-groups/teacherGroupService'
import { formatGroupTime, getWeekdayLabel, TEACHER_GROUP_WEEKDAYS, type TeacherGroup, type TeacherGroupScheduleSlot } from '@/features/teacher-groups/types'
import { teacherProfileService } from '@/features/teacher-profile/teacherProfileService'

const panelClass = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'
const fieldClass = 'h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]'

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const details = error as Record<string, unknown>
    return [details.message, details.details, details.hint]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
  }
  return ''
}

const errorText = (error: unknown) => {
  const message = errorMessage(error)
  if (message.includes('overlap')) return 'موعد هذه المجموعة يتعارض مع موعد مجموعة نشطة أخرى. اختر يومًا أو وقتًا مختلفًا.'
  if (message.includes('active teacher subscription')) return 'يلزم اشتراك منصة فعّال لإدارة المجموعات.'
  if (message.includes('Complete the subject, grade')) return 'أكمل المادة والمرحلة والصف والمواعيد قبل تفعيل المجموعة.'
  if (message.includes('Select a subject from your teacher profile')) return 'اختر مادة مضافة إلى بيانات المدرس.'
  return 'تعذّر تنفيذ العملية. حدّث الصفحة وحاول مرة أخرى.'
}

export const TeacherGroupsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const location = useLocation()
  const [groups, setGroups] = useState<TeacherGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(typeof location.state?.notice === 'string' ? location.state.notice : '')

  const loadGroups = useCallback(async () => {
    setError('')
    try { setGroups(await teacherGroupService.getOwnGroups()) }
    catch (loadError) { console.error('Could not load teacher groups:', loadError); setError(errorText(loadError)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadGroups() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadGroups])

  const changeStatus = async (group: TeacherGroup) => {
    setBusyId(group.id)
    try {
      const status = group.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await teacherGroupService.setStatus(group.id, status)
      setGroups((current) => current.map((item) => item.id === group.id ? { ...item, status } : item))
      setNotice(status === 'ACTIVE' ? 'تم تفعيل المجموعة.' : 'تم تعطيل المجموعة مع الاحتفاظ ببياناتها.')
      setError('')
    } catch (statusError) { console.error('Could not update group status:', statusError); setError(errorText(statusError)) }
    finally { setBusyId(null) }
  }

  const removeGroup = async (group: TeacherGroup) => {
    if (!window.confirm(`هل تريد حذف مجموعة «${group.name}» نهائيًا؟`)) return
    setBusyId(group.id)
    try {
      const result = await teacherGroupService.delete(group.id)
      if (result === 'DELETED') {
        setGroups((current) => current.filter((item) => item.id !== group.id))
        setNotice('تم حذف المجموعة.')
      } else {
        setGroups((current) => current.map((item) => item.id === group.id ? { ...item, status: 'INACTIVE' } : item))
        setNotice('للمجموعة سجلات اشتراك أو حضور؛ تم إيقافها مع الاحتفاظ بالسجلات المرتبطة.')
      }
      setError('')
    } catch (deleteError) { console.error('Could not delete group:', deleteError); setError(errorText(deleteError)) }
    finally { setBusyId(null) }
  }

  const Container = embedded ? 'section' : 'main'
  const dayCount = groups.filter((group) => group.status === 'ACTIVE').length
  return (
    <Container className={embedded ? 'space-y-4' : 'min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6'} dir="rtl">
      <div className={embedded ? 'space-y-4' : 'mx-auto max-w-5xl space-y-6'}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {!embedded && <Link to="/teacher" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#3B82F6]"><ArrowRight className="h-4 w-4" />العودة للوحة المدرس</Link>}
            <h2 className={embedded ? 'text-lg font-semibold' : 'text-2xl font-bold'}>إدارة المجموعات والحصص</h2>
            <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">كل مجموعة مرتبطة بمادة وصف دراسي، ويمكن تحديد أيام متعددة للحصص.</p>
          </div>
          <Link to="/teacher/groups/new"><Button><Plus className="h-4 w-4" />إضافة مجموعة</Button></Link>
        </header>
        <div className={`${panelClass} flex flex-wrap justify-between gap-3 text-sm`}><span>المجموعات النشطة: <strong>{loading ? '—' : dayCount}</strong></span><span>إجمالي المجموعات: <strong>{loading ? '—' : groups.length}</strong></span></div>
        {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{notice}</div>}
        {loading ? <p className="py-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل المجموعات...</p> : groups.length === 0 ? (
          <section className={`${panelClass} py-8 text-center`}><h3 className="font-semibold">لا توجد مجموعات بعد</h3><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">أضف مجموعة واربطها بالمادة والمرحلة والصف وحدد مواعيدها.</p><Link to="/teacher/groups/new" className="mt-4 inline-flex"><Button><Plus className="h-4 w-4" />إضافة مجموعة</Button></Link></section>
        ) : <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => <article key={group.id} className={`${panelClass} space-y-4`}>
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{group.name}</h3><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{group.subject} · {group.educational_stage ?? 'مرحلة غير محددة'} · {group.grade ?? 'صف غير محدد'}</p></div><Badge variant={group.status === 'ACTIVE' ? 'success' : 'neutral'}>{group.status === 'ACTIVE' ? 'نشطة' : 'غير نشطة'}</Badge></div>
            <div className="space-y-1 text-sm">{group.schedule.map((slot) => <p key={slot.id ?? `${slot.weekday}-${slot.start_time}`} className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#64748B]" />{getWeekdayLabel(slot.weekday)}<span className="text-[#64748B] dark:text-[#94A3B8]">{formatGroupTime(slot.start_time)}–{formatGroupTime(slot.end_time)}</span></p>)}</div>
            <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">الحد الأقصى: {group.max_students} طالبًا</p><div className="flex flex-wrap gap-2"><Link to={`/teacher/groups/${group.id}/edit`}><Button type="button" variant="outline" size="sm"><Edit3 className="h-4 w-4" />تعديل</Button></Link><Button type="button" variant="outline" size="sm" disabled={busyId === group.id} onClick={() => void changeStatus(group)}>{group.status === 'ACTIVE' ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}{group.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}</Button><Button type="button" variant="ghost" size="sm" disabled={busyId === group.id} onClick={() => void removeGroup(group)} aria-label={`حذف ${group.name}`}><Trash2 className="h-4 w-4 text-[#DC2626]" /></Button></div></div>
          </article>)}
        </div>}
        {!loading && <Button type="button" variant="ghost" size="sm" onClick={() => { setLoading(true); void loadGroups() }}>تحديث القائمة</Button>}
      </div>
    </Container>
  )
}

export const TeacherGroupFormPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [stage, setStage] = useState('')
  const [grade, setGrade] = useState('')
  const [schedule, setSchedule] = useState<TeacherGroupScheduleSlot[]>([{ weekday: 0, start_time: '17:00', end_time: '19:00' }])
  const [capacity, setCapacity] = useState('15')
  const [subjects, setSubjects] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([teacherProfileService.getOwnProfile(), id ? teacherGroupService.getOwnGroup(id) : Promise.resolve(null)])
      .then(([teacherData, group]) => {
        if (cancelled) return
        const teacherSubjects = teacherData.profile?.subjects ?? (teacherData.profile ? [teacherData.profile.subject] : [])
        setSubjects(teacherSubjects)
        if (group) {
          setName(group.name); setSubject(group.subject); setStage(group.educational_stage ?? ''); setGrade(group.grade ?? '')
          setSchedule(group.schedule.length ? group.schedule.map((slot) => ({ ...slot, start_time: formatGroupTime(slot.start_time), end_time: formatGroupTime(slot.end_time) })) : [{ weekday: 0, start_time: '17:00', end_time: '19:00' }])
          setCapacity(String(group.max_students))
        } else if (teacherSubjects.length === 1) setSubject(teacherSubjects[0])
      })
      .catch((loadError: unknown) => { console.error('Could not load group editor:', loadError); if (!cancelled) setError('تعذّر تحميل البيانات. تأكد من إضافة مادة في بيانات المدرس وتطبيق ترحيل إعدادات المجموعات الجديد.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const updateSlot = (index: number, key: keyof TeacherGroupScheduleSlot, value: string | number) => setSchedule((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, [key]: value } : slot))
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (!name.trim() || !subject || !stage || !grade || !schedule.length || Number(capacity) <= 0) { setError('أكمل اسم المجموعة والمادة والمرحلة والصف وموعدًا واحدًا على الأقل وحدد سعة أكبر من صفر.'); return }
    if (schedule.some((slot) => !slot.start_time || !slot.end_time || slot.start_time >= slot.end_time)) { setError('تأكد أن نهاية كل حصة بعد بدايتها.'); return }
    for (let index = 0; index < schedule.length; index += 1) {
      if (schedule.slice(0, index).some((previous) => previous.weekday === schedule[index].weekday && previous.start_time < schedule[index].end_time && previous.end_time > schedule[index].start_time)) { setError('يوجد تداخل بين حصتين في اليوم نفسه.'); return }
    }
    setSaving(true)
    try {
      const existingGroups = await teacherGroupService.getOwnGroups()
      const conflict = existingGroups
        .filter((group) => group.status === 'ACTIVE' && group.id !== id)
        .flatMap((group) => schedule.flatMap((slot) => {
          const conflictingSlot = group.schedule.find((existingSlot) => existingSlot.weekday === slot.weekday
            && existingSlot.start_time < slot.end_time && existingSlot.end_time > slot.start_time)
          return conflictingSlot ? [{ groupName: group.name, slot, conflictingSlot }] : []
        }))[0]
      if (conflict) {
        setError(`موعد ${getWeekdayLabel(conflict.slot.weekday)} ${formatGroupTime(conflict.slot.start_time)}–${formatGroupTime(conflict.slot.end_time)} يتعارض مع المجموعة «${conflict.groupName}» ${formatGroupTime(conflict.conflictingSlot.start_time)}–${formatGroupTime(conflict.conflictingSlot.end_time)}. اختر يومًا أو وقتًا مختلفًا.`)
        return
      }
      await teacherGroupService.save({ name, subject, educational_stage: stage, grade, schedule, max_students: Number(capacity) }, id ?? null)
      navigate('/teacher/profile', { replace: true, state: { notice: editing ? 'تم حفظ تعديلات المجموعة بنجاح.' : 'تم إنشاء المجموعة بنجاح.' } })
    } catch (saveError) { console.error('Could not save group:', saveError); setError(errorText(saveError)) }
    finally { setSaving(false) }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-6">
        <header><Link to="/teacher/profile" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#3B82F6]"><ArrowRight className="h-4 w-4" />العودة لبيانات المدرس والمجموعات</Link><h1 className="text-2xl font-bold">{editing ? 'تعديل المجموعة والحصص' : 'إضافة مجموعة وحصصها'}</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">اربط المجموعة بالمادة والمرحلة والصف ثم أضف كل أيام الحصص الأسبوعية.</p></header>
        {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {loading ? <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل البيانات...</p> : <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B] sm:p-6">
          {!subjects.length && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">أضف المواد التي تدرّسها أولًا من صفحة بيانات المدرس.</div>}
          <Input label="اسم المجموعة" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} placeholder="مثال: مجموعة الصف الثالث الثانوي" required />
          <div className="grid gap-4 sm:grid-cols-2"><Select label="المادة" placeholder="اختر المادة" options={subjects.map((value) => ({ value, label: value }))} value={subject} onChange={(event) => setSubject(event.target.value)} /><Select label="المرحلة التعليمية" placeholder="اختر المرحلة" options={STAGE_OPTIONS} value={stage} onChange={(event) => { setStage(event.target.value); setGrade('') }} /></div>
          <Select label="الصف الدراسي" placeholder={stage ? 'اختر الصف' : 'اختر المرحلة أولًا'} options={stage ? GRADES_BY_STAGE[stage] ?? [] : []} value={grade} onChange={(event) => setGrade(event.target.value)} disabled={!stage} />
          <Input label="الحد الأقصى للطلاب" type="number" inputMode="numeric" min={1} step={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} required helperText="سعة المجموعة القصوى؛ لا نحسب عدد الطلاب في هذه المرحلة." />
          <section className="space-y-4 border-t border-[#E2E8F0] pt-5 dark:border-[#334155]">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">أيام ومواعيد الحصص</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">أضف موعدًا لكل يوم تدرّس فيه هذه المجموعة. يمكنك اختيار أيام مختلفة أو إضافة أكثر من حصة في اليوم نفسه.</p></div><Button type="button" variant="outline" size="sm" disabled={schedule.length >= 14} onClick={() => setSchedule((current) => {
              const usedDays = new Set(current.map((slot) => slot.weekday))
              const nextWeekday = TEACHER_GROUP_WEEKDAYS.find((day) => !usedDays.has(day.value))?.value ?? 0
              return [...current, { weekday: nextWeekday, start_time: '17:00', end_time: '19:00' }]
            })}><Plus className="h-4 w-4" />إضافة يوم وموعد</Button></div>
            {schedule.map((slot, index) => <div key={index} className="grid gap-3 rounded-lg border border-[#E2E8F0] p-3 dark:border-[#334155] sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <label className="block text-sm font-medium"><span className="mb-1.5 block">اليوم</span><select className={fieldClass} value={slot.weekday} onChange={(event) => updateSlot(index, 'weekday', Number(event.target.value))}>{TEACHER_GROUP_WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
              <Input label="من الساعة" type="time" value={slot.start_time} onChange={(event) => updateSlot(index, 'start_time', event.target.value)} required />
              <Input label="إلى الساعة" type="time" value={slot.end_time} onChange={(event) => updateSlot(index, 'end_time', event.target.value)} required />
              <Button type="button" variant="ghost" size="sm" aria-label={`حذف الموعد ${index + 1}`} disabled={schedule.length === 1} onClick={() => setSchedule((current) => current.filter((_, slotIndex) => slotIndex !== index))}><Trash2 className="h-4 w-4 text-[#DC2626]" /></Button>
            </div>)}
          </section>
          <Button type="submit" disabled={saving || !subjects.length} className="w-full">{saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'إنشاء المجموعة'}</Button>
        </form>}
      </div>
    </main>
  )
}
