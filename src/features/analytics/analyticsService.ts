import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/types'

export type AnalyticsRange = { start: string; end: string }

export interface TeacherAnalytics {
  range_start: string
  range_end: string
  metrics: {
    active_students: number
    active_groups: number
    sessions: number
    attendance_records: number
    attendance_rate: number
    pending_requests: number
    rejected_subscriptions: number
    expired_subscriptions: number
    average_rating: number | null
    review_count: number
    recent_reviews: Array<{ display_name: string; rating: number; comment: string | null; created_at: string }>
    rating_distribution: Record<'1' | '2' | '3' | '4' | '5', number>
    classy_subscription_status: string | null
    classy_subscription_expires_at: string | null
  }
  groups: Array<{
    id: string
    name: string
    subject: string
    educational_stage: string | null
    grade: string | null
    status: 'ACTIVE' | 'INACTIVE'
    active_students: number
    pending_requests: number
    sessions: number
    attendance_rate: number
  }>
  students: Array<{
    student_id: string
    student_name: string
    group_id: string
    group_name: string
    subject: string
    subscription_status: string
    expires_at: string | null
    attendance_rate: number | null
  }>
}

export interface AdminAnalytics {
  range_start: string
  range_end: string
  metrics: {
    total_students: number
    new_students: number
    total_teachers: number
    new_teachers: number
    active_teachers: number
    pending_teachers: number
    expired_classy_subscriptions: number
    active_student_subscriptions: number
    expired_student_subscriptions: number
    active_groups: number
    sessions: number
    attendance_records: number
    attendance_rate: number
    average_rating: number | null
    review_count: number
  }
  monthly_activity: Array<{ month: string; new_users: number; student_subscriptions: number; sessions: number; reviews: number }>
  rating_distribution: Record<'1' | '2' | '3' | '4' | '5', number>
}

const asObject = <T,>(value: Json | null): T => value as unknown as T

export const analyticsService = {
  async getTeacher(range: AnalyticsRange, groupId: string): Promise<TeacherAnalytics> {
    const { data, error } = await supabase.rpc('get_teacher_phase09_analytics', {
      p_start: range.start,
      p_end: range.end,
      p_group_id: groupId || null,
    })
    if (error) throw error
    return asObject<TeacherAnalytics>(data)
  },

  async getAdmin(range: AnalyticsRange): Promise<AdminAnalytics> {
    const { data, error } = await supabase.rpc('get_admin_phase09_analytics', {
      p_start: range.start,
      p_end: range.end,
    })
    if (error) throw error
    return asObject<AdminAnalytics>(data)
  },
}

export const getAnalyticsRange = (preset: string): AnalyticsRange => {
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)
  if (preset === '7') start.setDate(start.getDate() - 6)
  else if (preset === '90') start.setDate(start.getDate() - 89)
  else if (preset === 'year') start.setMonth(0, 1)
  else start.setDate(start.getDate() - 29)
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { start: format(start), end: format(end) }
}
