import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Loader2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { GRADES_BY_STAGE, STAGE_OPTIONS } from '@/constants/education'

export const StudentOnboardingPage: React.FC = () => {
  const navigate = useNavigate()
  const { profile, completeStudentOnboarding } = useAuth()

  const [stage, setStage] = useState('')
  const [grade, setGrade] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStage = e.target.value
    setStage(newStage)
    setGrade('') // reset grade when stage changes
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!stage) {
      setError('يرجى اختيار المرحلة التعليمية')
      return
    }

    if (!grade) {
      setError('يرجى اختيار الصف الدراسي')
      return
    }

    setIsSubmitting(true)
    try {
      await completeStudentOnboarding({
        stage,
        grade,
      })
      navigate('/student', { replace: true })
    } catch (err) {
      console.error('Onboarding error:', err)
      setError('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى')
    } finally {
      setIsSubmitting(false)
    }
  }

  const availableGrades = stage ? GRADES_BY_STAGE[stage] || [] : []

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] dark:bg-[#0F172A] transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#3B82F6] flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            استكمال بيانات الطالب
          </h2>
          <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
            أهلاً بك يا {profile?.full_name || 'طالبنا العزيز'}! ساعدنا في تخصيص تجربتك التعليمية في أبو كبير
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] py-8 px-6 shadow-xs sm:rounded-xl sm:px-10 border border-[#E2E8F0] dark:border-[#334155]">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#991B1B]/50 text-xs text-[#DC2626] dark:text-[#FCA5A5] text-right font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Educational Stage */}
            <Select
              label="المرحلة التعليمية"
              placeholder="اختر المرحلة الدراسية"
              options={STAGE_OPTIONS}
              value={stage}
              onChange={handleStageChange}
              disabled={isSubmitting}
            />

            {/* Grade Selection */}
            <Select
              label="الصف الدراسي"
              placeholder={stage ? 'اختر الصف الدراسي' : 'يرجى اختيار المرحلة أولاً'}
              options={availableGrades}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={!stage || isSubmitting}
            />

            <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155]">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                className="w-full justify-center"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ البيانات...</span>
                  </span>
                ) : (
                  <span>حفظ واستمرار</span>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
