import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/types'

type JsonObject = { [key: string]: Json | undefined }

export interface StudentIdSubscription {
  teacherName: string
  subject: string
  groupName: string
  status: string
  startedAt: string | null
  expiresAt: string | null
  qrPayload: string
}

export interface StudentIdData {
  studentIdentifier: string
  fullName: string
  avatarUrl: string | null
  subscriptions: StudentIdSubscription[]
}

export interface VerifiedSubscription {
  groupName: string
  subject: string
  status: string
  expiresAt: string | null
  isValid: boolean
}

export type TeacherVerificationResult =
  | { kind: 'INVALID' | 'NOT_SUBSCRIBED' | 'RATE_LIMITED' }
  | {
      kind: 'FOUND'
      fullName: string
      studentIdentifier: string
      avatarUrl: string | null
      subscriptions: VerifiedSubscription[]
    }

const asObject = (value: Json | undefined): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null

const asString = (value: Json | undefined): string => typeof value === 'string' ? value : ''
const asNullableString = (value: Json | undefined): string | null => typeof value === 'string' ? value : null
const asArray = (value: Json | undefined): Json[] => Array.isArray(value) ? value : []

const signedStudentAvatar = async (path: string | null): Promise<string | null> => {
  if (!path) return null
  const { data, error } = await supabase.storage.from('student-avatars').createSignedUrl(path, 900)
  if (error) {
    console.error('Could not sign student avatar URL:', error)
    return null
  }
  return data.signedUrl
}

export const studentIdService = {
  async getMyCards(): Promise<StudentIdData> {
    const { data, error } = await supabase.rpc('get_my_student_id_cards')
    if (error) throw error
    const payload = asObject(data)
    if (!payload) throw new Error('Invalid student ID response.')
    const studentIdentifier = asString(payload.student_identifier)

    const subscriptions = asArray(payload.subscriptions).flatMap((value) => {
      const row = asObject(value)
      if (!row) return []
      return [{
        teacherName: asString(row.teacher_name),
        subject: asString(row.subject),
        groupName: asString(row.group_name),
        status: asString(row.status),
        startedAt: asNullableString(row.started_at),
        expiresAt: asNullableString(row.expires_at),
        qrPayload: studentIdentifier,
      }]
    })
    const avatarPath = asNullableString(payload.avatar_path)

    return {
      studentIdentifier,
      fullName: asString(payload.full_name),
      avatarUrl: await signedStudentAvatar(avatarPath),
      subscriptions,
    }
  },

  async verifyForTeacher(identifier: string): Promise<TeacherVerificationResult> {
    const { data, error } = await supabase.rpc('verify_student_subscription_for_teacher', {
      p_identifier: identifier.trim(),
    })
    if (error) throw error
    const payload = asObject(data)
    const kind = asString(payload?.result)
    if (kind !== 'FOUND' || !payload) {
      if (kind === 'NOT_SUBSCRIBED' || kind === 'RATE_LIMITED') return { kind }
      return { kind: 'INVALID' }
    }

    const student = asObject(payload.student)
    if (!student) return { kind: 'INVALID' }
    const subscriptions = asArray(payload.subscriptions).flatMap((value) => {
      const row = asObject(value)
      if (!row) return []
      return [{
        groupName: asString(row.group_name),
        subject: asString(row.subject),
        status: asString(row.status),
        expiresAt: asNullableString(row.expires_at),
        isValid: row.is_valid === true,
      }]
    })

    return {
      kind: 'FOUND',
      fullName: asString(student.full_name),
      studentIdentifier: asString(student.student_identifier),
      avatarUrl: await signedStudentAvatar(asNullableString(student.avatar_path)),
      subscriptions,
    }
  },
}
