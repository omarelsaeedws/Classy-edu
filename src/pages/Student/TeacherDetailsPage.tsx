import React, { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, MapPin, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StudentNavigation } from '@/components/navigation/StudentNavigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getPaymentProviderLabel } from '@/features/teacher-subscriptions/types'
import { formatGroupTime, getWeekdayLabel } from '@/features/teacher-groups/types'
import { studentTeacherService } from '@/features/student-teachers/studentTeacherService'
import type { StudentTeacherDetails, PublicTeacherProfile } from '@/features/student-teachers/types'
import { TeacherReviewsSection } from '@/features/reviews/components/TeacherReviewsSection'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { BrandLogo } from '@/components/brand/BrandLogo'

const panelClass = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]'

export const TeacherDetailsPage: React.FC = () => {
  const { profile, loading: authLoading } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState<StudentTeacherDetails | PublicTeacherProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!id || authLoading) return
    const teacherRequest = profile?.role === 'STUDENT'
      ? studentTeacherService.getTeacherDetails(id)
      : studentTeacherService.getPublicTeacherProfile(id)
    teacherRequest
      .then((data) => { if (!cancelled) setTeacher(data) })
      .catch((loadError: unknown) => {
        console.error('Could not load student-visible teacher details:', loadError)
        if (!cancelled) setError('تعذّر تحميل بيانات المدرس. تأكد من تطبيق ترحيل المرحلة الخامسة وحاول مرة أخرى.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [authLoading, id, profile?.role])

  const startSubscription = async (groupId: string) => {
    setRequesting(groupId)
    setError('')
    try {
      const subscriptionId = await studentTeacherService.createRequest(groupId)
      navigate(`/student/subscriptions/${subscriptionId}`)
    } catch (requestError) {
      console.error('Could not create student subscription request:', requestError)
      const message = requestError instanceof Error ? requestError.message : ''
      setError(message.includes('full')
        ? 'المجموعة مكتملة حاليًا ولا تقبل اشتراكات جديدة.'
        : message.includes('pending request') || message.includes('already exists')
          ? 'لديك طلب قائم أو اشتراك نشط في هذه المجموعة.'
          : message.includes('educational grade')
            ? 'هذه المجموعة غير مخصصة لصفك الدراسي.'
            : message.includes('payment method')
              ? 'لم يضف المدرس وسيلة دفع فعّالة بعد.'
              : 'تعذّر بدء طلب الاشتراك. حدّث الصفحة وحاول مرة أخرى.')
    } finally { setRequesting(null) }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]" dir="rtl">
      {profile?.role === 'STUDENT' ? <StudentNavigation /> : <nav className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3 dark:border-[#334155] dark:bg-[#1E293B] sm:px-6" dir="rtl"><Link to="/" aria-label="Classy - الصفحة الرئيسية"><BrandLogo className="h-8" /></Link><Link to="/login" className="text-sm text-[#2563EB] dark:text-[#60A5FA]">تسجيل الدخول</Link></nav>}
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link to={profile?.role === 'STUDENT' ? '/student/teachers' : '/'} className="inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#60A5FA]"><ArrowRight className="h-4 w-4" />{profile?.role === 'STUDENT' ? 'العودة للمدرسين' : 'العودة للرئيسية'}</Link>
        {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {loading || authLoading ? <p className="py-12 text-center text-sm text-[#64748B]">جارٍ تحميل الملف...</p> : !teacher ? (
          <section className={`${panelClass} py-10 text-center`}><h1 className="font-semibold">هذا المدرس غير متاح حاليًا</h1><p className="mt-2 text-sm text-[#64748B]">قد يكون الملف غير مكتمل أو لا توجد مجموعات مناسبة لصفك.</p></section>
        ) : <>
          <section className={`${panelClass} flex flex-wrap items-center gap-5`}>
            {teacher.avatar_url ? <img src={teacher.avatar_url} alt={`صورة ${teacher.full_name}`} className="h-24 w-24 rounded-full border border-[#E2E8F0] object-cover dark:border-[#334155]" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]"><UserRound className="h-10 w-10" /></div>}
            <div className="min-w-0 flex-1"><h1 className="text-2xl font-bold">{teacher.full_name}</h1><p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{teacher.lesson_title}</p><div className="mt-3 flex flex-wrap gap-2">{teacher.subjects.map((subject) => <Badge key={subject} variant="primary">{subject}</Badge>)}</div></div>
            <div className="text-lg font-semibold text-[#2563EB] dark:text-[#60A5FA]">{teacher.monthly_price.toLocaleString('ar-EG')} جنيه شهريًا</div>
          </section>
          <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-5">
              <article className={`${panelClass} space-y-3`}><h2 className="font-semibold">عن المدرس</h2><p className="whitespace-pre-wrap text-sm leading-7 text-[#475569] dark:text-[#CBD5E1]">{teacher.bio || 'لم يضف المدرس نبذة بعد.'}</p><div className="space-y-2 text-sm text-[#64748B] dark:text-[#94A3B8]"><p className="flex items-center gap-2"><MapPin className="h-4 w-4" />أبو كبير — {teacher.teaching_area}</p><p>{teacher.teaching_address}</p></div></article>
              <section className={`${panelClass} space-y-4`}><div><h2 className="font-semibold">المجموعات المتاحة لصفك</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">يتم التحقق من الصف والسعة داخل قاعدة البيانات عند إرسال الطلب.</p></div>
                {teacher.groups.map((group) => <article key={group.id} className="space-y-4 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{group.name}</h3><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{group.subject} · {group.educational_stage} · {group.grade}</p></div><Badge variant={group.available_seats > 0 ? 'success' : 'warning'}>{group.available_seats > 0 ? `متاح ${group.available_seats} مقعد` : 'المجموعة مكتملة'}</Badge></div>
                  <div className="space-y-1 text-sm">{group.schedule.map((slot) => <p key={`${slot.weekday}-${slot.start_time}`} className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#64748B]" />{getWeekdayLabel(slot.weekday)} <span className="text-[#64748B] dark:text-[#94A3B8]">{formatGroupTime(slot.start_time)} – {formatGroupTime(slot.end_time)}</span></p>)}</div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">السعة: {group.max_students} طالبًا · المشتركين النشطين: {group.active_students}</p>
                  {profile?.role === 'STUDENT' && <Button type="button" disabled={Boolean(group.my_subscription_status && ['ACTIVE', 'PENDING_PAYMENT', 'UNDER_REVIEW'].includes(group.my_subscription_status)) || group.available_seats <= 0 || requesting === group.id} onClick={() => void startSubscription(group.id)}>{requesting === group.id ? 'جارٍ إنشاء الطلب...' : group.my_subscription_status === 'ACTIVE' ? 'أنت مشترك بالفعل' : group.my_subscription_status === 'PENDING_PAYMENT' || group.my_subscription_status === 'UNDER_REVIEW' ? 'طلبك قيد المعالجة' : group.available_seats <= 0 ? 'المجموعة مكتملة' : 'اختيار المجموعة والاشتراك'}</Button>}
                </article>)}
              </section>
              <article className={panelClass}><TeacherReviewsSection teacherId={teacher.teacher_id} /></article>
            </div>
            {profile?.role === 'STUDENT' && 'payment_methods' in teacher && <aside className={`${panelClass} h-fit space-y-3`}><h2 className="font-semibold">طرق التحويل المتاحة</h2><p className="text-xs text-[#64748B] dark:text-[#94A3B8]">تظهر تفاصيل التحويل كاملة في خطوة إرسال الإيصال.</p>{teacher.payment_methods.map((method) => <div key={method.id} className="rounded-lg bg-[#F8FAFC] p-3 text-sm dark:bg-[#111827]"><p className="font-medium">{getPaymentProviderLabel(method.provider)}</p><p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{method.account_holder}</p></div>)}</aside>}
          </section>
        </>}
      </main>
    </div>
  )
}
