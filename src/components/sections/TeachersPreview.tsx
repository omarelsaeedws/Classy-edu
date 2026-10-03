import React, { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Star, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { RatingStars } from '@/features/reviews/components/RatingStars'
import { landingTeacherService, type LandingTeacher } from '@/features/student-teachers/landingTeacherService'

const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')

export const TeachersPreview: React.FC = () => {
  const [teachers, setTeachers] = useState<LandingTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadTeachers = async () => {
      try {
        const result = await landingTeacherService.listTopTeachers()
        if (!cancelled) setTeachers(result.slice(0, 4))
      } catch (loadError) {
        console.error('Could not load landing teachers:', loadError)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTeachers()
    return () => { cancelled = true }
  }, [])

  return (
    <section id="teachers" className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 text-right sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] sm:text-3xl">
              مدرسون متاحون على Classy
            </h2>
            <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8] sm:text-base">
              أفضل المدرسين النشطين على المنصة حسب تقييمات الطلاب.
            </p>
          </div>
          <Link to="/student/teachers" className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] dark:text-[#3B82F6]">
            اكتشف كل المدرسين
          </Link>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]" role="status">جارٍ تحميل المدرسين...</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]" role="status">
            تعذّر تحميل المدرسين حاليًا. حاول مرة أخرى لاحقًا.
          </p>
        ) : teachers.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
            لا يوجد مدرسون متاحون حاليًا.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {teachers.map((teacher) => (
              <Card key={teacher.teacher_id} className="flex flex-col justify-between overflow-hidden transition-shadow duration-200 hover:shadow-md">
                <div>
                  <div className="p-6 pb-4">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-lg font-semibold text-[#2563EB] dark:border-[#334155] dark:bg-[#111827] dark:text-[#3B82F6]">
                        {getInitials(teacher.full_name) || <UserRound aria-hidden="true" className="h-7 w-7" />}
                        {teacher.avatar_url && (
                          <img
                            src={teacher.avatar_url}
                            alt={`صورة ${teacher.full_name}`}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => { event.currentTarget.hidden = true }}
                          />
                        )}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">{teacher.full_name}</h3>
                    <p className="mt-0.5 text-sm font-medium text-[#2563EB] dark:text-[#3B82F6]">
                      {teacher.subjects.join('، ')}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">{teacher.lesson_title}</p>
                    <div className="mt-3 flex items-center gap-1.5 border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">
                      <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>{teacher.teaching_area}</span>
                    </div>
                  </div>

                  <CardContent className="pb-4">
                    <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 dark:border-[#334155]/60 dark:bg-[#111827]">
                      <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">الاشتراك الشهري</span>
                      <span className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {teacher.monthly_price.toLocaleString('ar-EG')} جنيه / شهر
                      </span>
                    </div>
                    <div className="mt-3 flex min-h-6 items-center justify-between gap-2" aria-label="تقييم المدرس">
                      {teacher.average_rating === null ? (
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">لا توجد تقييمات بعد</span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {teacher.average_rating.toFixed(1)} <Star aria-hidden="true" className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                          </span>
                          <RatingStars rating={teacher.average_rating} />
                          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">({teacher.review_count})</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3">
                  <Link
                    to={`/teachers/${teacher.teacher_id}`}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-[#334155] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"
                  >
                    <span>عرض التفاصيل</span>
                    <ArrowLeft aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
