import type { PaymentProvider } from '@/features/teacher-subscriptions/types'

export type TeacherSemester = 'FIRST' | 'SECOND' | 'BOTH'

export interface TeacherProfileDetails {
  teacher_id: string
  subject: string
  subjects: string[]
  semester: TeacherSemester
  teaching_address: string
  bio: string
  lesson_title: string | null
  monthly_price: number | null
  teaching_area: string
  created_at: string
  updated_at: string
}

export interface TeacherStudentPaymentMethod {
  id: string
  provider: PaymentProvider
  account_holder: string
  account_identifier: string
  instructions: string | null
  is_active: boolean
}

export interface TeacherProfileData {
  profile: TeacherProfileDetails | null
  account: { full_name: string; phone: string | null; avatar_path: string | null; avatar_url: string | null } | null
}
