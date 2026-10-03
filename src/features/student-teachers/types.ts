import type { PaymentProvider } from '@/features/teacher-subscriptions/types'

export type StudentSubscriptionStatus =
  | 'PENDING_PAYMENT'
  | 'UNDER_REVIEW'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface WeeklyClassTime {
  weekday: number
  start_time: string
  end_time: string
}

export interface StudentTeacherGroup {
  id: string
  name: string
  subject: string
  educational_stage: string
  grade: string
  max_students: number
  active_students: number
  available_seats: number
  my_subscription_status: StudentSubscriptionStatus | null
  schedule: WeeklyClassTime[]
}

export interface StudentTeacherPaymentMethod {
  id: string
  provider: PaymentProvider
  account_holder: string
  account_identifier: string
  instructions: string | null
}

export interface StudentTeacherDirectoryItem {
  teacher_id: string
  full_name: string
  avatar_path: string | null
  avatar_url: string | null
  subjects: string[]
  teaching_area: string
  teaching_address: string
  lesson_title: string
  bio: string
  monthly_price: number
  groups: StudentTeacherGroup[]
}

export interface StudentTeacherDetails extends StudentTeacherDirectoryItem {
  payment_methods: StudentTeacherPaymentMethod[]
}

export type PublicTeacherProfile = StudentTeacherDirectoryItem

export interface StudentSubscriptionSummary {
  subscription_id: string
  teacher_id: string
  teacher_name: string
  teacher_avatar_path: string | null
  teacher_avatar_url?: string | null
  group_id: string
  group_name: string
  subject: string
  educational_stage: string
  grade: string
  monthly_price: number
  status: StudentSubscriptionStatus
  requested_at: string
  started_at: string | null
  expires_at: string | null
  rejection_reason: string | null
}

export interface StudentSubscriptionPaymentDetails {
  id: string
  transferred_amount: number
  receipt_path: string
  receipt_url?: string | null
  provider: PaymentProvider
  account_holder: string
  account_identifier: string
  instructions: string | null
  notes: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
}

export interface StudentSubscriptionDetails {
  id: string
  teacher_id: string
  teacher_name: string
  teacher_avatar_path: string | null
  teacher_avatar_url?: string | null
  teaching_area: string
  teaching_address: string
  lesson_title: string
  group_id: string
  group_name: string
  subject: string
  educational_stage: string
  grade: string
  monthly_price: number
  status: StudentSubscriptionStatus
  created_at: string
  submitted_at: string | null
  approved_at: string | null
  started_at: string | null
  expires_at: string | null
  rejection_reason: string | null
  schedule: WeeklyClassTime[]
  payment: StudentSubscriptionPaymentDetails | null
  available_payment_methods: StudentTeacherPaymentMethod[]
}

export interface TeacherStudentRequest {
  subscription_id: string
  student_name: string
  group_name: string
  subject: string
  educational_stage: string
  grade: string
  monthly_price: number
  subscription_status: StudentSubscriptionStatus
  payment_id: string | null
  transferred_amount: number | null
  payment_provider: PaymentProvider | null
  account_holder: string | null
  account_identifier: string | null
  payment_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  submitted_at: string | null
  receipt_path: string | null
  receipt_url?: string | null
  rejection_reason: string | null
}

export interface StudentTeacherFilters {
  stage: string
  grade: string
  subject: string
  area: string
  search: string
}

export type SubscriptionRenewalStatus = 'PENDING_PAYMENT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface StudentSubscriptionRenewalSummary {
  renewal_id: string
  subscription_id: string
  status: 'PENDING_PAYMENT' | 'UNDER_REVIEW'
  amount: number
  created_at: string
  expires_at: string | null
}

export interface StudentSubscriptionRenewalDetails {
  id: string
  subscription_id: string
  teacher_id: string
  teacher_name: string
  group_name: string
  subject: string
  amount: number
  status: SubscriptionRenewalStatus
  expires_at: string | null
  rejection_reason: string | null
  payment_methods: StudentTeacherPaymentMethod[]
  payment: {
    id: string
    transferred_amount: number
    receipt_path: string
    receipt_url?: string | null
    provider: PaymentProvider
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    rejection_reason: string | null
    submitted_at: string
  } | null
}

export interface TeacherStudentRenewal {
  renewal_id: string
  subscription_id: string
  student_name: string
  group_name: string
  subject: string
  amount: number
  status: 'UNDER_REVIEW'
  payment_id: string
  transferred_amount: number
  payment_provider: PaymentProvider
  account_holder: string
  account_identifier: string
  receipt_path: string
  receipt_url?: string | null
  notes: string | null
  submitted_at: string
  rejection_reason: string | null
}
