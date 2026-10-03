export type TeacherGroupStatus = 'ACTIVE' | 'INACTIVE'

export interface TeacherGroup {
  id: string
  teacher_id: string
  name: string
  subject: string
  educational_stage: string | null
  grade: string | null
  max_students: number
  status: TeacherGroupStatus
  created_at: string
  updated_at: string
  schedule: TeacherGroupScheduleSlot[]
}

export interface TeacherGroupScheduleSlot {
  id?: string
  weekday: number
  start_time: string
  end_time: string
}

export interface TeacherGroupInput {
  name: string
  subject: string
  educational_stage: string
  grade: string
  schedule: TeacherGroupScheduleSlot[]
  max_students: number
}

export const TEACHER_GROUP_WEEKDAYS = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
] as const

export const getWeekdayLabel = (weekday: number) =>
  TEACHER_GROUP_WEEKDAYS.find((day) => day.value === weekday)?.label ?? 'يوم غير معروف'

export const formatGroupTime = (value: string) => value.slice(0, 5)
