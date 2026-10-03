import React, { useEffect, useState } from 'react'
import { BookOpen, Search, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StudentNavigation } from '@/components/navigation/StudentNavigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AVAILABLE_SUBJECTS, GRADES_BY_STAGE, STAGE_OPTIONS } from '@/constants/education'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { studentTeacherService } from '@/features/student-teachers/studentTeacherService'
import type { StudentTeacherDirectoryItem, StudentTeacherFilters } from '@/features/student-teachers/types'
import { reviewService } from '@/features/reviews/reviewService'
import type { TeacherReviewSummary } from '@/features/reviews/types'
import { RatingStars } from '@/features/reviews/components/RatingStars'

const emptyFilters: StudentTeacherFilters = { stage: '', grade: '', subject: '', area: '', search: '' }
const panelClass = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'

export const StudentTeachersPage: React.FC = () => {
  const { profile } = useAuth()
  const [filters, setFilters] = useState<StudentTeacherFilters>(emptyFilters)
  const [teachers, setTeachers] = useState<StudentTeacherDirectoryItem[]>([])
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, TeacherReviewSummary>>({})
  const [reviewSummariesLoading, setReviewSummariesLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (nextFilters: StudentTeacherFilters) => {
    setLoading(true)
    setError('')
    try {
      const results = await studentTeacherService.listTeachers(nextFilters)
      setTeachers(results)
      setReviewSummariesLoading(true)
      try {
        setReviewSummaries(await reviewService.getSummaries(results.map((teacher) => teacher.teacher_id)))
      } catch (reviewError) {
        console.error('Could not load teacher review summaries:', reviewError)
        setReviewSummaries({})
      } finally {
        setReviewSummariesLoading(false)
      }
    }
    catch (searchError) {
      console.error('Could not search student teacher directory:', searchError)
      setTeachers([])
      setError('تعذّر تحميل المدرسين الآن. تأكد من تطبيق ترحيل المرحلة الخامسة وحاول مرة أخرى.')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!profile?.stage || !profile.grade) return
    const timer = window.setTimeout(() => {
      const initial = { ...emptyFilters, stage: profile.stage as string, grade: profile.grade as string }
      setFilters(initial)
      void search(initial)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [profile?.stage, profile?.grade])

  const updateFilter = (key: keyof StudentTeacherFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }))

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]" dir="rtl">
      <StudentNavigation />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <header><h1 className="text-2xl font-bold">اكتشف المدرسين</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">مدرسون نشطون ومجموعات تناسب {profile?.stage} — {profile?.grade} في أبو كبير.</p></header>
        <form className={`${panelClass} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`} onSubmit={(event) => { event.preventDefault(); void search(filters) }}>
          <Select label="المرحلة التعليمية" placeholder="كل المراحل" options={STAGE_OPTIONS} value={filters.stage} onChange={(event) => updateFilter('stage', event.target.value)} />
          <Select label="الصف الدراسي" placeholder="كل الصفوف" options={filters.stage ? GRADES_BY_STAGE[filters.stage] ?? [] : Object.values(GRADES_BY_STAGE).flat()} value={filters.grade} onChange={(event) => updateFilter('grade', event.target.value)} />
          <Select label="المادة" placeholder="كل المواد" options={AVAILABLE_SUBJECTS.map((subject) => ({ value: subject, label: subject }))} value={filters.subject} onChange={(event) => updateFilter('subject', event.target.value)} />
          <Input label="المنطقة" value={filters.area} onChange={(event) => updateFilter('area', event.target.value)} placeholder="مثال: أبو كبير" />
          <Input label="ابحث باسم المدرس أو المادة أو عنوان الدرس" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} />
          <div className="self-end"><Button type="submit" disabled={loading}><Search className="h-4 w-4" />{loading ? 'جارٍ البحث...' : 'بحث'}</Button></div>
        </form>
        {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {loading && teachers.length === 0 ? <p className="py-10 text-center text-sm text-[#64748B]">جارٍ تحميل المدرسين...</p> : teachers.length === 0 ? (
          <section className={`${panelClass} py-10 text-center`}><Users className="mx-auto h-8 w-8 text-[#64748B]" /><h2 className="mt-3 font-semibold">لا يوجد مدرسون مطابقون</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">تأكد من الفلاتر أو جرّب كلمة بحث أخرى.</p></section>
        ) : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="قائمة المدرسين">
          {teachers.map((teacher) => {
            const subjects = [...new Set(teacher.groups.map((group) => group.subject))]
            const grades = [...new Set(teacher.groups.map((group) => group.grade))]
            return <article key={teacher.teacher_id} className={`${panelClass} flex flex-col gap-4`}>
              <div className="flex items-center gap-3">
                {teacher.avatar_url ? <img src={teacher.avatar_url} alt={`صورة ${teacher.full_name}`} className="h-16 w-16 rounded-full border border-[#E2E8F0] object-cover dark:border-[#334155]" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]"><Users className="h-7 w-7" /></div>}
                <div className="min-w-0"><h2 className="truncate font-semibold">{teacher.full_name}</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{teacher.lesson_title}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">{subjects.map((subject) => <Badge key={subject} variant="primary">{subject}</Badge>)}</div>
              <div className="space-y-1 text-sm text-[#64748B] dark:text-[#94A3B8]"><p>الصفوف: {grades.join('، ')}</p><p>المنطقة: أبو كبير — {teacher.teaching_area}</p><p>المجموعات المتاحة: {teacher.groups.length}</p></div>
              <div className="flex items-center gap-2 text-sm" aria-label="ملخص تقييمات المدرس">{reviewSummariesLoading ? <span className="text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل التقييمات...</span> : (reviewSummaries[teacher.teacher_id]?.review_count ?? 0) > 0 ? <><RatingStars rating={reviewSummaries[teacher.teacher_id]?.average_rating ?? 0} /><span className="font-medium">{reviewSummaries[teacher.teacher_id]?.average_rating?.toFixed(1)}</span><span className="text-[#64748B] dark:text-[#94A3B8]">({reviewSummaries[teacher.teacher_id]?.review_count} تقييم)</span></> : <span className="text-[#64748B] dark:text-[#94A3B8]">لا توجد تقييمات</span>}</div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4 dark:border-[#334155]"><p className="font-semibold text-[#2563EB] dark:text-[#60A5FA]">{teacher.monthly_price.toLocaleString('ar-EG')} جنيه / شهر</p><Link to={`/teachers/${teacher.teacher_id}`}><Button variant="outline" size="sm"><BookOpen className="h-4 w-4" />التفاصيل</Button></Link></div>
            </article>
          })}
        </section>}
      </main>
    </div>
  )
}
