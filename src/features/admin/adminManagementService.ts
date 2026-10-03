import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/types'

export type AdminEntity = 'teachers' | 'students' | 'teacher_subscriptions' | 'student_subscriptions' | 'groups' | 'sessions' | 'reviews' | 'audit_logs'
export interface AdminListFilters {
  query?: string
  status?: string
  secondaryStatus?: string
  stage?: string
  subject?: string
  from?: string
  to?: string
  offset?: number
  limit?: number
}
export interface AdminListResult { rows: Record<string, Json>[]; total: number; offset: number; limit: number }

export const adminManagementService = {
  async list(entity: AdminEntity, filters: AdminListFilters = {}): Promise<AdminListResult> {
    const { data, error } = await supabase.rpc('admin_list_records', {
      p_entity: entity,
      p_query: filters.query?.trim() || null,
      p_status: filters.status || null,
      p_secondary_status: filters.secondaryStatus || null,
      p_stage: filters.stage || null,
      p_subject: filters.subject || null,
      p_from: filters.from || null,
      p_to: filters.to || null,
      p_offset: filters.offset ?? 0,
      p_limit: filters.limit ?? 20,
    })
    if (error) throw error
    return data as unknown as AdminListResult
  },
  async details(entity: 'teacher' | 'student' | 'session', id: string): Promise<Json> {
    const { data, error } = await supabase.rpc('admin_get_record_details', { p_entity: entity, p_id: id })
    if (error) throw error
    return data
  },
  async setReviewVisibility(id: string, visible: boolean) {
    const { error } = await supabase.rpc('admin_set_review_visibility', { p_review_id: id, p_is_visible: visible })
    if (error) throw error
  },
}
