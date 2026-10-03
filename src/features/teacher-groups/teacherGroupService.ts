import { supabase } from '@/lib/supabase/client'
import type { TeacherGroup, TeacherGroupInput, TeacherGroupScheduleSlot, TeacherGroupStatus } from './types'

export const teacherGroupService = {
  async getOwnGroups(): Promise<TeacherGroup[]> {
    const [groupsResult, slotsResult] = await Promise.all([
      supabase.from('teacher_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('teacher_group_schedule_slots').select('*').order('weekday').order('start_time'),
    ])
    if (groupsResult.error) throw groupsResult.error
    if (slotsResult.error) throw slotsResult.error
    const slotsByGroup = new Map<string, TeacherGroupScheduleSlot[]>()
    for (const slot of slotsResult.data ?? []) {
      const groupSlots = slotsByGroup.get(slot.group_id) ?? []
      groupSlots.push({ id: slot.id, weekday: slot.weekday, start_time: slot.start_time, end_time: slot.end_time })
      slotsByGroup.set(slot.group_id, groupSlots)
    }
    return (groupsResult.data ?? []).map((group) => ({ ...group, schedule: slotsByGroup.get(group.id) ?? [] }))
  },

  async getOwnGroup(groupId: string): Promise<TeacherGroup> {
    const groups = await this.getOwnGroups()
    const group = groups.find((item) => item.id === groupId)
    if (!group) throw new Error('Group not found.')
    return group
  },

  async save(input: TeacherGroupInput, groupId: string | null = null): Promise<string> {
    const { data, error } = await supabase.rpc('save_teacher_group', {
      p_group_id: groupId,
      p_name: input.name.trim(),
      p_subject: input.subject,
      p_educational_stage: input.educational_stage,
      p_grade: input.grade,
      p_schedule: input.schedule.map(({ weekday, start_time, end_time }) => ({ weekday, starts_at: start_time, ends_at: end_time })),
      p_max_students: input.max_students,
    })

    if (error) throw error
    return data
  },

  async setStatus(groupId: string, status: TeacherGroupStatus) {
    const { error } = await supabase.rpc('set_teacher_group_status', {
      p_group_id: groupId,
      p_status: status,
    })
    if (error) throw error
  },

  async delete(groupId: string): Promise<'DELETED' | 'ARCHIVED'> {
    const { data, error } = await supabase.rpc('delete_teacher_group', { p_group_id: groupId })
    if (error) throw error
    if (data !== 'DELETED' && data !== 'ARCHIVED') throw new Error('Unexpected group removal result.')
    return data
  },
}
