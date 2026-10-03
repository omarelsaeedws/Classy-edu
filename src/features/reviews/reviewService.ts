import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/types'
import type {
  PublicTeacherReviewPage,
  StudentReviewListItem,
  StudentTeacherReviewStatus,
  TeacherReviewDashboard,
  TeacherReviewSummary,
} from './types'

const asObject = <T,>(value: Json | null): T | null => value === null ? null : value as unknown as T
const asArray = <T,>(value: Json | null): T[] => Array.isArray(value) ? value as unknown as T[] : []

export const reviewService = {
  async getPublicPage(teacherId: string, offset = 0, limit = 10): Promise<PublicTeacherReviewPage> {
    const { data, error } = await supabase.rpc('get_public_teacher_reviews', {
      p_teacher_id: teacherId,
      p_offset: offset,
      p_limit: limit,
    })
    if (error) throw error
    const result = asObject<PublicTeacherReviewPage>(data)
    if (!result) throw new Error('تعذّر تحميل التقييمات.')
    return result
  },

  async getSummaries(teacherIds: string[]): Promise<Record<string, TeacherReviewSummary>> {
    if (teacherIds.length === 0) return {}
    const summaries: Record<string, TeacherReviewSummary> = {}
    for (let offset = 0; offset < teacherIds.length; offset += 100) {
      const { data, error } = await supabase.rpc('get_public_teacher_review_summaries', {
        p_teacher_ids: teacherIds.slice(offset, offset + 100),
      })
      if (error) throw error
      for (const { teacher_id, ...summary } of asArray<{ teacher_id: string } & TeacherReviewSummary>(data)) {
        summaries[teacher_id] = summary
      }
    }
    return summaries
  },

  async getMyStatus(teacherId: string): Promise<StudentTeacherReviewStatus> {
    const { data, error } = await supabase.rpc('get_student_teacher_review', { p_teacher_id: teacherId })
    if (error) throw error
    const result = asObject<StudentTeacherReviewStatus>(data)
    if (!result) throw new Error('تعذّر التحقق من أهلية التقييم.')
    return result
  },

  async create(teacherId: string, rating: number, comment: string): Promise<void> {
    const { error } = await supabase.rpc('create_student_teacher_review', {
      p_teacher_id: teacherId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    })
    if (error) throw error
  },

  async update(reviewId: string, rating: number, comment: string): Promise<void> {
    const { error } = await supabase.rpc('update_student_teacher_review', {
      p_review_id: reviewId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    })
    if (error) throw error
  },

  async listMine(): Promise<StudentReviewListItem[]> {
    const { data, error } = await supabase.rpc('list_student_reviews')
    if (error) throw error
    return asArray<StudentReviewListItem>(data)
  },

  async getTeacherDashboard(): Promise<TeacherReviewDashboard> {
    const { data, error } = await supabase.rpc('get_teacher_review_dashboard')
    if (error) throw error
    const result = asObject<TeacherReviewDashboard>(data)
    if (!result) throw new Error('تعذّر تحميل ملخص التقييمات.')
    return result
  },
}

export const getReviewErrorMessage = (message: string): string => {
  if (message.includes('eligible teacher subscription')) return 'يمكنك تقييم المدرسين الذين اشتركت معهم فقط.'
  if (message.includes('already exists')) return 'لديك تقييم سابق لهذا المدرس؛ يمكنك تعديله.'
  if (message.includes('Rating must')) return 'اختر تقييمًا من نجمة إلى خمس نجوم.'
  if (message.includes('cannot exceed')) return 'يجب ألا يتجاوز التعليق 1000 حرف.'
  if (message.includes('Review not found')) return 'لم نعثر على تقييمك لتعديله.'
  if (message.includes('Teacher not found')) return 'هذا المدرس غير متاح حاليًا.'
  return 'تعذّر حفظ التقييم. تحقق من الاتصال وحاول مرة أخرى.'
}
