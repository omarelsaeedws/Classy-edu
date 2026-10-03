import { supabase } from '@/lib/supabase/client'
import type {
  AttendanceCheckInResult,
  AttendanceCheckInCode,
  StudentAttendanceSummary,
  StudentClassSession,
  StudentWeeklyGroupSchedule,
  TeacherClassSession,
  TeacherSessionAttendance,
  StudentAttendanceSubject,
  AttendanceHistorySession,
  TeacherAttendanceStudent,
  TeacherStudentAttendanceHistory,
} from './types'

const asJson = <T,>(value: unknown): T => value as T
const asJsonArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []

export const attendanceService = {
  async listTeacherSessions(): Promise<TeacherClassSession[]> {
    const { data, error } = await supabase.rpc('list_teacher_class_sessions')
    if (error) throw error
    return asJsonArray<TeacherClassSession>(data)
  },

  async createSession(input: {
    groupId: string
    date: string
    startTime: string
    endTime: string
  }): Promise<string> {
    const { data, error } = await supabase.rpc('create_teacher_class_session', {
      p_group_id: input.groupId,
      p_session_date: input.date,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
    })
    if (error) throw error
    return data
  },

  async openAttendance(sessionId: string): Promise<{ attendance_code: string; expires_at: string }> {
    const { data, error } = await supabase.rpc('open_teacher_class_attendance', { p_session_id: sessionId })
    if (error) throw error
    return asJson(data)
  },

  async getTeacherSession(sessionId: string): Promise<TeacherSessionAttendance | null> {
    const { data, error } = await supabase.rpc('get_teacher_session_attendance', { p_session_id: sessionId })
    if (error) {
      if (error.message.includes('Session not found')) return null
      throw error
    }
    return data ? asJson(data) : null
  },

  async closeSession(sessionId: string): Promise<void> {
    const { error } = await supabase.rpc('close_teacher_class_session', { p_session_id: sessionId })
    if (error) throw error
  },

  async extendAttendance(sessionId: string): Promise<{ expires_at: string }> {
    const { data, error } = await supabase.rpc('extend_teacher_class_attendance', { p_session_id: sessionId })
    if (error) throw error
    return asJson(data)
  },

  async cancelSession(sessionId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_teacher_class_session', { p_session_id: sessionId })
    if (error) throw error
  },

  async listStudentSessions(): Promise<StudentClassSession[]> {
    const { data, error } = await supabase.rpc('list_student_class_sessions')
    if (error) throw error
    return asJsonArray<StudentClassSession>(data)
  },

  async listStudentWeeklySchedules(): Promise<StudentWeeklyGroupSchedule[]> {
    const { data, error } = await supabase.rpc('list_student_weekly_group_schedules')
    if (error) throw error
    return asJsonArray<StudentWeeklyGroupSchedule>(data)
  },

  async getStudentSummary(): Promise<StudentAttendanceSummary> {
    const { data, error } = await supabase.rpc('get_student_attendance_summary')
    if (error) throw error
    return asJson(data)
  },

  async listStudentAttendanceSubjects(): Promise<StudentAttendanceSubject[]> {
    const { data, error } = await supabase.rpc('list_student_attendance_subjects')
    if (error) throw error
    return asJsonArray<StudentAttendanceSubject>(data)
  },

  async getStudentSubscriptionAttendance(subscriptionId: string): Promise<AttendanceHistorySession[]> {
    const { data, error } = await supabase.rpc('get_student_subscription_attendance', { p_subscription_id: subscriptionId })
    if (error) throw error
    return asJsonArray<AttendanceHistorySession>(data)
  },

  async listTeacherAttendanceStudents(search: string): Promise<TeacherAttendanceStudent[]> {
    const { data, error } = await supabase.rpc('list_teacher_attendance_students', {
      p_search: search.trim() || null,
    })
    if (error) throw error
    return asJsonArray<TeacherAttendanceStudent>(data)
  },

  async getTeacherStudentAttendance(studentId: string): Promise<TeacherStudentAttendanceHistory> {
    const { data, error } = await supabase.rpc('get_teacher_student_attendance', { p_student_id: studentId })
    if (error) throw error
    return asJson(data)
  },

  async checkIn(input: { sessionId: string | null; code: string }): Promise<AttendanceCheckInResult> {
    const { data, error } = await supabase.functions.invoke('check-attendance', {
      body: { session_id: input.sessionId, attendance_code: input.code.trim() },
    })
    if (error) {
      const context: unknown = error.context
      if (context instanceof Response) {
        try {
          const body: unknown = await context.clone().json()
          if (body && typeof body === 'object' && 'code' in body && body.code === 'RATE_LIMITED') {
            return { ok: false, code: 'RATE_LIMITED' }
          }
        } catch {
          return { ok: false, code: 'NETWORK_ERROR' }
        }
      }
      return { ok: false, code: 'NETWORK_ERROR' }
    }
    if (data && typeof data === 'object' && 'code' in data && typeof data.code === 'string') {
      const allowedCodes: AttendanceCheckInCode[] = [
        'RECORDED', 'ALREADY_ATTENDED', 'EXPIRED', 'SESSION_CLOSED', 'INVALID_CODE',
        'SESSION_NOT_FOUND', 'NO_ACTIVE_SUBSCRIPTION', 'UNAUTHORIZED', 'RATE_LIMITED', 'NETWORK_ERROR',
      ]
      const code = allowedCodes.find((candidate) => candidate === data.code) ?? 'NETWORK_ERROR'
      return { ok: data.ok === true, code }
    }
    return { ok: false, code: 'NETWORK_ERROR' }
  },
}
