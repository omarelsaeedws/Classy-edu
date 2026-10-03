export type ClassSessionStatus = 'SCHEDULED' | 'OPEN' | 'COMPLETED' | 'CANCELLED'
export type AttendanceRecordStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'NOT_RECORDED'

export interface TeacherClassSession {
  id: string
  group_id: string
  group_name: string
  session_date: string
  start_time: string
  end_time: string
  status: ClassSessionStatus
  attendance_open: boolean
  attendance_code?: string | null
  attendance_code_expires_at: string | null
  opened_at?: string | null
  closed_at?: string | null
  active_students: number
  present_count: number
}

export interface TeacherSessionAttendance extends TeacherClassSession {
  attendance: Array<{
    student_id: string
    student_name: string
    status: AttendanceRecordStatus
    attended_at: string | null
  }>
}

export interface StudentClassSession {
  id: string
  group_id: string
  group_name: string
  teacher_name: string
  session_date: string
  start_time: string
  end_time: string
  status: ClassSessionStatus
  attendance_open: boolean
  attendance_code_expires_at: string | null
  attended: boolean
}

export interface StudentWeeklyGroupSchedule {
  group_id: string
  group_name: string
  teacher_name: string
  weekday: number
  start_time: string
  end_time: string
}

export interface StudentAttendanceSummary {
  total_sessions: number
  present_sessions: number
  attendance_percentage: number
  recent: Array<{
    session_id: string
    group_name: string
    teacher_name: string
    session_date: string
    start_time: string
    end_time: string
    status: 'PRESENT'
    attended_at: string
  }>
}

export interface StudentAttendanceGroupSummary {
  group_id: string
  group_name: string
  teacher_name: string
  total_sessions: number
  present_count: number
  absent_count: number
}

export interface StudentAttendanceSubject {
  subject: string
  subscription_id: string
  started_at: string
  expires_at: string
  groups: StudentAttendanceGroupSummary[]
}

export interface AttendanceHistorySession {
  session_id: string
  subscription_id?: string
  subscription_started_at?: string
  subscription_expires_at?: string
  group_id: string
  group_name: string
  teacher_name?: string
  subject?: string
  session_date: string
  start_time: string
  end_time: string
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  attended_at: string | null
}

export interface TeacherAttendanceStudent {
  student_id: string
  student_name: string
  total_sessions: number
  present_count: number
  absent_count: number
  groups: Array<{ group_id: string; group_name: string; subject: string }>
}

export interface TeacherStudentAttendanceHistory {
  student_id: string
  student_name: string
  sessions: AttendanceHistorySession[]
}

export type AttendanceCheckInCode =
  | 'RECORDED'
  | 'ALREADY_ATTENDED'
  | 'EXPIRED'
  | 'SESSION_CLOSED'
  | 'INVALID_CODE'
  | 'SESSION_NOT_FOUND'
  | 'NO_ACTIVE_SUBSCRIPTION'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'

export interface AttendanceCheckInResult {
  ok: boolean
  code: AttendanceCheckInCode
}
